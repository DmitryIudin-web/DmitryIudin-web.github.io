// Sitewide lead UI audit. No real forms are submitted and analytics are blocked.
const fs = require('fs');
const { chromium } = require('playwright');

// The production domain is hosted by Tilda; its live sitemap.xml is distinct from the GitHub Pages snapshot.
const ROOT = 'https://avtonds.ru';
const out = 'sitewide-form-audit.json';
const rows = [];
let next = 0;
let rateLimited = false;
function write() { fs.writeFileSync(out, JSON.stringify({checkedAt:new Date().toISOString(),scope:'Desktop browser: sitemap pages, visible lead forms and up to three distinct lead buttons per page. POST requests blocked; no CRM delivery test.',rows},null,2)); }

async function snapshot(page) {
  return page.evaluate(() => {
    function visible(el) {
      if (!el || el.closest('[hidden],[aria-hidden="true"],dialog:not([open])')) return false;
      const box=el.getBoundingClientRect();
      if (!box.width || !box.height || box.right < -20) return false;
      for(let node=el;node&&node.nodeType===1;node=node.parentElement){
        const s=getComputedStyle(node);
        if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0) return false;
      }
      return true;
    }
    const forms=[...document.querySelectorAll('form')].filter(visible).map(form=>{
      const fields=[...form.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(visible).map(e=>({name:e.name||'',type:e.type||e.tagName.toLowerCase(),required:!!e.required}));
      const isLead=fields.some(x=>x.type==='tel'||/phone|contact|телефон|контакт/i.test(x.name));
      return {id:form.id||'',standard:form.hasAttribute('data-ast-standard-form'),isLead,fields};
    }).filter(f=>f.isLead);
    const wizard=[...document.querySelectorAll('dialog[open],[role=dialog],.ast-inquiry')]
      .filter(visible).map(e=>e.innerText||'').some(x=>/шаг\s*[1-9]\s*из\s*[2-9]/i.test(x));
    const candidates=[...document.querySelectorAll('a,button')].map((el,index)=>{
      if(!visible(el)||el.closest('form,dialog,[role=dialog]'))return null;
      const text=(el.innerText||el.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
      if(!text||text.length>85||!/^(рассчитать|расчёт|получить|заказать|оставить|узнать|подобрать|заявка|обсудить)/i.test(text)||!/заяв|рассч|расчёт|цен|стоим|поставк|авто|кп|подбор|сделк/i.test(text))return null;
      const href=el.getAttribute('href')||'';
      if(/^(tel:|mailto:|tg:|whatsapp:)/i.test(href)||el.getAttribute('target')==='_blank')return null;
      if(href&&/^https?:/i.test(href)){try{if(new URL(href,location.href).hostname!==location.hostname)return null;}catch(e){return null;}}
      const local=!!el.closest('#ast-oem-root,main,article,.t123,.ast-model-root');
      return {index,text,href,local,tag:el.tagName,common:el.hasAttribute('data-ast-quote-open')};
    }).filter(Boolean);
    const unique=[];const seen=new Set();
    candidates.sort((a,b)=>(Number(b.local)-Number(a.local))||(Number(b.tag==='BUTTON')-Number(a.tag==='BUTTON')));
    for(const c of candidates){const key=c.text+'|'+c.href;if(!seen.has(key)){seen.add(key);unique.push(c);}}
    return {title:document.title,forms,wizard,candidates:unique.slice(0,3),candidateCount:unique.length,iframes:[...document.querySelectorAll('iframe')].filter(visible).map(f=>f.getAttribute('src')||'').slice(0,4)};
  });
}

async function main() {
  const res=await fetch(ROOT+'/sitemap.xml',{signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw Error('sitemap HTTP '+res.status);
  const xml=await res.text();
  const urls=[...new Set([...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(x=>x[1].trim()).filter(x=>x.startsWith(ROOT+'/')))];
  if(!urls.length)throw Error('No sitemap entries');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',async route=>{
    const r=route.request(),url=r.url();
    if(!['GET','HEAD'].includes(r.method()))return route.abort();
    if(['image','media','font'].includes(r.resourceType()))return route.abort();
    if(/mc\.yandex\.|googletagmanager\.|google-analytics\.|metrika/i.test(url))return route.abort();
    if(r.isNavigationRequest()&&!url.startsWith(ROOT+'/')&&!url.startsWith('https://offers-api.89-125-27-177.sslip.io/'))return route.abort();
    return route.continue();
  });
  async function worker(){
    const page=await context.newPage(); page.setDefaultTimeout(3000);
    while(true){
      const i=next++; if(i>=urls.length)break;
      const url=new URL(urls[i]);url.searchParams.set('utm_source','ast_test');url.searchParams.set('utm_medium','sitewide_form_audit');
      const row={url:urls[i],actions:[]};
      try{
        const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:25000});
        row.http=response&&response.status();
        if(row.http>=400){row.error='HTTP '+row.http;if(row.http===429){rateLimited=true;next=urls.length;}rows.push(row);write();continue;}
        try{await page.waitForFunction(()=>!!window.__astUniversalQuote,{timeout:6000});}catch(e){row.runtimeNotReady=true;}
        await page.waitForTimeout(600);
        const initial=await snapshot(page);
        row.title=initial.title;row.forms=initial.forms;row.wizard=initial.wizard;row.candidateCount=initial.candidateCount;row.iframes=initial.iframes;
        for(const candidate of initial.candidates){
          let current=await snapshot(page);
          // DOM can change while page-specific widgets initialize. Never click a stale index.
          const actual=await page.locator('a,button').nth(candidate.index).evaluate(e=>(e.innerText||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim()).catch(()=>'');
          if(actual!==candidate.text){row.actions.push({text:candidate.text,error:'DOM changed before click'});continue;}
          try{
            const before=page.url();
            await page.locator('a,button').nth(candidate.index).click({timeout:2500,noWaitAfter:true});
            await page.waitForTimeout(400);
            const after=await snapshot(page);
            row.actions.push({text:candidate.text,href:candidate.href,navigated:page.url()!==before,forms:after.forms,wizard:after.wizard});
            if(page.url()!==before){
              await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:25000});
              await page.waitForTimeout(600);
            } else {
              const close=page.locator('dialog[open] button[aria-label*="Закрыть"],[role="dialog"] button[aria-label*="Закрыть"]').first();
              if(await close.isVisible().catch(()=>false))await close.click({timeout:1200}).catch(()=>{});
              else await page.keyboard.press('Escape').catch(()=>{});
            }
          }catch(error){row.actions.push({text:candidate.text,error:String(error).slice(0,200)});await page.keyboard.press('Escape').catch(()=>{});}
        }
      }catch(error){row.error=String(error).slice(0,250);}
      rows.push(row);if(rows.length%20===0){write();console.log('PROGRESS',rows.length,'/',urls.length);} await page.waitForTimeout(800);
    }
    await page.close();
  }
  try{await Promise.all(Array.from({length:2},worker));}finally{write();await context.close();await browser.close();}
  const noOutcome=a=>!a.error&&!a.navigated&&!a.wizard&&!(a.forms||[]).length;
  const flagged=rows.filter(r=>r.error||r.runtimeNotReady||r.wizard||r.forms?.some(f=>!f.standard)||r.actions.some(a=>a.wizard||a.forms?.some(f=>!f.standard)||noOutcome(a)));
  const incomplete=rows.filter(r=>r.candidateCount>r.actions.length||r.actions.some(a=>a.error));
  const totalActions=rows.reduce((n,r)=>n+r.actions.filter(a=>!a.error).length,0);
  console.log('SUMMARY',JSON.stringify({pages:rows.length,expected:urls.length,rateLimited,withErrors:rows.filter(x=>x.error).length,runtimeNotReady:rows.filter(x=>x.runtimeNotReady).length,flagged:flagged.length,incomplete:incomplete.length,actions:totalActions}));
  console.log('FLAGGED',JSON.stringify(flagged.map(r=>({url:r.url,error:r.error,runtimeNotReady:r.runtimeNotReady,wizard:r.wizard,forms:r.forms,actions:r.actions.filter(a=>a.wizard||a.forms?.some(f=>!f.standard)||noOutcome(a))})).slice(0,100)));
  if(rateLimited||rows.length!==urls.length)process.exitCode=1;
  console.log('INCOMPLETE',JSON.stringify(incomplete.map(r=>({url:r.url,candidateCount:r.candidateCount,actions:r.actions})).slice(0,50)));
}
main().catch(e=>{console.error(e);process.exitCode=1});
