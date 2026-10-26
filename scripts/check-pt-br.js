#!/usr/bin/env node
'use strict';

/*
 * The Portuguese (Brazil) landing page and its privacy page say only what the
 * owner approved, and cannot go live half-finished.
 *
 *   node scripts/check-pt-br.js        (part of `npm test`)
 *
 * Owner's brief, 2026-10-25: one pt-BR page at /pt-br/ for Brazilian
 * importers, packers, distributors, food-service and private-label buyers --
 * quote and sample requests, not ecommerce. Its decisions, held here:
 *
 *   - Language and search: <html lang="pt-BR">, a self canonical, og:locale
 *     pt_BR, and NO hreflang pairing in either direction (no English or
 *     Arabic page is its equivalent). Structured data is a WebPage and a
 *     BreadcrumbList only: no FAQ, no offers, no areaServed.
 *   - Claims: the approved wording only. The minimum order is "um contêiner
 *     completo (FCL)" with no tonnage and no LCL (C-140); import requirements
 *     are "confirmed with the buyer's importer and customs broker during
 *     quotation", and nothing else about Brazil -- no tariff, Mercosur, Anvisa
 *     or Brazil-specific shipping; no export history; certificates only in
 *     the approved neutral sentence; no cultivar, Kalamata or Hamed in any
 *     spelling.
 *   - Range: the seven products of scripts/products.js, in its order, each
 *     with its forms. No filling is named in Portuguese (owner, 2026-10-26):
 *     only «azeitonas verdes recheadas», until the owner confirms the filling
 *     and adds it in all three languages together.
 *   - Hours and reply time (owner, 2026-10-26): Sunday to Thursday, 9am to
 *     6pm, Cairo time; a reply within 24 hours Sunday to Thursday and within
 *     two business days for a request that arrives on Friday or Saturday;
 *     WhatsApp messages any time, never an instant or guaranteed answer.
 *   - Form: the shared handler; Portuguese labels over the English values the
 *     CRM files by; the page's own address as the source page.
 *   - Draft: while the pages still say noindex (a Brazilian reader and
 *     counsel's LGPD review are outstanding), the pages stay out of search, out of the sitemap and
 *     llms.txt, and nothing outside /pt-br/ links to them -- including the
 *     line on /contact/, which goes live only once someone can answer in
 *     Portuguese. Publishing is one deliberate change that flips all of it.
 */

const fs = require('fs');
const path = require('path');
const P = require('./products');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const LANDING = 'pt-br/index.html';
const PRIVACY = 'pt-br/privacidade/index.html';
const PAGES = { [LANDING]: 'https://olivesegypt.com/pt-br/', [PRIVACY]: 'https://olivesegypt.com/pt-br/privacidade/' };

// The approved sentences, word for word.
const MOQ = 'Pedido mínimo: um contêiner completo (FCL).';
const IMPORT = 'Os requisitos para importação no Brasil são confirmados com o importador e o despachante aduaneiro do comprador durante a cotação.';
const SAMPLE = 'Antes do pedido, você pode solicitar uma amostra de 1 a 5 kg.';
const PRICES = 'Preços e embalagens são confirmados na cotação.';
const CERTIFICATES = 'Certificações da unidade parceira: em verificação com os documentos originais dos certificados. Nenhum nome, número, organismo emissor, escopo ou validade de certificado aparece neste site até que essa verificação seja concluída.';
const REPLY = 'Respondemos em até 24 horas de domingo a quinta-feira (horário do Cairo, 5 a 6 horas à frente de Brasília, conforme a estação). Mensagens recebidas na sexta ou no sábado são respondidas em até dois dias úteis (domingo a quinta).';
// "Como funciona" points to it; the promise itself is printed twice, on the contact card and in the form (owner, round 3).
const REPLY_POINTER = 'Prazo de resposta: veja Fale conosco, abaixo.';
// Owner, 2026-10-26 (C-188): the Egypt–Mercosur agreement, narrowed. In force,
// origin rules and certificate, other taxes, confirmed with the buyer's
// importer and broker -- no NCM code, category, phase-out date, no claim that
// our goods qualify or that we supply the certificate.
const FTA_HEADING = 'Acordo de Livre Comércio Mercosul–Egito';
const FTA = 'O Acordo de Livre Comércio entre o Mercosul e o Egito está em vigor desde 1º de setembro de 2017. A preferência tarifária vale apenas para mercadorias que cumprem as regras de origem do acordo e são acompanhadas de um certificado de origem. Os demais tributos de importação continuam valendo. A classificação e o tratamento tarifário são confirmados com o importador e o despachante aduaneiro do comprador antes de cada importação.';
const HOURS = 'Atendimento de domingo a quinta-feira, das 9h às 18h (horário do Cairo).';
const WHATSAPP_ANY_TIME = 'Você pode nos enviar uma mensagem pelo WhatsApp a qualquer hora.';
const LEGAL_NAME = 'Triple Company for Industrial Development';
const WHATSAPP = '201006045961';
// What /contact/ and /ar/contact/ will carry once the page is published
// (owner, decision 2, option a).
const SWITCHER = 'Compradores no Brasil: atendimento em português';
const LLMS_LINE = '- Languages: English, Arabic; one Portuguese (Brazil) landing page at /pt-br/';

// Phrases that name a banned word in a sentence the owner approved, or the
// privacy policy's account of a form field; removed before the scan.
const ALLOWED = [
  CERTIFICATES,
  FTA_HEADING,
  FTA,
  REPLY,
  'certificações exigidas',
  'Ela não certifica nem declara conformidade',
];

const BANNED = [
  [/certifica|\bISO\b|HACCP|\bBRC\b|\bIFS\b|halal|kosher/i, 'a certification (only the approved neutral sentence may speak of them)'],
  [/exporta(mos|ndo)? (há|desde)|anos de (experiência|mercado|exportação)|tradição de|líder (de|do|no) mercado|maior (exportador|fornecedor)/i, 'export history or standing'],
  [/garant(o|e|imos|ia|ido|ida)/i, 'a guarantee'],
  [/anvisa|\bMAPA\b|mercosul|mercosur|tarifa|imposto|\bisen(to|ta|ção)|alíquota|\bNCM\b|licença de importação|registro no brasil/i, 'a Brazilian import, tax or compliance claim'],
  [/frete (para|até) o brasil|entrega(mos)? no brasil|porto de santos|\bsantos\b|\bparanaguá\b|\bitajaí\b|trânsito de \d|dias até o brasil/i, 'a Brazil-specific shipping claim'],
  [/categoria [A-E]\b|desgrava|elimina(do|da|ção) (da|das|do) (tarifa|imposto)|\b(2005|0711)\.\d|qualifica(m|dos?|das?)? para|emitimos|fornecemos o certificado/i, 'a tariff code, category, phase-out date or qualification claim (owner: docs only, C-188)'],
  [/vácuo/i, 'vacuum packing (not offered, C-151)'],
  [/outros recheios|recheios? (sob consulta|a pedido|personalizados)/i, 'a filling beyond pepper or carrot (C-152)'],
  [/\bLCL\b|menos de (um|1) contêiner|carga fracionada|pedido (de )?teste/i, 'an order below a full container (C-140)'],
  [/tonelada|\b\d+([.,]\d+)?\s?(MT|t)\b/i, 'a tonnage (none is stated, C-140)'],
  [/premium|\bfin[oa]s? sabor|melhor(es)? (azeitona|qualidade)|orgânic/i, 'a quality claim the register does not hold (C-160)'],
  [/24 horas|dois dias úteis|resposta (imediata|garantida|instantânea)|respondemos (imediatamente|na hora|em minutos)|imediatamente/i, 'a reply-time promise outside the approved wording (C-186)'],
  [/unidade parceira (aprovada|homologada|credenciada|autorizada)|aprovad[ao]s? pel[ao]s?|homologad/i, 'an approval the register does not hold: the partner facility is "uma unidade parceira" (owner, round 3)'],
  [/pimentão|\bpimenta\b|cenoura|\brecheio|recheadas? (com|de)\b|amêndoa|\balho\b|anchova|\bqueijo|\batum\b|limão/i, 'a filling: no filling is named in Portuguese until the owner confirms it (2026-10-26)'],
  [/Companhia Tripla|Empresa Tripla|Triple Companhia|Companhia Triple/i, 'a translated legal name'],
];
for (const c of P.CULTIVARS) for (const n of new Set([c.en, ...(c.pt || [])])) BANNED.push([new RegExp(`\\b${n}\\b`, 'i'), `the cultivar name ${n}`]);
for (const k of P.NEVER_NAMED) for (const n of new Set([k.en, ...(k.pt || [])])) BANNED.push([new RegExp(`\\b${n}\\b`, 'i'), `${n}, never named`]);
for (const w of P.WITHDRAWN) for (const n of w.names) BANNED.push([new RegExp(`\\b${n}\\b`, 'iu'), `${n}, withdrawn`]);

const problems = [];
const fail = (msg) => problems.push(msg);

// The landing page's section heading for the certificates sentence.
const ALLOWED_HEADING = /<h2 class="[^"]*">Certificados<\/h2>/;

function visibleText(html) {
  const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0].replace(ALLOWED_HEADING, ' ');
  return main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '—').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#x27;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1').trim();
}
const meta = (html, re) => (html.match(re) || [])[1];

// ---- every Portuguese page --------------------------------------------------
const html = {};
for (const [file, url] of Object.entries(PAGES)) {
  if (!fs.existsSync(path.join(ROOT, file))) { fail(`${file}: missing`); continue; }
  const h = html[file] = read(file);
  if (!/<html lang="pt-BR">/.test(h)) fail(`${file}: <html lang> is not "pt-BR"`);
  if (meta(h, /<link rel="canonical" href="([^"]*)"/) !== url) fail(`${file}: the canonical is not its own address, ${url}`);
  if (/<link rel="alternate" hreflang/.test(h)) fail(`${file}: carries an hreflang pairing; no English or Arabic page is its equivalent`);
  if (meta(h, /<meta property="og:locale" content="([^"]*)"/) !== 'pt_BR') fail(`${file}: og:locale is not pt_BR`);
  if (/og:locale:alternate/.test(h)) fail(`${file}: has an og:locale:alternate`);
  if (!h.includes(LEGAL_NAME)) fail(`${file}: does not name ${LEGAL_NAME}`);

  for (const block of h.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    let data;
    try { data = JSON.parse(block.replace(/^<script[^>]*>|<\/script>$/g, '')); } catch (e) { fail(`${file}: a JSON-LD block does not parse`); continue; }
    const nodes = data['@graph'] || [data];
    const types = JSON.stringify(data).match(/"@type":"[^"]*"/g) || [];
    const bad = types.map((x) => x.slice(9, -1)).filter((x) => !['WebPage', 'BreadcrumbList', 'ListItem'].includes(x));
    if (bad.length) fail(`${file}: structured data defines ${[...new Set(bad)].join(', ')}; only WebPage and BreadcrumbList are allowed`);
    if (/"(offers|areaServed|aggregateRating|review|priceRange)"/.test(JSON.stringify(data))) fail(`${file}: structured data carries offers, areaServed or ratings`);
    const page = nodes.find((n) => n['@type'] === 'WebPage');
    if (!page || page.inLanguage !== 'pt-BR' || page.url !== url) fail(`${file}: no WebPage node in pt-BR for ${url}`);
  }

  let text = visibleText(h);
  for (const a of ALLOWED) text = text.split(a).join(' ');
  for (const [re, why] of BANNED) {
    const m = text.match(re);
    if (m) fail(`${file}: says "${text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).trim()}" -- ${why}`);
  }
}
// ...and nothing else on the site points a search engine at them as a twin.
for (const f of require('./locale-routes').listRoutes().map((r) => path.relative(ROOT, require('./locale-routes').pageFile(r)))) {
  if (f.startsWith('pt-br') || !f.endsWith('.html') || !fs.existsSync(path.join(ROOT, f))) continue;
  if (/hreflang="pt|hreflang="x-default" href="https:\/\/olivesegypt\.com\/pt-br/.test(read(f))) fail(`${f}: pairs itself with the Portuguese page by hreflang`);
}

const landing = html[LANDING] || '';
const ltext = visibleText(landing);

// ---- the approved commercial sentences -------------------------------------
{
  const f = landing.split(FTA).length - 1;
  if (f !== 1) fail(`${LANDING}: the Mercosul–Egito paragraph is printed ${f} time(s), not once (C-188)`);
  const n = landing.split(REPLY).length - 1;
  if (n !== 2) fail(`${LANDING}: the reply time is printed ${n} time(s); it belongs on the contact card and in the form, twice (owner, round 3)`);
}
for (const [s, what] of [[FTA_HEADING, 'the Mercosul–Egito heading'], [FTA, 'the Mercosul–Egito paragraph (C-188)'], [REPLY_POINTER, 'the pointer to the reply time in "Como funciona"'], [REPLY, 'the reply time'], [HOURS, 'the hours'], [WHATSAPP_ANY_TIME, 'the WhatsApp line'],
  [MOQ, 'the minimum order'], [IMPORT, 'the import-requirements sentence'], [SAMPLE, 'the sample'],
  [PRICES, 'prices confirmed during quotation'], [CERTIFICATES, 'the certificates placeholder']]) {
  if (!ltext.includes(s)) fail(`${LANDING}: ${what} is not in the approved wording: "${s}"`);
}

// ---- the range: seven products, in order, with their forms -----------------
const cards = [...landing.matchAll(/<h3 class="font-semibold text-foreground mb-1">([^<]*)<\/h3><p[^>]*>([\s\S]*?)<\/p>/g)]
  .map((m) => ({ name: m[1], line: m[2].replace(/<[^>]+>/g, '') }));
const names = cards.map((c) => c.name);
const want = P.PRODUCTS.map((p) => p.pt);
if (JSON.stringify(names) !== JSON.stringify(want)) fail(`${LANDING}: the product cards are ${JSON.stringify(names)}, not ${JSON.stringify(want)} (scripts/products.js order)`);
for (const p of P.PRODUCTS) {
  const card = cards.find((c) => c.name === p.pt);
  if (!card || !P.FORMS[p.key]) continue;
  // The stuffed card is held to its forms too (pitted, owner 2026-10-26); its filling is never named.
  for (const [form, words] of Object.entries(P.FORM_WORDS)) {
    if (form === 'stuffed') continue;
    const has = card.line.toLowerCase().includes(words.pt);
    if (has !== P.FORMS[p.key].includes(form)) fail(`${LANDING}: ${p.pt} ${has ? 'says' : 'does not say'} "${words.pt}" (C-155)`);
  }
}
for (const p of P.PRODUCTS.filter((x) => x.category === 'black')) {
  const card = cards.find((c) => c.name === p.pt);
  if (card && /rechead/i.test(card.line)) fail(`${LANDING}: ${p.pt} are said to be stuffed; black olives never are (C-155)`);
}
if (/azeitonas pretas recheadas/i.test(ltext)) fail(`${LANDING}: black olives are never stuffed (C-155)`);
if (P.FILLINGS.pt) fail('scripts/products.js: FILLINGS.pt names a Portuguese filling; none is named until the owner confirms it');

// ---- the form ------------------------------------------------------------------
const optionValues = (h, id) => [...((h.match(new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`)) || [''])[0])
  .matchAll(/<option(?: value="([^"]*)")?>([^<]*)<\/option>/g)].map((m) => (m[1] === undefined ? m[2] : m[1])).filter(Boolean);
const en = read('contact/index.html');
if (JSON.stringify(optionValues(landing, 'contact-product')) !== JSON.stringify(optionValues(en, 'contact-product'))) {
  fail(`${LANDING}: the product options do not submit the English form's values, in its order -- the CRM files enquiries by them`);
}
const vols = optionValues(landing, 'contact-volume');
const enVols = optionValues(en, 'contact-volume');
if (!vols.length || vols.some((v) => !enVols.includes(v))) fail(`${LANDING}: a volume option submits a value the English form does not have: ${vols.filter((v) => !enVols.includes(v)).join(', ')}`);
if (!/href="\/pt-br\/privacidade\/"/.test((landing.match(/<form id="contact-form"[\s\S]*?<\/form>/) || [''])[0])) fail(`${LANDING}: no privacy notice linking /pt-br/privacidade/ inside the form`);

// The shared scripts speak Portuguese on these pages, with every string the
// English has, and the form records the page itself as its source.
function stringKeys(src, locale) {
  const m = src.match(new RegExp(`\\n {4}${locale}: \\{([\\s\\S]*?)\\n {4}\\}`));
  return m ? [...m[1].matchAll(/^\s+([a-zA-Z]+):/gm)].map((x) => x[1]).sort() : [];
}
for (const [file, extra] of [['assets/consent.js', []], ['assets/inquiry-form.js', ['rate']]]) {
  const src = read(file);
  const missing = stringKeys(src, 'en').filter((k) => !stringKeys(src, 'pt').includes(k));
  if (!stringKeys(src, 'pt').length || missing.length) fail(`${file}: the Portuguese strings are missing ${missing.join(', ') || 'entirely'}`);
  for (const k of extra) if (!stringKeys(src, 'pt').includes(k)) fail(`${file}: no Portuguese "${k}" string`);
  if (!/slice\(0, 2\) === 'pt' \? 'pt'/.test(src)) fail(`${file}: never picks the Portuguese strings for a pt-BR page`);
}
if (!read('assets/consent.js').includes("privacyHref: '/pt-br/privacidade/'")) fail('assets/consent.js: the Portuguese banner does not link /pt-br/privacidade/');
if (!/pathname\)\) return window\.location\.origin \+ '\/pt-br\/'/.test(read('assets/inquiry-form.js'))) fail('assets/inquiry-form.js: the Portuguese form does not record /pt-br/ as its source page');
{
  const pt = (read('assets/inquiry-form.js').match(/\n {4}pt: \{([\s\S]*?)\n {4}\}/) || ['', ''])[1];
  for (const key of ['contactSuccess', 'sampleSuccess']) {
    const msg = (pt.match(new RegExp(`${key}: '([^']*)'`)) || [])[1] || '';
    if (!/em até 24 horas de domingo a quinta-feira \(horário do Cairo\); se el[ae] chegou na sexta ou no sábado, em até dois dias úteis \(domingo a quinta\)\./.test(msg)) {
      fail(`assets/inquiry-form.js: the Portuguese ${key} does not give the reply time as approved (24 hours Sunday to Thursday, two business days from Friday or Saturday)`);
    }
    if (/imediat|garantid|instantâne/i.test(msg)) fail(`assets/inquiry-form.js: the Portuguese ${key} promises an instant or guaranteed reply`);
  }
}
if (!/pt \? 'Solicitar cotação'/.test(read('assets/site-nav.js'))) fail('assets/site-nav.js: the quote button has no Portuguese label');

// ---- WhatsApp: the company number, with a Portuguese message ---------------
const wa = [...((landing.match(/<main[\s\S]*?<\/main>/) || [''])[0]).matchAll(/href="https:\/\/wa\.me\/([^"?]*)([^"]*)"/g)];
if (!wa.length) fail(`${LANDING}: no WhatsApp link`);
for (const m of wa) {
  if (m[1] !== WHATSAPP) fail(`${LANDING}: a WhatsApp link goes to ${m[1]}, not the company number`);
  const text = new URLSearchParams(m[2].replace(/^\?/, '').replace(/&amp;/g, '&')).get('text');
  if (!text || !/Brasil/.test(text)) fail(`${LANDING}: a WhatsApp link has no prefilled Portuguese message`);
}

// ---- draft or published, never in between ----------------------------------
const noindex = Object.keys(PAGES).map((f) => /<meta name="robots" content="noindex/.test(html[f] || ''));
const draft = noindex.some(Boolean);
const sitemap = read('sitemap.xml');
const listed = Object.values(PAGES).filter((u) => sitemap.includes(`<loc>${u}</loc>`));
const inSitemap = listed.length > 0;
const linkers = require('./locale-routes').listRoutes()
  .map((r) => path.relative(ROOT, require('./locale-routes').pageFile(r)))
  .filter((f) => !f.startsWith('pt-br') && f.endsWith('.html') && fs.existsSync(path.join(ROOT, f)) && /href="\/pt-br\//.test(read(f)));
const llms = read('llms.txt');
if (draft) {
  if (!noindex.every(Boolean)) fail('draft (a page is noindex): every Portuguese page must say noindex until all of them can be published');
  if (inSitemap) fail('draft: the Portuguese pages are in sitemap.xml');
  if (linkers.length) fail(`draft: ${linkers.join(', ')} link(s) to /pt-br/; nothing outside it may until it is published`);
  if (/pt-br/i.test(llms)) fail('draft: llms.txt mentions the Portuguese page');
} else {
  if (listed.length !== Object.keys(PAGES).length) fail(`published: sitemap.xml lists ${listed.length} of the ${Object.keys(PAGES).length} Portuguese pages`);
  if (/<loc>https:\/\/olivesegypt\.com\/pt-br\/[^<]*<\/loc>\s*<lastmod>[^<]*<\/lastmod>\s*<xhtml:link/.test(sitemap)) fail('published: a Portuguese sitemap entry carries language alternates');
  for (const f of ['contact/index.html', 'ar/contact/index.html']) {
    if (!new RegExp(`<a href="/pt-br/"[^>]*>${SWITCHER}`).test(read(f))) fail(`published: ${f} does not carry the approved line "${SWITCHER}"`);
  }
  if (!llms.includes(LLMS_LINE)) fail(`published: llms.txt does not carry the approved line "${LLMS_LINE}"`);
}

if (problems.length) {
  console.error(`pt-br: ${problems.length} problem(s):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`pt-br OK -- ${Object.keys(PAGES).length} pages in pt-BR with their own canonical and no hreflang pairing; only approved claims, ` +
  `${want.length} products in order with their forms, the form's values the English ones; ` +
  (draft ? 'DRAFT: noindex, unlisted and unlinked' : 'published') + '.');
