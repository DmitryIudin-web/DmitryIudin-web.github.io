const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../assets/ast-conversion.js'),'utf8');
const block=(start,end)=>source.slice(source.indexOf(start,source.indexOf('function installUniversalQuoteForm')),source.indexOf(end,source.indexOf(start,source.indexOf('function installUniversalQuoteForm'))));
let events=[],sendCount=0,status=[],timers=[],testSource='',stored={},renderedErrors=false;
const fields={};
const nativeForm={tildaTranId:'7528993:qa_receipt',querySelector:s=>s==='[type="submit"]'?{click(){sendCount++}}:{textContent:renderedErrors?'error':''},querySelectorAll:()=>[]};
const env={console,URLSearchParams,Date,Math,Object,Number,String,Promise,setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},MutationObserver:class{observe(){}disconnect(){}},getComputedStyle:()=>({display:renderedErrors?'block':'none'}),location:{search:'?utm_source=yandex&utm_campaign=audipriority&yclid=click42',href:'https://avtonds.ru/audi-a5l?utm_source=yandex&utm_campaign=audipriority&yclid=click42',origin:'https://avtonds.ru'},path:()=>'/audi-a5l',sessionGet:key=>stored[key]||'',positionOf:()=> 'inline',SOURCE_KEYS:['utm_source','utm_medium','utm_campaign','yclid'],sourceKeys:['model','offer_id','a5l_role'],pageConsentVersion:()=> 'privacy-2026-05-12',track:(goal,params)=>events.push({goal,params}),trackContact:(channel,extra)=>events.push({goal:'contact',params:extra}),context:()=>({}),field:(f,k,v)=>{fields[k]=v},setStatus:(f,t)=>status.push(t),ready:()=>Promise.resolve(),CONFIG:{},active:null,lastAccepted:null,nativeForm};
vm.createContext(env);
vm.runInContext(block('    function quoteTestMode()', '    function makeForm(info) {')+block('    function finish(ok, reason)', '    var style = document.createElement'),env);
function form(){const button={disabled:false};const phone={value:'+70000000000',setCustomValidity(){}};return {id:'ast-quote-form-1',dataset:{attempt:'0'},elements:{phone,model:{value:'Audi A5L'},offer:{value:'audi-a5l'},page_url:{value:'https://avtonds.ru/audi-a5l'},page:{value:'/audi-a5l'},a5l_role:{value:'company'}},reportValidity:()=>true,querySelector:s=>button,reset(){phone.value=''}}}
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
(async()=>{
let f=form();env.f=f;
vm.runInContext("quoteStart(f);quoteStart(f);submit(f);submit(f)",env);await flush();
assert.equal(events.filter(e=>e.goal==='ast_form_start').length,1,'one actual-input start');
assert.equal(events.filter(e=>e.goal==='ast_form_submit_attempt').length,1,'double submit blocked');
assert.equal(sendCount,1,'single native delivery');
assert.equal(fields.utm_campaign,'audipriority');assert.equal(fields.yclid,'click42');assert.equal(fields.model,'Audi A5L');assert.equal(fields.a5l_role,'company');
const request=fields.request_id;assert.ok(request);
vm.runInContext('finish(true);finish(true)',env);
assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,1,'repeated acknowledgement deduplicated');
assert.equal(events.find(e=>e.goal==='ast_form_submit_success').params.request_id,request);
assert.equal(events.find(e=>e.goal==='ast_form_submit_success').params.receipt_id,'7528993:qa_receipt');
assert.ok(events.every(e=>!Object.keys(e.params).some(k=>/phone|name|email/i.test(k))),'analytics has no contact');
f.elements.phone.value='+70000000000';vm.runInContext('submit(f)',env);await flush();assert.equal(sendCount,1,'repeat same contact blocked for 2 min');
console.log('PASS delivery, attribution, actual-input tracking, double-click, duplicate ack, immediate repeat, no PII');
// A new model/contact may retry a failed request. No success before native acceptance.
env.lastAccepted=null;events=[];status=[];f=form();env.f=f;vm.runInContext('submit(f)',env);await flush();
assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,0);
vm.runInContext("finish(false,'native_rejected')",env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_error').length,1);assert.equal(f.elements.phone.value,'+70000000000');
vm.runInContext('submit(f)',env);await flush();assert.equal(events.filter(e=>e.goal==='ast_form_submit_attempt').length,2);vm.runInContext('finish(true)',env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,1);assert.equal(fields.request_id,f.__astQuoteEvents?events[0].params.request_id:'');
console.log('PASS failure preserves phone; retry retains request identity and reports one eventual success');
env.lastAccepted=null;events=[];f=form();env.f=f;vm.runInContext('submit(f)',env);await flush();timers.at(-1)();assert.ok(env.active,'timeout keeps transport occupied');vm.runInContext('submit(f)',env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_attempt').length,1);vm.runInContext('finish(true)',env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,1);
console.log('PASS delayed acknowledgement keeps the request isolated and permits late success');
// Distinct offers and vehicle selections must not be discarded as double clicks.
env.lastAccepted=null;events=[];let before=sendCount;
f=form();f.elements.offer_id={value:'offer-1'};f.elements.quoteId={value:'quote-1'};f.elements.trim={value:'Max'};env.f=f;
vm.runInContext('submit(f)',env);await flush();vm.runInContext('finish(true)',env);
f=form();f.elements.offer_id={value:'offer-2'};f.elements.quoteId={value:'quote-2'};f.elements.trim={value:'Ultra'};env.f=f;
vm.runInContext('submit(f)',env);await flush();assert.equal(sendCount,before+2,'different offer/trim must be delivered');vm.runInContext('finish(true)',env);
f=form();f.elements.offer_id={value:'offer-2'};f.elements.quoteId={value:'quote-2'};f.elements.trim={value:'Ultra'};env.f=f;
vm.runInContext('submit(f)',env);await flush();assert.equal(sendCount,before+2,'exact duplicate still blocked');
console.log('PASS different offers and trims are delivered while an exact repeat is blocked');
env.lastAccepted=null;env.location.search='?utm_source=ast_test&utm_campaign=qa_audi_20261105';events=[];f=form();env.f=f;vm.runInContext('quoteStart(f);submit(f)',env);await flush();vm.runInContext('finish(true)',env);assert.equal(fields.is_test,'yes');assert.match(fields.Name,/TEST/);assert.match(fields.comment,/не звонить/);assert.ok(events.every(e=>e.goal.startsWith('ast_test_')));
console.log('PASS TEST requests are labelled in receiver and do not emit production success/start goals');
env.lastAccepted=null;env.ready=()=>Promise.reject(new Error('unavailable'));events=[];f=form();env.f=f;vm.runInContext('submit(f)',env);await flush();await flush();assert.equal(events.filter(e=>e.goal==='ast_test_form_submit_error').length,1);assert.ok(!events.some(e=>e.goal.includes('success')));
console.log('PASS unavailable native transport reports failure, never success');
})().catch(e=>{console.error(e);process.exitCode=1});
