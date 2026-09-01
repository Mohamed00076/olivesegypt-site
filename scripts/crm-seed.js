#!/usr/bin/env node
'use strict';

/*
 * Seeds the Buyer CRM with realistic FICTIONAL sample buyers so the
 * dashboard, buyer list, and kanban board have something to show on
 * first use. Every company name, contact, and email below is invented
 * for demonstration -- none refer to real businesses or people.
 *
 * Requires DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING /
 * DATABASE_URL_UNPOOLED) to be set, same as the Netlify functions.
 * Safe to re-run: it only inserts if the buyers table is empty, unless
 * --force is passed.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/crm-seed.js [--force]
 */

const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;
if (!cs) {
  console.error('Set DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING / DATABASE_URL_UNPOOLED) first.');
  process.exit(1);
}

const { neon } = require('@neondatabase/serverless');
const sql = neon(cs);

const force = process.argv.includes('--force');

// One fictional buyer per pipeline stage (skipping the terminal
// "Exported/Completed" stage on purpose -- per the spec, that stage is
// a placeholder for the future and no real or seeded record should
// claim it prematurely), plus one Lost/Stalled example with a reason.
const SAMPLE_BUYERS = [
  {
    company_name: 'Nordic Deli Imports ApS', country_region: 'EU',
    contact_name: 'Freja Lund', contact_title: 'Purchasing Manager',
    contact_email: 'freja.lund@example-nordicdeli.test', contact_phone: '+45 20 00 00 00',
    lead_source: 'Trade show (Anuga)', current_stage: 'Lead',
    product_interest: ['aggizi-green-olives', 'natural-black-olives'],
    packaging_format: '5kg pails', estimated_volume: '1 container / quarter',
    next_action: 'Send introductory catalog and price list', next_action_due: daysFromNow(3),
    notes: 'Inbound from Anuga 2026 booth visit. Interested in private-label options.',
  },
  {
    company_name: 'Cape Harvest Wholesale (Pty) Ltd', country_region: 'Africa',
    contact_name: 'Naledi Mokoena', contact_title: 'Category Buyer',
    contact_email: 'n.mokoena@example-capeharvest.test', contact_phone: '+27 82 000 0000',
    lead_source: 'Referral', current_stage: 'Contacted',
    product_interest: ['manzanilla-green-olives'],
    next_action: 'Follow-up call to scope volume needs', next_action_due: daysFromNow(2),
    notes: 'Referred by an existing EU buyer. First call scheduled.',
  },
  {
    company_name: 'Gulf Fine Foods LLC', country_region: 'Middle East',
    contact_name: 'Yousef Al-Harbi', contact_title: 'Head of Procurement',
    contact_email: 'y.alharbi@example-gulffinefoods.test', contact_phone: '+966 50 000 0000',
    contact_whatsapp: '+966 50 000 0000', lead_source: 'Website inquiry form',
    current_stage: 'Qualifying', product_interest: ['hamed-green-olives', 'pepper-stuffed-green-olives'],
    certifications_required: 'Halal, HACCP', certification_gap: true,
    next_action: 'Confirm current certification coverage before quoting', next_action_due: daysFromNow(5),
    notes: 'Requires Halal certification -- cross-reference against current cert status before promising delivery timelines.',
  },
  {
    company_name: 'Kansai Gourmet Trading Co', country_region: 'Asia',
    contact_name: 'Haruto Sato', contact_title: 'Import Director',
    contact_email: 'h.sato@example-kansaigourmet.test', lead_source: 'LinkedIn outreach',
    current_stage: 'Sample Requested', product_interest: ['oxidized-black-olives'],
    packaging_format: '250g glass jars, retail-ready', estimated_volume: 'Trial order, 500 units',
    next_action: 'Ship sample kit', next_action_due: daysFromNow(4),
    notes: 'Wants a retail-ready sample kit before committing to a trial order.',
  },
  {
    company_name: 'Great Lakes Specialty Foods Inc', country_region: 'North America',
    contact_name: 'Marcus Whitfield', contact_title: 'VP Sourcing',
    contact_email: 'm.whitfield@example-greatlakesfoods.test', contact_phone: '+1 312 000 0000',
    lead_source: 'Import/export directory listing', current_stage: 'Sample Sent',
    product_interest: ['marinated-artichoke-hearts', 'pepperoncini-peppers'],
    next_action: 'Follow up on sample feedback', next_action_due: daysFromNow(1),
    notes: 'Samples shipped via air freight; tracking confirmed delivery.',
  },
  {
    company_name: 'Andalusia Fine Grocers SL', country_region: 'EU',
    contact_name: 'Elena Torres', contact_title: 'Buyer',
    contact_email: 'e.torres@example-andalusiagrocers.test', lead_source: 'Trade show (SIAL)',
    current_stage: 'Negotiation', product_interest: ['toffahi-green-olives'],
    target_price: '$2,450 / MT FOB', quoted_price: '$2,600 / MT FOB', incoterm: 'FOB',
    next_action: 'Send revised quote reflecting requested volume discount', next_action_due: daysFromNow(2),
    notes: 'Pushing for a 6% volume discount on orders above 3 containers/year.',
  },
  {
    company_name: 'Red Sea Provisions Trading', country_region: 'Middle East',
    contact_name: 'Omar Fathi', contact_title: 'Managing Partner',
    contact_email: 'o.fathi@example-redseaprovisions.test', lead_source: 'Referral',
    current_stage: 'Contract Signed', product_interest: ['aggizi-green-olives', 'sliced-jalapeno-peppers'],
    incoterm: 'CIF', quoted_price: '$2,300 / MT CIF',
    next_action: 'Prepare shipment documentation', next_action_due: daysFromNow(6),
    notes: 'Contract signed for an initial 2-container order, first of a planned quarterly cadence.',
  },
  {
    company_name: 'Singapore Harbor Foods Pte Ltd', country_region: 'Asia',
    contact_name: 'Mei Lin Tan', contact_title: 'Procurement Lead',
    contact_email: 'ml.tan@example-singaporeharbor.test', lead_source: 'Website inquiry form',
    current_stage: 'Shipment Prepared', product_interest: ['natural-black-olives'],
    incoterm: 'FOB', quoted_price: '$2,150 / MT FOB',
    next_action: 'Confirm container booking and send B/L draft', next_action_due: daysFromNow(3),
    notes: 'First order for this buyer; container booked, awaiting final documentation review.',
  },
  {
    company_name: 'Pacific Grocers Co', country_region: 'Asia',
    contact_name: 'David Reyes', lead_source: 'Cold outreach',
    current_stage: 'Lost/Stalled', lost_reason: 'Went with a lower-priced Spanish supplier',
    product_interest: ['manzanilla-green-olives'],
    notes: 'Price-sensitive buyer; revisit if pricing becomes more competitive.',
  },
];

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS buyers (
      id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now(),
      deleted_at               timestamptz,
      created_by               text,
      assigned_to              text,
      company_name             text NOT NULL,
      country_region           text NOT NULL,
      contact_name             text,
      contact_title            text,
      contact_email            text,
      contact_phone            text,
      contact_whatsapp         text,
      lead_source              text,
      current_stage            text NOT NULL DEFAULT 'Lead',
      product_interest         jsonb NOT NULL DEFAULT '[]',
      packaging_format         text,
      estimated_volume         text,
      target_price             text,
      quoted_price             text,
      incoterm                 text,
      certifications_required  text,
      certification_gap        boolean NOT NULL DEFAULT false,
      next_action              text,
      next_action_due          date,
      notes                    text,
      lost_reason              text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS buyer_stage_history (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id     bigint NOT NULL,
      from_stage   text,
      to_stage     text NOT NULL,
      changed_at   timestamptz NOT NULL DEFAULT now(),
      changed_by   text
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS buyer_activity_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id     bigint NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now(),
      created_by   text,
      entry        text NOT NULL
    )
  `;
}

async function main() {
  await ensureSchema();

  const existing = await sql`SELECT count(*)::int AS n FROM buyers`;
  if (existing[0].n > 0 && !force) {
    console.log(`buyers table already has ${existing[0].n} row(s) -- skipping seed. Pass --force to insert anyway.`);
    return;
  }

  for (const b of SAMPLE_BUYERS) {
    const rows = await sql`
      INSERT INTO buyers (
        created_by, assigned_to, company_name, country_region, contact_name, contact_title,
        contact_email, contact_phone, contact_whatsapp, lead_source, current_stage,
        product_interest, packaging_format, estimated_volume, target_price, quoted_price,
        incoterm, certifications_required, certification_gap, next_action, next_action_due,
        notes, lost_reason
      ) VALUES (
        'seed-script', 'owner', ${b.company_name}, ${b.country_region}, ${b.contact_name || null},
        ${b.contact_title || null}, ${b.contact_email || null}, ${b.contact_phone || null},
        ${b.contact_whatsapp || null}, ${b.lead_source || null}, ${b.current_stage},
        ${JSON.stringify(b.product_interest || [])}::jsonb, ${b.packaging_format || null},
        ${b.estimated_volume || null}, ${b.target_price || null}, ${b.quoted_price || null},
        ${b.incoterm || null}, ${b.certifications_required || null}, ${!!b.certification_gap},
        ${b.next_action || null}, ${b.next_action_due || null}, ${b.notes || null}, ${b.lost_reason || null}
      )
      RETURNING id
    `;
    const id = rows[0].id;
    await sql`INSERT INTO buyer_stage_history (buyer_id, from_stage, to_stage, changed_by) VALUES (${id}, NULL, ${b.current_stage}, 'seed-script')`;
    if (b.notes) {
      await sql`INSERT INTO buyer_activity_log (buyer_id, created_by, entry) VALUES (${id}, 'seed-script', ${b.notes})`;
    }
    console.log(`Inserted: ${b.company_name} (${b.current_stage})`);
  }

  console.log(`\nSeeded ${SAMPLE_BUYERS.length} fictional buyers.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
