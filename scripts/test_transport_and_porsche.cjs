// Validate Tilda request construction while blocking every non-GET request.
const fs=require('fs');
const assert=require('assert/strict');
const {chromium}=require('playwright');
const ROOT='https://avtonds.ru';
const runtime=fs.readFileSync('assets/ast-conversion.js','utf8');
async function main(){
  const browser=await chromium.launch({headless:true});
  const results=[];
  try {
  for (const width of [1365,390]) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
  await context.route('**/*',async route=>{
    const r=route.request();
    if(!['GET','HEAD'].includes(r.method()))return route.abort();
    if(process.env.AST_USE_DEPLOYED!=='1'&&/\/assets\/ast-conversion\.js(?:\?|$)/.test(r.url()))return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:runtime});
    if(['image','media','font'].includes(r.resourceType())||/mc\.yandex\.|googletagmanager\.|google-analytics\./i.test(r.url()))return route.abort();
    return route.continue();
  });
  try{
    const cases=[
      {name:'zeekr-9x',url:'/zeekr-9x?utm_source=ast_test',open:async p=>{const b=p.locator('a:visible,button:visible').filter({hasText:/^Узнать цену$/}).first();await b.scrollIntoViewIfNeeded();const d=await b.evaluate(e=>{let r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {box:{x:r.x,y:r.y,w:r.width,h:r.height},stack:document.elementsFromPoint(x,y).slice(0,6).map(n=>({tag:n.tagName,id:n.id,cls:String(n.className).slice(0,100),z:getComputedStyle(n).zIndex}))}});console.log('9X_CTA_DIAG',JSON.stringify(d));await b.click({timeout:7000});},form:'#ast-quote-dialog[open] form[data-ast-standard-form]',model:'ZEEKR 9X',page:'/zeekr-9x'},
      {name:'zeekr',url:'/zeekr-8x?view=specifications&version=shadow&trim=Shadow&utm_source=ast_test',open:async p=>p.locator('#ast-oem-root article').filter({has:p.getByRole('heading',{name:'Shadow',exact:true})}).getByRole('button',{name:'Рассчитать поставку'}).click(),form:'#ast-oem-root [role=dialog].ast-inquiry form[data-ast-standard-form]',model:'ZEEKR 8X',trim:'Shadow'},
      {name:'tiguan',url:'/volkswagen-tiguan-l-pro?utm_source=ast_test',open:async p=>p.locator('a[data-trim-label="380TSI Люкс"]').click(),form:'#ast-quote-dialog[open] form[data-ast-standard-form]',model:'Volkswagen Tiguan L Pro',trim:'380TSI Люкс (380TSI 豪华版)'},
      {name:'nissan',url:'/nissan-qashqai-china?utm_source=ast_test',open:async p=>p.locator('button[data-open][data-ast-quote-open]').click(),form:'#ast-quote-dialog[open] form[data-ast-standard-form]',model:'Nissan Qashqai'},
      {name:'referral',url:'/referal?utm_source=ast_test',open:async p=>{await p.locator('form[data-ast-referral-inquiry][data-ast-quote-replaced]').waitFor({state:'attached'});assert.equal(await p.locator('form[data-ast-referral-inquiry]').isVisible(),false);await p.getByRole('link',{name:'Стать агентом',exact:true}).first().click();},form:'form[data-ast-referral-inquiry]+form[data-ast-standard-form]',page:'/referal'},
      {name:'porsche',url:'/porsche-cayenne-import?utm_source=ast_test',open:async p=>{await p.locator('form[data-lead-form][data-ast-quote-replaced]').waitFor({state:'attached'});assert.equal(await p.locator('form[data-lead-form]').isVisible(),false);},form:'form[data-lead-form]+form[data-ast-standard-form]',model:'Porsche Cayenne'},
      {name:'ev-final',url:'/ev?utm_source=ast_test',open:async p=>{await p.locator('form[data-ast-ev-final-form][data-ast-quote-replaced]').waitFor({state:'attached'});assert.equal(await p.locator('form[data-ast-ev-final-form]').isVisible(),false);},form:'form[data-ast-ev-final-form]+form[data-ast-standard-form]'},
      {name:'ev-calculator',url:'/ev?utm_source=ast_test',open:async p=>{await p.locator('form[data-ast-ev-lead-form] button[data-ast-ev-unified-open]').waitFor({state:'attached'});await p.locator('form[data-ast-ev-lead-form] select[name=target_model]').selectOption('li-auto-l9');assert.equal(await p.locator('form[data-ast-ev-lead-form] input[name=contact]').isVisible(),false);await p.locator('form[data-ast-ev-lead-form] button[data-ast-ev-unified-open]').click();},form:'#ast-quote-dialog[open] form[data-ast-standard-form]',model:'Li Auto L9',ev:true},
    ];
    for(const item of cases){
      const page=await context.newPage(); page.setDefaultTimeout(20000);
      try{
        const response=await page.goto(ROOT+item.url,{waitUntil:'domcontentloaded',timeout:60000});
        if(response.status()>=400)throw Error('HTTP '+response.status());
        await item.open(page);
        const form=page.locator(item.form);await form.waitFor({state:'visible'});
        const box=await form.boundingBox();assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,'form must fit the viewport');
        assert.equal(await form.locator('input[type=tel]').count(),1);
        assert.equal(await form.locator('input[name=consent]').count(),1);
        await form.locator('input[type=tel]').fill('+70000000000');await form.locator('input[name=consent]').check();
        const request=page.waitForRequest(r=>r.method()==='POST'&&/forms\.tilda/i.test(r.url()),{timeout:15000}).catch(()=>null);
        await form.locator('button[type=submit]').click();const req=await request;
        const details=await page.evaluate(()=>{
          const rec=document.querySelector('#ast-quote-native-record'),native=document.querySelector('#ast-quote-native-form');
          const val=n=>native?.querySelector('[name="'+n+'"]')?.value||'';
          return {recordDisplay:rec?getComputedStyle(rec).display:'absent',model:val('model'),trim:val('trim'),market:val('market'),test:val('is_test'),page:val('page'),ev_calculation:val('ev_calculation'),formStatus:[...document.querySelectorAll('form[data-ast-standard-form] .ast-quote-status')].map(x=>x.textContent).filter(Boolean)};
        });
        let payload=req?.postData()||'';
        for(let i=0;i<2;i++){try{payload=decodeURIComponent(payload.replace(/\+/g,' '));}catch(e){break;}}
        const result={name:item.name,viewport:width,postObserved:!!req,requestHost:req?new URL(req.url()).hostname:null,recordDisplay:details.recordDisplay,model:details.model,trim:details.trim,market:details.market,test:details.test,page:details.page,payloadHasPage:!item.page||payload.includes(item.page),payloadHasModel:!item.model||payload.includes(item.model),payloadHasTrim:!item.trim||payload.includes(item.trim),evDataPresent:!item.ev||(details.ev_calculation.includes('li-auto-l9')&&payload.includes('li-auto-l9'))};
        results.push(result);
        assert.ok(req,'native Tilda request must be generated');
        assert.equal(details.recordDisplay,'block','offscreen receiver must remain rendered');
        assert.equal(details.test,'yes');
        if(item.page){assert.equal(details.page,item.page);assert.ok(result.payloadHasPage,'source page must be in outgoing request');}
        if(item.model){assert.equal(details.model,item.model);assert.ok(result.payloadHasModel,'model must be in outgoing request');}
        if(item.trim){assert.equal(details.trim,item.trim);assert.ok(result.payloadHasTrim,'trim must be in outgoing request');}
        if(item.ev)assert.ok(result.evDataPresent,'EV calculation must be retained');
      }catch(e){results.push({name:item.name,viewport:width,error:String(e).slice(0,500)});}
      await page.close();
    }
  }finally{await context.close();}
  }
  }finally{await browser.close();}
  fs.writeFileSync('transport-form-diagnostics.json',JSON.stringify(results,null,2));
  console.log('RESULTS',JSON.stringify(results));
  if(results.some(x=>x.error||!x.postObserved))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
