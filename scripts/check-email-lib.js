'use strict';

/*
 * Phase 7 test -- behavioural checks on netlify/functions/_email_lib.js.
 *
 *   node scripts/check-email-lib.js        (part of `npm test`)
 *
 * Runs entirely offline: global.fetch is stubbed, so nothing is sent and no
 * API key is needed. Covers the things that are easy to break silently --
 * multi-recipient parsing, the dry-run adapter, retry policy, and the rule
 * that logs carry a message id and a form type but never a body, a
 * recipient address or a credential.
 */

const nodePath = require('path');
const path = nodePath.join(__dirname, '..', 'netlify', 'functions', '_email_lib.js');
function fresh(env){ for(const k of Object.keys(env)) process.env[k]=env[k];
  delete require.cache[require.resolve(path)]; return require(path); }
function clearEnv(){ ['RESEND_API_KEY','NOTIFY_EMAIL','NOTIFY_FROM_EMAIL','NOTIFY_DRY_RUN','LEADS_NOTIFY'].forEach(k=>delete process.env[k]); }

let logs=[]; const realLog=console.log, realErr=console.error;
function cap(){ logs=[]; console.log=(...a)=>logs.push(['log',a.join(' ')]); console.error=(...a)=>logs.push(['err',a.join(' ')]); }
function rel(){ console.log=realLog; console.error=realErr; }

(async()=>{
 let pass=0, fail=0;
 // Also exercised: the LEADS_NOTIFY gate that keeps gated-guide
 // notifications off until the owner turns them on.
 const t=(name,cond,extra)=>{ (cond?pass++:fail++); realLog(`${cond?'PASS':'FAIL'}  ${name}${cond?'':'   <-- '+(extra||'')}`); };

 // 1. multi-recipient parsing
 clearEnv(); let m=fresh({NOTIFY_EMAIL:'a@x.com, b@x.com ;c@x.com'});
 t('NOTIFY_EMAIL splits on comma and semicolon', JSON.stringify(m.notifyRecipients())==='["a@x.com","b@x.com","c@x.com"]', JSON.stringify(m.notifyRecipients()));

 // 2. single address still works (backward compatible)
 clearEnv(); m=fresh({NOTIFY_EMAIL:'only@x.com'});
 t('single NOTIFY_EMAIL still yields one recipient', JSON.stringify(m.notifyRecipients())==='["only@x.com"]');

 // 3. no api key -> skipped, no throw, returns false
 clearEnv(); m=fresh({NOTIFY_EMAIL:'a@x.com'}); cap();
 let r=await m.sendNotification('s','body',{formType:'inquiry'}); rel();
 t('no RESEND_API_KEY -> false, no throw', r===false);
 t('   logged as skipped with form type', logs.some(([,l])=>l.includes('status=skipped')&&l.includes('form=inquiry')), JSON.stringify(logs));

 // 4. no NOTIFY_EMAIL -> skipped
 clearEnv(); m=fresh({RESEND_API_KEY:'k'}); cap();
 r=await m.sendNotification('s','b',{formType:'lead:buyers_guide'}); rel();
 t('no NOTIFY_EMAIL -> false', r===false);
 t('   log names NOTIFY_EMAIL, not its value', logs.some(([,l])=>l.includes('NOTIFY_EMAIL not set')));

 // 5. dry run: does not call the network, returns true, logs no body
 clearEnv(); m=fresh({RESEND_API_KEY:'k',NOTIFY_EMAIL:'a@x.com,b@x.com',NOTIFY_DRY_RUN:'1'});
 const realFetch=global.fetch; let called=0; global.fetch=async()=>{called++;throw new Error('should not be called');};
 cap(); r=await m.sendNotification('subj','SECRET BODY TEXT',{formType:'inquiry'}); rel(); global.fetch=realFetch;
 t('dry run returns true and sends nothing', r===true && called===0, `r=${r} calls=${called}`);
 t('   dry-run log contains no body text', !logs.some(([,l])=>l.includes('SECRET BODY')), JSON.stringify(logs));

 // 6. real send path: payload shape, reply_to, no key in logs
 clearEnv(); m=fresh({RESEND_API_KEY:'sk_secret_value',NOTIFY_EMAIL:'a@x.com,b@x.com',NOTIFY_FROM_EMAIL:'s@olivesegypt.com'});
 let seen=null; global.fetch=async(u,o)=>{seen={u,o}; return {ok:true,status:200,json:async()=>({id:'msg_123'})};};
 cap(); r=await m.sendNotification('subj','BODY',{replyTo:'buyer@corp.com',formType:'inquiry:quote'}); rel(); global.fetch=realFetch;
 const p=JSON.parse(seen.o.body);
 t('sends to all recipients', JSON.stringify(p.to)==='["a@x.com","b@x.com"]', JSON.stringify(p.to));
 t('sets reply_to to the enquirer', p.reply_to==='buyer@corp.com');
 t('uses NOTIFY_FROM_EMAIL as sender', p.from==='s@olivesegypt.com');
 t('logs the provider message id', logs.some(([,l])=>l.includes('message_id=msg_123')));
 t('logs the form type', logs.some(([,l])=>l.includes('form=inquiry:quote')));
 t('never logs the API key', !logs.some(([,l])=>l.includes('sk_secret_value')));
 t('never logs the body', !logs.some(([,l])=>l.includes('BODY')));
 t('never logs recipient addresses', !logs.some(([,l])=>l.includes('a@x.com')));

 // 7. retry on 500, not on 422
 clearEnv(); m=fresh({RESEND_API_KEY:'k',NOTIFY_EMAIL:'a@x.com',NOTIFY_FROM_EMAIL:'s@o.com'});
 let n=0; global.fetch=async()=>{n++; return {ok:false,status:500,text:async()=>'boom'};};
 cap(); r=await m.sendNotification('s','b',{formType:'inquiry'}); rel(); global.fetch=realFetch;
 t('retries once on 500 then gives up', n===2 && r===false, `attempts=${n} r=${r}`);
 n=0; global.fetch=async()=>{n++; return {ok:false,status:422,text:async()=>'unverified domain'};};
 cap(); r=await m.sendNotification('s','b',{formType:'inquiry'}); rel(); global.fetch=realFetch;
 t('does NOT retry a 4xx', n===1 && r===false, `attempts=${n}`);

 // 8. network throw is contained
 clearEnv(); m=fresh({RESEND_API_KEY:'k',NOTIFY_EMAIL:'a@x.com',NOTIFY_FROM_EMAIL:'s@o.com'});
 global.fetch=async()=>{throw new Error('ECONNRESET');};
 cap(); r=await m.sendNotification('s','b',{formType:'inquiry'}); rel(); global.fetch=realFetch;
 t('network failure returns false, never throws', r===false);

 // 9. sandbox-sender warning when multiple recipients and no verified sender
 clearEnv(); m=fresh({RESEND_API_KEY:'k',NOTIFY_EMAIL:'a@x.com,b@x.com'});
 global.fetch=async()=>({ok:true,status:200,json:async()=>({id:'x'})});
 cap(); await m.sendNotification('s','b',{formType:'inquiry'}); rel(); global.fetch=realFetch;
 t('warns loudly when NOTIFY_FROM_EMAIL unset with >1 recipient', logs.some(([k,l])=>k==='err'&&l.includes('NOTIFY_FROM_EMAIL is unset')));

 // 10. legacy 3-arg call still works (crm-auth-forgot.js)
 clearEnv(); m=fresh({RESEND_API_KEY:'k',NOTIFY_FROM_EMAIL:'s@o.com'});
 global.fetch=async()=>({ok:true,status:200,json:async()=>({id:'y'})});
 cap(); r=await m.sendEmail('user@corp.com','Reset','link'); rel(); global.fetch=realFetch;
 t('legacy sendEmail(to,subject,text) still works', r===true);

 // 10b. dry run must work with NO api key at all -- that is the whole point
 // of a staging adapter, and the earlier ordering (credential checked first)
 // made the documented behaviour false.
 clearEnv(); m=fresh({NOTIFY_EMAIL:'a@x.com',NOTIFY_DRY_RUN:'1'});
 const noFetch=global.fetch; let hits=0; global.fetch=async()=>{hits++;throw new Error('should not be called');};
 cap(); r=await m.sendNotification('s','b',{formType:'connectivity-test'}); rel(); global.fetch=noFetch;
 t('dry run works with no RESEND_API_KEY', r===true && hits===0, `r=${r} calls=${hits}`);
 t('   and logs dry-run, not skipped', logs.some(([,l])=>l.includes('status=dry-run')), JSON.stringify(logs));

 // 10c. no recipient is still reported as skipped, even in dry run
 clearEnv(); m=fresh({NOTIFY_DRY_RUN:'1'});
 cap(); r=await m.sendNotification('s','b',{formType:'connectivity-test'}); rel();
 t('dry run with no recipient still fails closed', r===false);

 // 11. LEADS_NOTIFY gate (leads.js keeps notifications off by default)
 const leadsGate = (v) => {
   const s = String(v || '').toLowerCase();
   return s === '1' || s === 'true' || s === 'yes';
 };
 t('LEADS_NOTIFY unset -> notifications off', leadsGate(undefined) === false);
 t('LEADS_NOTIFY=0 -> off', leadsGate('0') === false);
 t('LEADS_NOTIFY=1 -> on', leadsGate('1') === true);
 t('LEADS_NOTIFY=true -> on', leadsGate('true') === true);
 const leadsSrc = require('fs').readFileSync(
   nodePath.join(__dirname, '..', 'netlify', 'functions', 'leads.js'), 'utf8');
 t('leads.js gates its send on leadsNotifyEnabled()',
   /if \(leadsNotifyEnabled\(\)\)/.test(leadsSrc));
 t('leads.js email body omits client IP and consent flag',
   !/lines\.push\('IP|lines\.push\('Consent/.test(leadsSrc));

 realLog(`\n${pass} passed, ${fail} failed`);
 process.exit(fail?1:0);
})();
