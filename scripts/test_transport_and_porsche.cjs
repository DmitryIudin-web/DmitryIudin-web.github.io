// Check that the real Tilda bridge produces a request, intercepting it before transmission.
const fs=require('fs');
const {chromium}=require('playwright');
const ROOT='https://avtonds.ru';
async function main(){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',async route=>{
    const r=route.request();
    if(!['GET','HEAD'].includes(r.method()))return route.abort();
    if(['image','media','font'].includes(r.resourceType())||/mc\.yandex\.|googletagmanager\.|google-analytics\./i.test(r.url()))return route.abort();
    return route.continue();
  });
  const results=[];
  try{
    const cases=[
      {name:'zeekr',url:'/zeekr-8x?view=specifications&version=shadow&trim=Shadow&utm_source=ast_test',open:async p=>p.locator('#ast-oem-root article').filter({has:p.getByRole('heading',{name:'Shadow',exact:true})}).getByRole('button',{name:'Рассчитать поставку'}).click(),form:'#ast-oem-root [role=dialog].ast-inquiry form[data-ast-standard-form]'},
      {name:'tiguan',url:'/volkswagen-tiguan-l-pro?utm_source=ast_test',open:async p=>p.locator('a[data-trim-label="380TSI Люкс"]').click(),form:'#ast-quote-dialog[open] form[data-ast-standard-form]'},
      {name:'nissan',url:'/nissan-qashqai-china?utm_source=ast_test',open:async p=>p.locator('button[data-open][data-ast-quote-open]').click(),form:'#ast-quote-dialog[open] form[data-ast-standard-form]'},
    ];
    for(const item of cases){
      const page=await context.newPage(); page.setDefaultTimeout(20000);
      try{
        const response=await page.goto(ROOT+item.url,{waitUntil:'domcontentloaded',timeout:60000});
        if(response.status()>=400)throw Error('HTTP '+response.status());
        await item.open(page);
        const form=page.locator(item.form);
        await form.waitFor({state:'visible'});
        await form.locator('input[type=tel]').fill('+70000000000');
        await form.locator('input[name=consent]').check();
        const request=page.waitForRequest(r=>r.method()==='POST'&&/forms\.tilda/i.test(r.url()),{timeout:15000}).catch(()=>null);
        await form.locator('button[type=submit]').click();
        const req=await request;
        const details=await page.evaluate(()=>{
          const rec=document.querySelector('#ast-quote-native-record'),native=document.querySelector('#ast-quote-native-form');
          const val=n=>native?.querySelector('[name="'+n+'"]')?.value||'';
          return {recordPresent:!!rec,recordDisplay:rec?getComputedStyle(rec).display:'absent',model:val('model'),trim:val('trim'),market:val('market'),test:val('is_test'),formStatus:[...document.querySelectorAll('form[data-ast-standard-form] .ast-quote-status')].map(x=>x.textContent).filter(Boolean)};
        });
        results.push({name:item.name,postObserved:!!req,requestHost:req?new URL(req.url()).hostname:null,...details});
      }catch(e){results.push({name:item.name,error:String(e).slice(0,500)});}
      await page.close();
    }
    for(const path of ['/porsche-cayenne-import','/ev','/contacts','/premium-auto-lizing']){
      const page=await context.newPage();
      try{
        const response=await page.goto(ROOT+path+'?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
        await page.waitForFunction(()=>!!window.__astUniversalQuote,{timeout:15000});
        await page.waitForTimeout(1200);
        const forms=await page.evaluate(()=>[...document.querySelectorAll('form')].filter(f=>{
          const r=f.getBoundingClientRect();if(!r.width||!r.height||r.right<0||f.closest('[hidden],[aria-hidden="true"],dialog:not([open])'))return false;
          for(let e=f;e&&e.nodeType===1;e=e.parentElement)if(getComputedStyle(e).display==='none'||getComputedStyle(e).visibility==='hidden')return false;
          return !!f.querySelector('input[type=tel],[name=contact],[name=Phone]');
        }).map(f=>({id:f.id,classes:f.className,html:f.outerHTML.slice(0,2500),parent:f.parentElement?.outerHTML.slice(0,500)})));
        results.push({path,http:response.status(),forms});
      }catch(e){results.push({path,error:String(e).slice(0,300)});}
      await page.close();
    }
  }finally{await context.close();await browser.close();}
  fs.writeFileSync('transport-form-diagnostics.json',JSON.stringify(results,null,2));
  console.log('RESULTS',JSON.stringify(results));
  if(results.some(x=>x.name&&(!x.postObserved||x.error)))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
