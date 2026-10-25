#!/usr/bin/env node
'use strict';

/*
 * No link or button sits inside another link or button, on any page
 * (owner, 2026-10-25).
 *
 *   node scripts/check-nested-controls.js        (part of `npm test`)
 *
 * The catalogue and downloads pages had 40 controls built as a button inside
 * a link: two keyboard stops, and two things for a screen reader to name, for
 * one action. #435, #442 and #443 made each the link alone. This keeps it so:
 * it reads every HTML file in the repository and fails on an <a> or <button>
 * opened while another is still open, in either order.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z', '*.html'], { cwd: ROOT }).toString('utf8').split('\0').filter(Boolean);

const problems = [];
for (const rel of files) {
  // Scripts, styles, comments and templates' text are not markup the browser builds controls from here.
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const open = [];
  for (const m of html.matchAll(/<(\/?)(a|button)\b[^>]*>/gi)) {
    const [tag, close, nameRaw] = m;
    const name = nameRaw.toLowerCase();
    if (close) {
      const i = open.lastIndexOf(name);
      if (i >= 0) open.splice(i, 1);
      continue;
    }
    if (open.length) {
      const line = html.slice(0, m.index).split('\n').length;
      problems.push(`${rel}:${line}: <${name}> inside <${open[open.length - 1]}>: ${tag.slice(0, 80)}`);
    }
    open.push(name);
  }
}

if (problems.length) {
  console.error(`nested-controls: ${problems.length} link(s) or button(s) inside another -- make each a single control:\n  ` + problems.slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log(`nested-controls OK -- no link or button sits inside another, in ${files.length} HTML files.`);
