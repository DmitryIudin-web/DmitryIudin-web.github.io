// Inventory the live sitemap. This is an HTTP/source check, not a UI or CRM test.
const fs=require('fs');
async function fetchText(url) {
  const r=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(30000)});
  const body=await r.text();
  return {status:r.status,url:r.url,body};
}
async function main(){
  const sitemap=await fetchText('https://avtonds.ru/sitemap.xml');
  if(sitemap.status!==200)throw Error('sitemap HTTP '+sitemap.status);
  const urls=[...sitemap.body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(x=>x[1].trim()).filter(x=>x.startsWith('https://avtonds.ru/'));
  if(!urls.length)throw Error('No sitemap URLs found');
  const rows=new Array(urls.length); let next=0;
  async function worker(){
    while(true){
      const i=next++;if(i>=urls.length)return;
      try{
        const r=await fetchText(urls[i]);
        rows[i]={url:urls[i],finalUrl:r.url,status:r.status,sharedRuntime:/ast-conversion\.js/i.test(r.body),iframe:/<iframe\b/i.test(r.body),possibleForm:/<form\b/i.test(r.body)};
      }catch(e){rows[i]={url:urls[i],error:String(e)};}
    }
  }
  await Promise.all(Array.from({length:4},worker));
  const summary={checkedAt:new Date().toISOString(),method:'HTTP HTML only; no claim about interactive forms, runtime-rendered links or delivery',total:rows.length,ok:rows.filter(x=>x.status>=200&&x.status<400).length,fail:rows.filter(x=>x.error||x.status>=400).length,withRuntime:rows.filter(x=>x.sharedRuntime).length,withoutRuntime:rows.filter(x=>!x.sharedRuntime).length,withIframe:rows.filter(x=>x.iframe).length};
  fs.writeFileSync('form-inventory.json',JSON.stringify({summary,rows},null,2));
  console.log(JSON.stringify(summary,null,2));
  console.log('Failed URLs:',JSON.stringify(rows.filter(x=>x.error||x.status>=400).slice(0,40)));
  console.log('No runtime, first 40:',JSON.stringify(rows.filter(x=>!x.sharedRuntime).slice(0,40)));
}
main().catch(e=>{console.error(e);process.exitCode=1});
