#!/usr/bin/env node
'use strict';

/*
 * The stage-duration table: ordered by the pipeline, and labelled as what it
 * actually measures.
 *
 * Two faults shipped together here, and neither was visible to anyone reading
 * the dashboard.
 *
 * ORDER. The query groups by stage and carries no ORDER BY on its outer
 * select -- the only one it has is inside the window function, ordering each
 * buyer's own history so LEAD() can find the next change. The groups therefore
 * arrive in whatever order the aggregate produced. On the owner's screen that
 * read Sample Requested, Negotiation, Qualifying, Lead, Contacted, and it can
 * differ between runs. Meanwhile stageOrderIndex had sat in crm/index.html
 * since it was written, used by nothing: somebody meant to sort with it and
 * never wired it in. A helper defined and never called is the shape this bug
 * had, so this check looks for exactly that.
 *
 * LABEL. Each row of buyer_stage_history is a move TO a stage, and LEAD()
 * finds when that buyer moved again -- so the interval is time SPENT IN the
 * stage just entered. The headings said "Time to Reach Each Stage" and "Avg.
 * Days To Get There", which is the opposite question. One tells you your cycle
 * length, the other tells you where deals stall, and a reader would have taken
 * the second for the first.
 *
 * Nothing is executed: the page and the function are read as source.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'crm/index.html');
const FN = path.join(ROOT, 'netlify/functions/crm-dashboard.js');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const page = fs.readFileSync(PAGE, 'utf8');
const fn = fs.readFileSync(FN, 'utf8');

// ---- the table is sorted, and sorted by the pipeline ---------------------

t('the dashboard still has a stage-order helper',
  /function stageOrderIndex\s*\(/.test(page),
  'stageOrderIndex is gone -- the table has nothing to sort by');

t('and it is actually called, not just defined',
  (page.match(/stageOrderIndex\s*\(/g) || []).length >= 2,
  'defined and never used, which is exactly how the table came to be in database order');

t('the stage table sorts before it renders',
  /avg_time_per_stage_days\.slice\(\)\.sort\(/.test(page),
  'rendering straight from the response leaves the rows in aggregate order');

t('and it sorts by stage order rather than by the number',
  /sort\(function \(a, b\) \{\s*return stageOrderIndex\(a\.stage\) - stageOrderIndex\(b\.stage\);/.test(page),
  'sorting by avg_days would rank stages by duration, which is a different table');

t('the sort does not mutate the response in place',
  /avg_time_per_stage_days\.slice\(\)\.sort/.test(page),
  'sort() without slice() reorders the object other code may still read');

// ---- the labels say what the query measures ------------------------------

/*
 * Comments are stripped first, because the note above this table quotes the
 * old wording to explain what was wrong with it. Searching the raw file would
 * flag that explanation as the bug it documents -- which it did on the first
 * run of this check, and the fix is to read the markup rather than the prose
 * about the markup.
 */
const rendered = page.replace(/\/\*[\s\S]*?\*\//g, '');

const WRONG = [
  ['Average Time to Reach Each Stage', 'the heading'],
  ['Avg. Days To Get There', 'the column'],
  ['Stage Reached', 'the first column'],
];
for (const [text, what] of WRONG) {
  t(`${what} no longer says "${text}"`,
    !rendered.includes(text),
    'this describes time to ARRIVE at a stage; the query measures time spent IN it');
}

t('the heading names time spent in a stage',
  /Average Time Spent in Each Stage/.test(page), 'the heading does not say what is measured');
t('and the column agrees with it',
  /Avg\. Days In Stage/.test(page), 'the column heading drifted from the card heading');

t('the table says which stages it leaves out',
  /moved on from/.test(page),
  'half the pipeline is missing by design, and unexplained that reads as a bug');

// ---- the query still measures what the labels now claim ------------------

/*
 * If the query is ever rewritten to measure time-to-reach, these labels become
 * wrong again in the other direction. The shape that makes "time spent in" the
 * right words is LEAD() over each buyer's history, keyed on to_stage.
 */
t('the query still measures the gap to the buyer\'s next stage change',
  /LEAD\(changed_at\)\s*OVER\s*\(\s*PARTITION BY buyer_id ORDER BY changed_at\s*\)/.test(fn),
  'the window function changed -- re-read what the interval means before trusting the labels');
t('and still groups by the stage that was entered',
  /GROUP BY to_stage/.test(fn),
  'grouping by from_stage would make this time-to-leave-for, not time-in');
t('and still drops the stage each buyer currently sits in',
  /WHERE next_changed_at IS NOT NULL/.test(fn),
  'without this the current stage counts as zero days and drags every average down');

const ok = fail === 0;
console.log(
  `\nstage-table ${ok ? 'OK' : 'FAILED'} -- sorted by pipeline order, labelled as time spent in stage, ` +
  'and the query still measures that.'
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
