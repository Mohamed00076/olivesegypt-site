#!/usr/bin/env node
'use strict';

/*
 * Every page's tags close in order, and no grid has items left outside it.
 *
 *   node scripts/check-html-structure.js        (part of `npm test`)
 *
 * Until 2026-10-04 the guides grid on /downloads and /ar/downloads was closed
 * after its third card -- the grid as it stood when there were three guides
 * (PR #27). The five guides added later went in after the closing tags, so
 * they rendered below the grid as full-width blocks, wider than the page's
 * content column, while the first three sat side by side. The owner spotted
 * it from a screenshot. The page's tags balanced overall (two early closes,
 * two missing ones later), so no balance count would have caught it; what
 * gave it away was cards of the same kind on both sides of the grid's end.
 *
 * Two rules, over every tracked page:
 *
 *   1. Tags close in order. A closing tag that matches no open element, or
 *      that closes an element while elements opened inside it are still
 *      open, or an element still open at the end of the page, fails. (The
 *      browser repairs all of these silently, which is how such slips go
 *      unseen: it repairs them by guessing.)
 *   2. No grid item outside its grid. An element with the same tag and class
 *      as a grid's own items (a `grid` class), sitting after that grid but
 *      outside the grid's container, within the same section, is a card that
 *      missed the grid, and fails. (Right beside the grid, in the same
 *      container, is allowed: forms do it on purpose.) Checked against the
 *      Downloads pages as they were before the fix: it finds all five cards
 *      in each.
 *
 * Each rule is first run against small built-in examples, one that must pass
 * and one that must fail, so a rule that stopped detecting anything would
 * fail here rather than pass every page.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Raw-text elements: their content is not markup.
const RAW = new Set(['script', 'style', 'textarea', 'title']);

/** Parses html into a tree, collecting tag-order problems as it goes. */
function parse(html) {
  const problems = [];
  const root = { tag: '#root', cls: '', children: [], line: 0 };
  const stack = [root];
  const tagRe = /<!--[\s\S]*?-->|<!doctype[^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
  let m;
  let line = 1;
  let last = 0;
  while ((m = tagRe.exec(html))) {
    line += (html.slice(last, m.index).match(/\n/g) || []).length;
    last = m.index;
    if (!m[2]) continue; // comment or doctype
    const tag = m[2].toLowerCase();
    const top = stack[stack.length - 1];
    if (m[1] !== '/') {
      const cls = ((m[3] || '').match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/) || []);
      const node = { tag, cls: (cls[1] || cls[2] || '').trim().replace(/\s+/g, ' '), children: [], line, parent: top };
      top.children.push(node);
      if (VOID.has(tag) || m[4] === '/') continue;
      stack.push(node);
      if (RAW.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, tagRe.lastIndex);
        if (end !== -1) {
          line += (html.slice(tagRe.lastIndex, end).match(/\n/g) || []).length;
          tagRe.lastIndex = end;
          last = end;
        }
      }
      continue;
    }
    // A closing tag.
    if (top.tag === tag) { stack.pop(); continue; }
    let i = stack.length - 1;
    while (i > 0 && stack[i].tag !== tag) i--;
    if (i === 0) {
      problems.push(`line ${line}: </${tag}> closes nothing that is open (inside <${top.tag}> from line ${top.line})`);
      continue;
    }
    const skipped = stack.slice(i + 1).map((n) => `<${n.tag}> from line ${n.line}`);
    problems.push(`line ${line}: </${tag}> closes <${tag}> from line ${stack[i].line} while ${skipped.join(', ')} ${skipped.length > 1 ? 'are' : 'is'} still open`);
    stack.length = i;
  }
  for (const n of stack.slice(1)) problems.push(`line ${n.line}: <${n.tag}> is never closed`);
  return { root, problems };
}

/**
 * Elements that look like a grid's items but sit outside the grid's own
 * container: after it, a level or more further out, inside the same section.
 * An element straight after the grid, beside it in the same container, is
 * left alone -- forms put full-width fields after a two-column grid of short
 * ones on purpose (/contact, /sample). Cards that end up outside the grid's
 * container got there by a closing tag in the wrong place.
 */
const SECTION = new Set(['section', 'main', 'body', 'article', 'form', '#root']);
function spilledGridItems(root) {
  const found = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.cls.split(' ').includes('grid') && child.children.length) {
        const itemKinds = new Set(child.children.map((c) => `${c.tag}|${c.cls}`));
        // Climb from the grid's container to the nearest section, checking
        // what follows each level.
        for (let inner = node, outer = node.parent; outer && !SECTION.has(inner.tag); inner = outer, outer = outer.parent) {
          for (const s of outer.children.slice(outer.children.indexOf(inner) + 1)) {
            if (itemKinds.has(`${s.tag}|${s.cls}`)) found.push({ grid: child, item: s });
          }
        }
      }
      walk(child);
    }
  };
  walk(root);
  return found;
}

let pass = 0, fail = 0;
const t = (name, ok, details = []) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) details.slice(0, 12).forEach((d) => console.log('      ' + d));
  if (!ok && details.length > 12) console.log(`      ... and ${details.length - 12} more`);
};

// The rules on known cases first.
const CARD = '<div class="card"><p>x</p></div>';
const okPage = `<main><section><div class="container"><div class="grid cols">${CARD}${CARD}${CARD}</div></div></section></main>`;
// The Downloads bug's shape: the grid and its container closed early, the
// later cards left in the section.
const spilled = `<main><section><div class="container"><div class="grid cols">${CARD}${CARD}</div></div>${CARD}${CARD}</section></main>`;
// A form's full-width fields after a grid of short ones, by design.
const formFields = '<form><div class="grid cols"><div class="f"><input></div><div class="f"><input></div></div><div class="f"><textarea></textarea></div></form>';
const misnested = '<main><div><p>x</div></p></main>';
const stray = '<main><p>x</p></div></main>';
const unclosed = '<main><div><p>x</p></main>';
const voidsAndRaw = '<head><meta charset="utf-8"><script>if (a < b) { x = "</div>"; }</script></head><body><img src="a" alt=""><br><svg><path d="M0 0"/></svg></body>';
t('rule 1 passes balanced markup, void elements, self-closed SVG and script text',
  parse(okPage).problems.length === 0 && parse(voidsAndRaw).problems.length === 0);
t('rule 1 catches a misnested, a stray and an unclosed tag',
  parse(misnested).problems.length > 0 && parse(stray).problems.length > 0 && parse(unclosed).problems.length > 0);
t('rule 2 passes a grid holding all its cards, and full-width fields after a form grid',
  spilledGridItems(parse(okPage).root).length === 0 && spilledGridItems(parse(formFields).root).length === 0);
t('rule 2 catches cards left after a grid (the Downloads bug of 2026-10-04)', spilledGridItems(parse(spilled).root).length === 2);

const pages = execSync('git ls-files "*.html"', { cwd: ROOT }).toString().split('\n')
  .filter((f) => f && !f.startsWith('scripts/') && !f.startsWith('docs/'));

const order = [];
const spills = [];
for (const f of pages) {
  const { root, problems } = parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  problems.forEach((p) => order.push(`${f} ${p}`));
  for (const { grid, item } of spilledGridItems(root)) {
    spills.push(`${f}:${item.line}: <${item.tag} class="${item.cls.slice(0, 50)}"> matches the items of the grid from line ${grid.line} but sits outside that grid's container: a closing tag is probably in the wrong place`);
  }
}
t(`tags close in order on all ${pages.length} pages`, order.length === 0, order);
t(`no grid item sits outside its grid on any of ${pages.length} pages`, spills.length === 0, spills);

console.log(`\nhtml-structure ${fail ? 'FAILED' : 'OK'}\n\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
