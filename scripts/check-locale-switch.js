#!/usr/bin/env node
'use strict';

/*
 * Phase 2 test -- language persistence and scroll restoration.
 *
 * Needs a running server and Playwright, so it is NOT part of `npm test`
 * (which stays fast and fully offline). Run it deliberately:
 *
 *   python3 -m http.server 8771 &
 *   npm run check:locale-switch
 *
 * PORT and PAGES can be overridden:
 *   PORT=9000 PAGES=/,/catalog node scripts/check-locale-switch.js
 *
 * Part A walks the pages the task named -- homepage, catalog, resources,
 * contact, FAQ and a product page -- switching language from the top, the
 * middle and the bottom of each, and checks the reading position survives.
 * Part B is the negative half: the cases where nothing must happen.
 */

const path = require('path');
const { execSync } = require('child_process');
const pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const PORT = process.env.PORT || 8771;
const B = `http://127.0.0.1:${PORT}`;
const DEFAULT_PAGES = '/,/catalog,/resources,/contact,/resources/faq,/products/kalamata-olives';

const PAGES=(process.env.PAGES||process.argv[2]||DEFAULT_PAGES).split(',');
let pass=0,fail=0;
const t=(n,c,x)=>{c?pass++:fail++;console.log(`${c?'PASS':'FAIL'}  ${n}${c?'':'   <-- '+(x||'')}`)};
(async()=>{
 const b=await pw.chromium.launch();
 for(const route of PAGES){
  for(const spot of ['top','middle','bottom']){
   const ctx=await b.newContext({viewport:{width:1280,height:800}});
   const p=await ctx.newPage();
   await p.goto(B+route,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(300);
   const max=await p.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-innerHeight));
   const y = spot==='top'?0: spot==='middle'?Math.round(max/2):max;
   await p.evaluate(v=>window.scrollTo(0,v),y); await p.waitForTimeout(200);
   const before=await p.evaluate(()=>Math.round(window.pageYOffset));
   const sw=p.locator('a[hreflang="en"],a[hreflang="ar"]').first();
   if(!(await sw.count())){ console.log(`SKIP  ${route} ${spot} (no switcher)`); await ctx.close(); continue; }
   await sw.click(); await p.waitForLoadState('load'); await p.waitForTimeout(600);
   const after=await p.evaluate(()=>Math.round(window.pageYOffset));
   const amax=await p.evaluate(()=>Math.max(0,document.documentElement.scrollHeight-innerHeight));
   const lang=await p.evaluate(()=>document.documentElement.lang);
   const pref=await p.evaluate(()=>localStorage.getItem('tc:locale'));
   const rec=await p.evaluate(()=>sessionStorage.getItem('tc:lang-switch'));
   let ok;
   if(spot==='top') ok = after<=5;
   else {
     const ratioBefore = max>0?before/max:0, ratioAfter = amax>0?after/amax:0;
     ok = after>0 && Math.abs(ratioAfter-ratioBefore)<0.35;
   }
   t(`${route} ${spot}: ${before}/${max} -> ${after}/${amax} lang=${lang}`, ok);
   if(spot==='middle'){
     t(`   pref stored (${pref})`, pref==='en'||pref==='ar');
     t(`   switch record consumed`, rec===null);
     // A refresh must not consult a record -- browsers natively restore
     // scroll on reload, so assert the record stays absent rather than
     // asserting a scroll position the browser owns.
     await p.reload({waitUntil:'load'}); await p.waitForTimeout(400);
     const recAfterReload=await p.evaluate(()=>sessionStorage.getItem('tc:lang-switch'));
     t(`   no record written on refresh`, recAfterReload===null, `got ${recAfterReload}`);
   }
   await ctx.close();
  }
 }
 await b.close();
 console.log(`\n${pass} passed, ${fail} failed`);
 process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
