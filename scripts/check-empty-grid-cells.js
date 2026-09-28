#!/usr/bin/env node
'use strict';

/*
 * No grid on any page has an empty cell.
 *
 *   node scripts/check-empty-grid-cells.js        (part of `npm test`)
 *
 * On 2026-09-06 the public export-catalogue card came off the Downloads page
 * when the catalogue was gated. Its content went, but its wrapper <div> was
 * left behind, empty, as an item of a three-column grid. It kept its column,
 * so for three weeks the page showed a card, a blank column, a card, and the
 * third card alone on a second row, in both languages. The owner spotted it
 * on 2026-09-28.
 *
 * An empty element directly inside a CSS-grid container takes a cell exactly
 * as a card does. This parses every page and fails on any child of an element
 * carrying the `grid` class that holds neither text nor any element.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// Tags that hold content we cannot see into the same way, or that never
// render as a grid item.
const OPAQUE = new Set(['script', 'style', 'template', 'textarea', 'svg']);

function emptyGridCells(html) {
  const found = [];
  const stack = [];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  let line = 1;
  let last = 0;
  while ((m = re.exec(html))) {
    line += (html.slice(last, m.index).match(/\n/g) || []).length;
    last = m.index;
    if (m[0].startsWith('<!--')) continue;
    if (m[5] !== undefined) {
      if (m[5].trim() && stack.length) stack[stack.length - 1].content = true;
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (!closing) {
      if (stack.length) stack[stack.length - 1].content = true;
      if (VOID.has(tag) || m[4] === '/') continue;
      const cls = ((m[3].match(/\bclass="([^"]*)"/) || [])[1] || '').split(/\s+/);
      stack.push({ tag, grid: cls.includes('grid'), content: OPAQUE.has(tag), line });
      if (OPAQUE.has(tag)) {
        // skip to its end tag
        const end = html.indexOf(`</${tag}`, re.lastIndex);
        if (end !== -1) { line += (html.slice(re.lastIndex, end).match(/\n/g) || []).length; re.lastIndex = end; last = end; }
      }
      continue;
    }
    // closing tag: pop to the matching element
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].tag !== tag) continue;
      const node = stack[i];
      stack.length = i;
      const parent = stack[stack.length - 1];
      if (parent && parent.grid && !node.content) found.push({ line: node.line, tag });
      break;
    }
  }
  return found;
}

const pages = execSync('git ls-files "*.html"', { cwd: ROOT }).toString().split('\n')
  .filter((f) => f && !f.startsWith('scripts/') && !f.startsWith('docs/'));

let pass = 0, fail = 0;
const problems = [];
for (const f of pages) {
  for (const hit of emptyGridCells(fs.readFileSync(path.join(ROOT, f), 'utf8'))) {
    problems.push(`${f}:${hit.line}: an empty <${hit.tag}> is a cell of a grid, and leaves a gap where a card should be`);
  }
}
problems.length ? fail++ : pass++;
console.log(`${problems.length ? 'FAIL' : 'PASS'}  no grid on any of ${pages.length} pages has an empty cell`);
problems.forEach((p) => console.log('      ' + p));

console.log(`\nempty-grid-cells ${fail ? 'FAILED' : 'OK'}\n\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
