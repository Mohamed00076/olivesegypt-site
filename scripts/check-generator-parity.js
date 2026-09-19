#!/usr/bin/env node
'use strict';

/*
 * The page generator still reproduces the pages it generated.
 *
 *   node scripts/check-generator-parity.js        (part of `npm test`)
 *
 * WHAT WENT WRONG
 *
 * generate-product-pages.py had drifted from its own output. The ten pages
 * under /products had gained the consent, locale-switch, site-nav and
 * analytics scripts, hreflang alternates, the favicon family, the theme
 * bootstrap, the rebuilt navigation with its dropdown panels and mobile
 * drawer, the Facebook pill, the theme toggle and the footer columns, and had
 * lost an offers/InStock block from the Product schema. The template kept
 * emitting the shape they had before all of that, so one run would have
 * written 401 lines in and 611 lines out across ten live pages.
 *
 * It was not that the generator was never maintained: the WhatsApp button and
 * the insights tab were added to it during the floating-actions work, and the
 * logo's dimensions the day this check was written. Only the parts nobody
 * thought to re-check drifted -- which is the difficulty. A generator that is
 * wrong does not say so until it is run, and by then it has overwritten the
 * file it was wrong about. The drift was found by running it, and the run had
 * to be undone from git.
 *
 * There was a second generator, for the seven /resources pages, and it was
 * worse: it read its header and footer at import time from two files under an
 * ephemeral /tmp/claude-0/.../scratchpad/ path committed on 2026-09-01, so on
 * any fresh checkout it raised FileNotFoundError before generating anything.
 * It was RETIRED on 2026-09-19 (C-95) rather than kept: nothing ran it -- no
 * build step, no CI, no npm script, no runbook -- while those seven pages had
 * been edited by hand 33 times since it was written. A generator nobody runs
 * is a second source of truth for pages somebody does edit, and a parity check
 * makes that visible without making it untrue.
 *
 * This list is still a list for that reason. A generator earns a place in it by
 * being run by something; one that is not should be deleted instead.
 *
 * WHAT THIS ASSERTS
 *
 * Each generator, run into a scratch directory, produces byte-for-byte what is
 * committed. Every file it writes is compared, at whatever depth, so a hub page
 * written beside the per-slug directories is covered rather than skipped. Editing a generated page by hand fails this check, and so does
 * editing the template without regenerating -- which is the point: the two
 * have to move together or the site has two sources of truth for one page.
 *
 * It renders into a temporary directory, never into the working tree, so
 * running the suite cannot itself do what this check exists to prevent.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GENERATORS = [
  { script: 'scripts/generate-product-pages.py', dir: 'products' },
];

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

let checked = 0;

for (const gen of GENERATORS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'genparity-'));
  try {
    let ran = true, err = '';
    try {
      execFileSync('python3', [path.join(ROOT, gen.script), tmp], { cwd: ROOT, stdio: 'pipe' });
    } catch (e) {
      ran = false;
      err = (e.stderr ? e.stderr.toString() : e.message).trim().split('\n').slice(-2).join(' ');
    }
    t(`${gen.script} runs`, ran, err);
    if (!ran) continue;

    // Collect every file the generator wrote, at whatever depth. One writes
    // <slug>/index.html only; the other also writes a hub page beside them, so
    // walking the tree is what keeps this honest about both.
    const produced = [];
    (function collect(dir, rel) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
        const next = rel ? `${rel}/${entry.name}` : entry.name;
        entry.isDirectory() ? collect(path.join(dir, entry.name), next) : produced.push(next);
      }
    })(path.join(tmp, gen.dir), '');

    t(`${gen.script} produced pages`, produced.length > 0, `nothing under ${gen.dir}/`);

    const differs = [], missing = [];
    for (const rel of produced) {
      const got = path.join(tmp, gen.dir, rel);
      const want = path.join(ROOT, gen.dir, rel);
      if (!fs.existsSync(want)) { missing.push(rel); continue; }
      checked++;
      if (!fs.readFileSync(got).equals(fs.readFileSync(want))) differs.push(rel);
    }

    const show = (l) => `${l.length}: ${l.slice(0, 6).join(', ')}${l.length > 6 ? ' …' : ''}`;
    t(`every page ${gen.script} writes is committed`, missing.length === 0, show(missing));
    t(`and matches the committed page byte for byte (${produced.length} page(s))`,
      differs.length === 0, show(differs));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (fail === 0) {
  console.log(`\ngenerator-parity OK -- ${checked} generated page(s) match what is committed.`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
