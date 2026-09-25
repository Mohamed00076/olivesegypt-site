#!/usr/bin/env node
'use strict';

/*
 * Every rate shown to a person goes through the sample-size floor.
 *
 * A percentage implies a measured rate. "33.3%" off three buyers is one buyer,
 * and the next one moves it to 50% or 25%. The arithmetic was always right;
 * the presentation carried a precision the data does not have.
 *
 * Two ways this rots, and neither shows on the page while the numbers are
 * small enough to look plausible:
 *
 *   1. A new rate is added and nobody routes it through the floor. It renders
 *      as a bare percentage and reads as measured.
 *   2. The threshold is copied to a second place. The two drift, and which
 *      figure obeys which becomes a matter of reading both.
 *
 * So the threshold lives in exactly one file, and every site that renders a
 * rate must reference the helper. The check also guards the other direction:
 * bar widths are a drawing instruction, not a claim about a population, and
 * thresholding one would leave a chart with bars missing.
 *
 * Nothing is executed: assets/small-sample.js is read as text and evaluated in
 * isolation to check its own behaviour, and the pages are scanned as source.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const HELPER = path.join(ROOT, 'assets/small-sample.js');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- the helper itself ----------------------------------------------------

t('assets/small-sample.js exists', fs.existsSync(HELPER));
if (!fs.existsSync(HELPER)) {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

const src = fs.readFileSync(HELPER, 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const S = sandbox.window.SmallSample;

t('it exposes a SmallSample helper', !!S && typeof S.rate === 'function');

const threshold = S.MIN_SAMPLE;
t(`the threshold is a sane number (${threshold})`,
  Number.isInteger(threshold) && threshold >= 2 && threshold <= 1000, String(threshold));

t('at or above the threshold a rate is a percentage',
  S.rate(33, 99, { noun: 'buyers' }).endsWith('%'), S.rate(33, 99, { noun: 'buyers' }));
t('below it the count is shown instead',
  S.rate(3, 9, { noun: 'buyers' }) === '3 of 9 buyers', S.rate(3, 9, { noun: 'buyers' }));
t('exactly at the threshold counts as enough',
  S.enough(threshold) && S.rate(1, threshold, {}).endsWith('%'), S.rate(1, threshold, {}));
t('one below the threshold does not',
  !S.enough(threshold - 1), String(threshold - 1));
t('a zero denominator is neither a percentage nor a count',
  S.rate(0, 0, {}) === 'n/a', S.rate(0, 0, {}));
t('a denominator alone, below the floor, still says something useful',
  S.rate(null, 4, { noun: 'visits' }) === '4 visits so far', S.rate(null, 4, { noun: 'visits' }));
t('rubbish input does not produce "NaN%"',
  !/NaN/.test(S.rate(undefined, undefined, {})) && !/NaN/.test(S.rate('x', 'y', {})),
  `${S.rate(undefined, undefined, {})} / ${S.rate('x', 'y', {})}`);

// ---- one threshold, one place --------------------------------------------

{
  const others = [];
  const scan = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) scan(full);
      else if (/\.(js|html)$/.test(e.name) && full !== HELPER) {
        const s = fs.readFileSync(full, 'utf8');
        // A literal 10 beside sample/threshold wording is the copy to catch.
        if (/MIN_SAMPLE\s*=\s*\d+/.test(s)) others.push(path.relative(ROOT, full));
      }
    }
  };
  scan(path.join(ROOT, 'assets'));
  scan(path.join(ROOT, 'crm'));
  scan(path.join(ROOT, 'admin'));
  t('the threshold is defined in exactly one file',
    others.length === 0,
    `also defined in ${others.join(', ')} -- two copies drift`);
}

// ---- every rate site routes through it ------------------------------------

const SITES = [
  ['crm/index.html', 'the CRM conversion rate'],
  ['admin/analytics/index.html', 'the analytics bounce rate and search CTR'],
];

for (const [rel, what] of SITES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { t(`${rel} exists`, false, 'page moved'); continue; }
  const s = fs.readFileSync(file, 'utf8');
  t(`${rel} loads the helper (${what})`,
    /<script src="\/assets\/small-sample\.js"><\/script>/.test(s),
    'the helper is used but never loaded -- SmallSample would be undefined at runtime');
  t(`   and ${rel} actually calls it`,
    /SmallSample\.(rate|enough)\(/.test(s), 'loaded but unused');
}

// ---- and no bare percentage slipped back in -------------------------------

/*
 * Percentages that are not rates over a sample, and why each is exempt.
 * A named list with a reason, as the other exception lists in this suite are:
 * an exemption is a decision somebody made, not a pattern that happens to pass.
 */
const NOT_A_SAMPLED_RATE = [
  {
    match: /function fmtKpiValue|unit === '%' \|\| unit === 'percentage'/,
    why: "fmtKpiValue renders kpi_definitions.actual_value and target_value -- figures the owner types in with a declared unit, not a ratio this page computed. There is no denominator to threshold, and blanking a stated KPI target would be wrong.",
  },
];

{
  const offenders = [];
  for (const [rel] of SITES) {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/\+\s*'%'/.test(line)) return;
      const trimmed = line.trim();

      // Guarded on its own line: done.
      if (/SmallSample\./.test(line)) return;

      /*
       * A ternary puts the guard above the branch that builds the string, so
       * a continuation line has to be allowed to inherit it -- but ONLY a
       * continuation. An earlier attempt accepted any SmallSample call within
       * three lines, and a bare percentage inserted directly above a genuine
       * one passed. The guard has to belong to THIS expression: walk up only
       * while the lines are continuations (`?` / `:` / an unclosed operator)
       * and stop at the first line that is not.
       */
      let inherited = false;
      if (/^[?:]/.test(trimmed)) {
        for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
          const up = lines[j].trim();
          if (/SmallSample\./.test(up)) { inherited = true; break; }
          if (!/^[?:]/.test(up) && !/[=(,?:]$/.test(up)) break;
        }
      }
      if (inherited) return;

      // Bar widths are a drawing instruction, not a claim about a population.
      if (/width|style\.|\.style|maxWidth/.test(line)) return;
      const named = lines.slice(Math.max(0, i - 6), i + 2).join('\n');
      if (NOT_A_SAMPLED_RATE.some((e) => e.match.test(named))) return;
      offenders.push(`${rel}:${i + 1} ${trimmed.slice(0, 70)}`);
    });
  }
  t('no rate is rendered as a bare percentage',
    offenders.length === 0,
    `${offenders.join(' | ')} -- route it through SmallSample, or add it to NOT_A_SAMPLED_RATE with a reason`);
  t(`and every exemption is named with a reason (${NOT_A_SAMPLED_RATE.length})`,
    NOT_A_SAMPLED_RATE.every((e) => e.why && e.why.length > 40),
    'an exemption without a written reason is just a hole');
}

// ---- the bar widths are deliberately NOT thresholded ----------------------

{
  const s = fs.readFileSync(path.join(ROOT, 'admin/analytics/index.html'), 'utf8');
  const barLines = s.split('\n').filter((l) => /\/ max \* 100|\/ max\) \* 100/.test(l));
  t(`bar widths still compute freely (${barLines.length} found)`,
    barLines.length > 0 && barLines.every((l) => !/SmallSample\./.test(l)),
    'a bar width got thresholded -- that leaves gaps in a chart rather than honesty');
}

const ok = fail === 0;
console.log(
  `\nsmall-sample-rates ${ok ? 'OK' : 'FAILED'} -- threshold ${threshold}, ` +
  `${SITES.length} page(s) routed through one helper, bar widths exempt.`
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
