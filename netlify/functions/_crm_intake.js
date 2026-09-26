'use strict';

/*
 * Website enquiry -> CRM pipeline.
 *
 * Every quote, sample, catalogue, documents, private-label and local-pricing
 * request that arrives through the website is put into the buyer pipeline
 * automatically, instead of waiting in the Enquiries inbox for someone to
 * re-type it. Called by inquiries.js AFTER the enquiry itself is saved, so
 * nothing here can lose an enquiry: if this fails, the enquiry is still in
 * the inbox, with a note saying why it is not in the pipeline.
 *
 * WHERE EACH REQUEST GOES (owner's decision)
 *
 *   Sample Request  -> stage 'Sample Requested'
 *   Quote Request   -> stage 'Lead', next action 'Send quotation'
 *                      (there is no quotation stage; the owner chose a
 *                      flagged Lead over adding one)
 *   everything else -> stage 'Lead', with a next action naming what they
 *                      asked for
 *
 * A NEW PERSON becomes a new buyer: created_by 'website', unassigned, due
 * tomorrow -- the forms promise a reply "within 24 hours", so an unanswered
 * enquiry shows up in the dashboard's overdue list rather than going quiet.
 *
 * SOMEONE ALREADY IN THE CRM (same email, not deleted) is not duplicated.
 * The request is written to their activity log, and their stage moves only
 * FORWARD -- a buyer in Negotiation who asks for another sample stays in
 * Negotiation, and Lost/Stalled is never reopened by a web form; a person
 * decides that. Their next action is filled in only if they had none: staff
 * entries are never overwritten.
 *
 * NOT ADDED, with the reason recorded on the enquiry: a company name the CRM
 * itself would refuse (see classifyCompanyName), or an email address the CRM
 * would refuse. Those stay in the inbox for a person to judge.
 *
 * Writes are single statements, so a buyer is never created without its
 * stage history, activity entry, audit entry and link back to the enquiry.
 */

const { STAGES, ensureBuyerTables, classifyCompanyName } = require('./_crm_lib');
const { regionForCountry } = require('./_country_regions');

const ACTOR = 'website';

// Same rule crm-buyers.js applies to a contact_email typed by staff.
const BUYER_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// request_type as stored by assets/inquiry-form.js (INTENTS). The server does
// not trust the browser to send one of these; anything else is a plain Lead.
const PLAN = {
  'Sample Request': { stage: 'Sample Requested', nextAction: 'Arrange and send sample' },
  'Quote Request': { stage: 'Lead', nextAction: 'Send quotation' },
  'Catalog Request': { stage: 'Lead', nextAction: 'Send catalogue' },
  'Quality Documents Request': { stage: 'Lead', nextAction: 'Send quality documents' },
  'Private Label Inquiry': { stage: 'Lead', nextAction: 'Reply to private-label enquiry' },
  'Local Pricing Request (Egypt)': { stage: 'Lead', nextAction: 'Send local pricing' },
};
const DEFAULT_PLAN = { stage: 'Lead', nextAction: 'Reply to website enquiry' };

function planFor(requestType) {
  return PLAN[requestType] || DEFAULT_PLAN;
}

/*
 * The form's product dropdown sends its visible label, in English or Arabic.
 * Each label is the heading of the matching page under /products/, so this is
 * the site's own naming, not a guess -- scripts/check-enquiry-intake.js reads
 * those pages and fails if a label and its page stop agreeing. "Not sure yet"
 * maps to nothing; the original text is always kept in the activity entry
 * either way. (Kalamata maps like any other product: it is in the CRM's own
 * product list -- see scripts/check-crm-products.js.)
 */
const PRODUCT_LABELS = {
  'aggizi-green-olives': ['Aggizi Green Olives', 'زيتون عجيزي أخضر'],
  'kalamata-olives': ['Kalamata Olives', 'زيتون كالاماتا'],
  'toffahi-green-olives': ['Toffahi Green Olives', 'زيتون تفاحي أخضر'],
  'hamed-green-olives': ['Hamed Green Olives', 'زيتون حامد أخضر'],
  'manzanilla-green-olives': ['Manzanilla Green Olives', 'زيتون مانزانيلا أخضر'],
  'natural-black-olives': ['Natural Black Olives', 'زيتون أسود طبيعي'],
  'pepper-stuffed-green-olives': ['Stuffed Green Olives', 'زيتون أخضر محشو'],
  'oxidized-black-olives': ['Oxidized Black Olives', 'زيتون أسود مؤكسد'],
  'marinated-artichoke-hearts': ['Marinated Artichoke Hearts', 'قلوب أرضي شوكي متبّلة'],
  'pepperoncini-peppers': ['Pepperoncini Peppers', 'فلفل بيبرونشيني'],
  'sliced-jalapeno-peppers': ['Sliced Jalapeño Peppers', 'فلفل هالبينو مقطع'],
};
const PRODUCT_BY_LABEL = new Map();
for (const [slug, labels] of Object.entries(PRODUCT_LABELS)) {
  for (const label of labels) PRODUCT_BY_LABEL.set(label.trim(), slug);
}

function productsFor(label) {
  const slug = PRODUCT_BY_LABEL.get(String(label || '').trim());
  return slug ? [slug] : [];
}

/*
 * Forward only. A move happens when the target is later in the pipeline than
 * where the buyer is now, and the buyer is not Lost/Stalled -- which sits at
 * the end of the list but is not "further along" than anything.
 */
function forwardMove(currentStage, targetStage) {
  if (currentStage === 'Lost/Stalled') return null;
  const from = STAGES.indexOf(currentStage);
  const to = STAGES.indexOf(targetStage);
  if (to === -1) return null;
  if (from !== -1 && to <= from) return null;
  return targetStage;
}

function activityText(inquiryId, e, region) {
  const lines = [`Website enquiry #${inquiryId}: ${e.requestType || 'Enquiry'}`];
  if (e.productInterest) lines.push(`Product: ${e.productInterest}`);
  if (e.estimatedVolume) lines.push(`Volume: ${e.estimatedVolume}`);
  lines.push(`Country: ${e.country}` + (region === 'Unassigned' ? ' (region not set -- please choose one)' : ''));
  if (e.phone) lines.push(`Phone: ${e.phone}`);
  lines.push('', e.message);
  return lines.join('\n');
}

async function noteOnEnquiry(sql, inquiryId, note) {
  await sql`UPDATE inquiries SET pipeline_note = ${note} WHERE id = ${inquiryId}`;
}

/*
 * enquiry: the cleaned values inquiries.js has just saved --
 *   { name, email, company, country, phone, productInterest,
 *     estimatedVolume, requestType, message }
 *
 * Returns { outcome: 'created' | 'updated' | 'skipped', buyerId?, note? }.
 * Throws only on a database error; the caller records that on the enquiry.
 */
async function addEnquiryToPipeline(sql, inquiryId, e) {
  const verdict = classifyCompanyName(e.company);
  if (verdict.severity === 'reject') {
    const note = `Not added to pipeline: company name -- ${verdict.reason}`;
    await noteOnEnquiry(sql, inquiryId, note);
    return { outcome: 'skipped', note };
  }
  if (!BUYER_EMAIL.test(e.email)) {
    const note = 'Not added to pipeline: the email address is incomplete';
    await noteOnEnquiry(sql, inquiryId, note);
    return { outcome: 'skipped', note };
  }

  await ensureBuyerTables(sql);

  const plan = planFor(e.requestType);
  const region = regionForCountry(e.country);
  const entry = activityText(inquiryId, e, region);
  const auditDetail = `from website enquiry #${inquiryId}`;

  const existing = await sql`
    SELECT id, current_stage FROM buyers
    WHERE deleted_at IS NULL AND lower(contact_email) = lower(${e.email})
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  if (!existing[0]) {
    const rows = await sql`
      WITH new_buyer AS (
        INSERT INTO buyers (
          created_by, assigned_to, company_name, country_region, contact_name,
          contact_email, contact_phone, lead_source, current_stage, product_interest,
          estimated_volume, next_action, next_action_due
        ) VALUES (
          ${ACTOR}, NULL, ${e.company}, ${region}, ${e.name},
          ${e.email}, ${e.phone}, ${'Website: ' + (e.requestType || 'Enquiry')}, ${plan.stage},
          ${JSON.stringify(productsFor(e.productInterest))}::jsonb,
          ${e.estimatedVolume}, ${plan.nextAction}, CURRENT_DATE + 1
        )
        RETURNING id
      ), history AS (
        INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by)
        SELECT id, NULL, ${plan.stage}, ${ACTOR} FROM new_buyer
      ), activity AS (
        INSERT INTO buyer_activity_log (buyer_id, created_by, entry)
        SELECT id, ${ACTOR}, ${entry} FROM new_buyer
      ), audited AS (
        INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
        SELECT ${ACTOR}, 'create', 'buyer', id, ${auditDetail} FROM new_buyer
      ), linked AS (
        UPDATE inquiries SET buyer_id = new_buyer.id, pipeline_note = NULL
        FROM new_buyer WHERE inquiries.id = ${inquiryId}
      )
      SELECT id FROM new_buyer
    `;
    return { outcome: 'created', buyerId: rows[0].id };
  }

  const buyer = existing[0];
  const moveTo = forwardMove(buyer.current_stage, plan.stage);
  const logged = entry + '\n\n' + (moveTo
    ? `Stage moved automatically: ${buyer.current_stage} -> ${moveTo}.`
    : `Stage left at ${buyer.current_stage}: automatic moves only go forward.`);

  // One UPDATE (a row cannot be updated twice in one statement). `before` is
  // read in the same statement, so the history row records the stage this
  // update actually moved from, and is written only if it moved.
  await sql`
    WITH before AS (
      SELECT id, current_stage FROM buyers WHERE id = ${buyer.id}
    ), updated AS (
      UPDATE buyers SET
        current_stage = CASE
          WHEN ${moveTo}::text IS NOT NULL AND buyers.current_stage = ${buyer.current_stage}
          THEN ${moveTo}::text ELSE buyers.current_stage END,
        next_action = CASE WHEN COALESCE(buyers.next_action, '') = ''
          THEN ${plan.nextAction} ELSE buyers.next_action END,
        next_action_due = CASE WHEN COALESCE(buyers.next_action, '') = ''
          THEN CURRENT_DATE + 1 ELSE buyers.next_action_due END,
        updated_at = now()
      FROM before WHERE buyers.id = before.id
      RETURNING buyers.id, before.current_stage AS from_stage, buyers.current_stage AS to_stage
    ), history AS (
      INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by)
      SELECT id, from_stage, to_stage, ${ACTOR} FROM updated WHERE from_stage <> to_stage
    ), activity AS (
      INSERT INTO buyer_activity_log (buyer_id, created_by, entry)
      SELECT id, ${ACTOR}, ${logged} FROM updated
    ), audited AS (
      INSERT INTO crm_audit_log (actor, action, record_type, record_id, details)
      SELECT ${ACTOR}, 'update', 'buyer', id, ${auditDetail} FROM updated
    )
    UPDATE inquiries SET buyer_id = ${buyer.id}, pipeline_note = NULL WHERE id = ${inquiryId}
  `;
  return { outcome: 'updated', buyerId: buyer.id };
}

module.exports = {
  addEnquiryToPipeline, planFor, forwardMove, productsFor, PRODUCT_LABELS, PLAN, ACTOR,
};
