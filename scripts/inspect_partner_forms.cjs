// Inspect partner intake without transmitting test data.
const { chromium } = require('playwright');
(async () => {
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  let phase=false,requests=[];
  await context.addInitScript(()=>{window.__testOpen=[];window.open=(url)=>{try{let u=new URL(url,location.href);window.__testOpen.push({host:u.hostname,protocol:u.protocol});}catch(e){} return null;};});
  await context.route('**/*',async route=>{
    const r=route.request();
    if(r.method()!=='GET' && r.method()!=='HEAD' || phase && (r.resourceType()==='fetch'||r.resourceType()==='xhr'||r.isNavigationRequest())) {
      let u=new URL(r.url()); requests.push({method:r.method(),host:u.hostname,type:r.resourceType()});
      return route.fulfill({status:200,contentType:'application/json',body:'{"success":true,"status":"success"}'});
    }
    if(['image','font','media'].includes(r.resourceType()) || /mc\\.yandex\\.|google-analytics\\./i.test(r.url()))return route.abort();
    return route.continue();
  });
  const results=[];
  for (const path of ['/referal','/logistics-partners-erlyan']){
    phase=false;requests=[];
    const page=await context.newPage();page.setDefaultTimeout(5000);
    try{
      const response=await page.goto('https://avtonds.ru'+path+'?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:25000});
      await page.waitForTimeout(2500);
      const form=page.locator('form:not([data-ast-standard-form])').filter({has:page.locator('[name="contact"]')}).first();
      await form.waitFor({state:'visible',timeout:10000});
      const meta=await form.evaluate(f=>({id:f.id,method:f.method,actionHost:(()=>{try{return new URL(f.action,location.href).hostname}catch(e){return ''}})(),fields:[...f.querySelectorAll('input:not([type=hidden]),select,textarea')].map(e=>({name:e.name,type:e.type,required:e.required}))}));
      for(const el of await form.locator('input:not([type=hidden]),select,textarea').all()){
        const o=await el.evaluate(e=>({name:e.name,type:e.type,required:e.required,disabled:e.disabled}));
        if(o.disabled)continue;
        if(o.type==='checkbox'){if(o.required)await el.check({force:true});continue;}
        if(o.type==='select-one'){if(o.required){let val=await el.locator('option').evaluateAll(opts=>opts.find(o=>o.value&&!o.disabled)?.value||'');if(val)await el.selectOption(val);}continue;}
        if(o.required||o.name==='contact')await el.fill(o.name==='contact'?'+70000000000':'TEST');
      }
      const invalid=await form.evaluate(f=>[...f.elements].filter(e=>e.willValidate&&!e.validity.valid).map(e=>({name:e.name,type:e.type})));
      requests=[];phase=true;
      const submit=form.locator('button[type=submit],input[type=submit],button:not([type])').last();
      await submit.click({timeout:5000});
      await page.waitForTimeout(2500);
      results.push({path,http:response.status(),...meta,invalid,requests,opened:await page.evaluate(()=>window.__testOpen)});
    }catch(e){results.push({path,error:String(e).slice(0,180),requests});}
    await page.close();
  }
  await context.close();await browser.close();
  console.log('PARTNER_DIAGNOSTICS',JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
