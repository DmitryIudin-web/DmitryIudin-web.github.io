const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../assets/ast-conversion.js'),'utf8');
const block=(start,end)=>source.slice(source.indexOf(start,source.indexOf('function installUniversalQuoteForm')),source.indexOf(end,source.indexOf(start,source.indexOf('function installUniversalQuoteForm'))));
let events=[],sendCount=0,status=[],timers=[],testSource='',stored={},renderedErrors=false;
const fields={};
const nativeForm={tildaTranId:'7528993:qa_receipt',querySelector:s=>s==='[type="submit"]'?{click(){sendCount++}}:{textContent:renderedErrors?'error':''},querySelectorAll:()=>[]};
const env={console,URLSearchParams,Date,Math,Object,Number,String,Promise,setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(){},MutationObserver:class{observe(){}disconnect(){}},getComputedStyle:()=>({display:renderedErrors?'block':'none'}),location:{search:'?utm_source=yandex&utm_campaign=audipriority&yclid=click42',href:'https://avtonds.ru/audi-a5l?utm_source=yandex&utm_campaign=audipriority&yclid=click42',origin:'https://avtonds.ru'},path:()=>'/audi-a5l',sessionGet:key=>stored[key]||'',positionOf:()=> 'inline',SOURCE_KEYS:['utm_source','utm_medium','utm_campaign','yclid'],pageConsentVersion:()=> 'privacy-2026-05-12',track:(goal,params)=>events.push({goal,params}),trackContact:(channel,extra)=>events.push({goal:'contact',params:extra}),pageOffer:()=> 'audi-a5l',field:(f,k,v)=>{if(f===nativeForm) fields[k]=v; else (f.elements[k] ||= {}).value=v},setStatus:(f,t)=>status.push(t),ready:()=>Promise.resolve(),CONFIG:{},nativeForm};
vm.createContext(env);
const resetSession = () => vm.runInContext(block('    var record, nativeForm', '    var priceLabel ='), env);
resetSession();
vm.runInContext(block('    var sourceKeys =', '    var marketing =')+block('    function context(', '    function makeForm(info) {')+block('    function finish(ok, reason)', '    var style = document.createElement'),env);
function form(){const button={disabled:false};const phone={value:'+70000000000',setCustomValidity(){}};return {id:'ast-quote-form-1',dataset:{attempt:'0'},elements:{phone,model:{value:'Audi A5L'},offer:{value:'audi-a5l'},page_url:{value:'https://avtonds.ru/audi-a5l'},page:{value:'/audi-a5l'},a5l_role:{value:'company'}},reportValidity:()=>true,querySelector:s=>button,reset(){phone.value=''}}}
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
async function checkOfferIdentity() {
  resetSession();
  const accepted = () => events.filter(event => event.goal === 'ast_form_submit_success');
  const startCount = sendCount;
  const quote = form();
  const source = {model: 'Audi A5L', offer_id: 'vehicle-A', quoteId: ''};
  quote.__astQuoteSource = {
    querySelector(selector) {
      const name = selector.match(/name="([^"]+)"/)[1];
      return {value: source[name] || ''};
    }
  };
  // The visible inline form initially mirrors the source at mount time.
  quote.elements.offer_id = {value: source.offer_id};
  quote.elements.quoteId = {value: ''};
  events = [];
  env.submit(quote);
  await flush();
  assert.equal(sendCount, startCount + 1);
  assert.equal(fields.offer_id, 'vehicle-A');
  const firstRequestId = fields.request_id;
  nativeForm.tildaTranId = 'qa:A';
  env.finish(true);

  quote.elements.phone.value = '+7 (000) 000-00-00';
  source.offer_id = 'vehicle-B';
  env.submit(quote);
  nativeForm.tildaTranId = 'qa:before-dispatch';
  env.finish(true);
  assert.equal(accepted().length, 1, 'cannot confirm a request before dispatch');
  nativeForm.tildaTranId = 'qa:A';
  // Selection and phone can change while the native library is loading.
  source.offer_id = 'vehicle-C';
  quote.elements.phone.value = '+71111111111';
  await flush();
  assert.equal(sendCount, startCount + 2, 'different offer of the same model must be sent');
  assert.equal(fields.offer_id, 'vehicle-B', 'send the offer selected on submit');
  assert.equal(fields.Phone, '+7 (000) 000-00-00');
  const secondRequestId = fields.request_id;
  assert.notEqual(firstRequestId, secondRequestId);
  assert.equal(accepted().length, 1, 'dispatch is not an acknowledgement');
  env.finish(true); // Replay of A's native receipt while B awaits its own.
  assert.equal(accepted().length, 1, 'old receipt cannot confirm the next offer');
  assert.ok(env.active);
  nativeForm.tildaTranId = 'qa:B';
  env.finish(true);
  assert.deepEqual(accepted().map(e => [e.params.request_id, e.params.receipt_id]),
    [[firstRequestId, 'qa:A'], [secondRequestId, 'qa:B']]);

  // The same offer can be identified by either field on different forms.
  quote.elements.phone.value = '+70000000000';
  source.offer_id = '';
  source.quoteId = 'vehicle-A';
  env.submit(quote);
  await flush();
  assert.equal(sendCount, startCount + 2, 'repeat A after B is still a duplicate');
  assert.match(status.at(-1), /уже принята/);
  source.quoteId = 'vehicle-C';
  env.submit(quote);
  await flush();
  assert.equal(sendCount, startCount + 3, 'a different quoteId alone must be sent');
  assert.equal(fields.offer_id, '');
  assert.equal(fields.quoteId, 'vehicle-C');
  nativeForm.tildaTranId = 'qa:C';
  env.finish(true);
  console.log('PASS distinct offers, inline selection snapshot, request/receipt pairing, quoteId aliases and repeat A after B');
}
async function checkOfferLinks() {
  resetSession();
  const originalPath = env.path;
  const originalSearch = env.location.search;
  const startCount = sendCount;
  env.path = () => '/offers';
  try {
    for (const id of ['A', 'B']) {
      env.location.search = '?quoteId=' + id;
      env.submit(form());
      await flush();
      assert.equal(fields.quoteId, id, 'detail URL identifies the offer');
      nativeForm.tildaTranId = 'qa:url-' + id;
      env.finish(true);
    }
    env.location.search = '?quoteId=C';
    const selectedCard = form();
    selectedCard.elements.offer_id = {value: 'A'};
    env.submit(selectedCard);
    await flush();
    assert.equal(sendCount, startCount + 2, 'explicit card takes precedence over the URL');
    assert.match(status.at(-1), /уже принята/);
  } finally {
    env.path = originalPath;
    env.location.search = originalSearch;
  }
  console.log('PASS offer detail links and explicit card selection');
}
async function checkRepeatWindow() {
  resetSession();
  let now = 1000000;
  env.Date = class extends Date { static now() { return now; } };
  const startCount = sendCount;
  const quote = form(); // Generic form with no offer identifiers.
  nativeForm.tildaTranId = '0';
  nativeForm.tildaOrderId = '0';
  try {
    env.submit(quote);
    await flush();
    env.finish(true);
    assert.equal(quote.dataset.astAcceptedRequestId, fields.request_id, 'native success without a receipt');
    quote.elements.phone.value = '+70000000000';
    now += 119999;
    env.submit(quote);
    await flush();
    assert.equal(sendCount, startCount + 1, 'repeat suppressed before expiry');
    now += 1;
    env.submit(quote);
    await flush();
    assert.equal(sendCount, startCount + 2, 'same request allowed at 120 seconds');
    nativeForm.tildaOrderId = 'order:after-expiry';
    env.finish(true);
    assert.ok(events.some(e => e.params.receipt_id === 'order:after-expiry'));
  } finally {
    env.Date = Date;
  }
  console.log('PASS generic form, 120-second expiry, native success without receipt and order receipt fallback');
}
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
await checkOfferIdentity();
await checkOfferLinks();
await checkRepeatWindow();
// A new model/contact may retry a failed request. No success before native acceptance.
resetSession();events=[];status=[];f=form();env.f=f;vm.runInContext('submit(f)',env);await flush();
assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,0);
vm.runInContext("finish(false,'native_rejected')",env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_error').length,1);assert.equal(f.elements.phone.value,'+70000000000');
vm.runInContext('submit(f)',env);await flush();assert.equal(events.filter(e=>e.goal==='ast_form_submit_attempt').length,2);vm.runInContext('finish(true)',env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,1);assert.equal(fields.request_id,f.__astQuoteEvents?events[0].params.request_id:'');
console.log('PASS failure preserves phone; retry retains request identity and reports one eventual success');
resetSession();events=[];f=form();env.f=f;vm.runInContext('submit(f)',env);await flush();timers.at(-1)();assert.ok(env.active,'timeout keeps transport occupied');vm.runInContext('submit(f)',env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_attempt').length,1);vm.runInContext('finish(true)',env);assert.equal(events.filter(e=>e.goal==='ast_form_submit_success').length,1);
console.log('PASS delayed acknowledgement keeps the request isolated and permits late success');
resetSession();env.location.search='?utm_source=ast_test&utm_campaign=qa_audi_20261105';events=[];f=form();env.f=f;vm.runInContext('quoteStart(f);submit(f)',env);await flush();vm.runInContext('finish(true)',env);assert.equal(fields.is_test,'yes');assert.match(fields.Name,/TEST/);assert.match(fields.comment,/не звонить/);assert.ok(events.every(e=>e.goal.startsWith('ast_test_')));
console.log('PASS TEST requests are labelled in receiver and do not emit production success/start goals');
resetSession();env.ready=()=>Promise.reject(new Error('unavailable'));events=[];f=form();env.f=f;vm.runInContext('submit(f)',env);await flush();await flush();assert.equal(events.filter(e=>e.goal==='ast_test_form_submit_error').length,1);assert.ok(!events.some(e=>e.goal.includes('success')));
console.log('PASS unavailable native transport reports failure, never success');
})().catch(e=>{console.error(e);process.exitCode=1});
