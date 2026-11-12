const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(require('path').join(__dirname, '../assets/ast-conversion.js'), 'utf8');
const start = source.indexOf('function installUniversalQuoteForm');
function block(a,b) { const i=source.indexOf(a,start), j=source.indexOf(b,i); assert.ok(i>=0&&j>i, 'expected source boundaries'); return source.slice(i,j); }

let currentPath='/zeekr-8x';
const chosen={textContent:'Красный «Янтарный закат» · Белый и чёрный'};
const desc={textContent:'ZEEKR 8X Ultra+ '+chosen.textContent};
const inquiry={querySelector(s){if(s==='.ast-inquiry-model')return desc;if(s==='.ast-chosen-colors')return chosen;return null;},closest(){return this;}};
const selected={
  '[role="tablist"][aria-label="Цвет кузова"] [role="tab"][aria-selected="true"]':{getAttribute:()=> 'Серый «Лунное море»',textContent:''},
  '[role="tablist"][aria-label="Цвет салона"] [role="tab"][aria-selected="true"]':{getAttribute:()=> 'Чистый чёрный',textContent:''},
};
const document={querySelector(s){if(s==='#ast-oem-root[data-ast-oem-model="zeekr-8x"]')return {};return selected[s]||null;}};
const env={document,URLSearchParams,location:{search:'?utm_source=test',href:'https://avtonds.ru/zeekr-8x?utm_source=test'},path:()=>currentPath,pageModel:()=>'',pageOffer:()=>currentPath.slice(1),sourceKeys:['model','offer_id','quoteId','trim','exterior_color','interior_color','brand','generation','market','a5l_role']};
vm.createContext(env);
vm.runInContext(block('    function context(source, trigger)', '    function quoteTestMode()')+block('    function isQuoteOpener(el)', '    function linksToInlineQuote(el)'),env);
let ctx=env.context(inquiry,null);
assert.equal(ctx.model,'ZEEKR 8X'); assert.equal(ctx.trim,'Ultra+'); assert.equal(ctx.market,'Китай');
assert.equal(ctx.exterior_color,'Серый «Лунное море»');assert.equal(ctx.interior_color,'Чистый чёрный');
delete selected['[role="tablist"][aria-label="Цвет кузова"] [role="tab"][aria-selected="true"]'];
delete selected['[role="tablist"][aria-label="Цвет салона"] [role="tab"][aria-selected="true"]'];
ctx=env.context(inquiry,null);assert.equal(ctx.exterior_color,'Красный «Янтарный закат»');assert.equal(ctx.interior_color,'Белый и чёрный');
desc.textContent='ZEEKR 8X Shadow';chosen.textContent='';ctx=env.context(inquiry,null);assert.equal(ctx.trim,'Shadow');assert.equal(ctx.exterior_color,undefined);
currentPath='/nissan-qashqai-china';ctx=env.context(null,null);assert.equal(ctx.model,'Nissan Qashqai');assert.equal(ctx.generation,'III');assert.equal(ctx.market,'Китай');
const nissan={tagName:'BUTTON',textContent:'Рассчитать стоимость под ключ',closest:()=>null,getAttribute:()=>'',matches:s=>s==='button[data-open]'};
assert.equal(env.isQuoteOpener(nissan),true);
currentPath='/volkswagen-tiguan-l-pro';
const tiguan={tagName:'A',origin:undefined,textContent:'380TSI Люкс',closest:()=>null,hasAttribute:()=>false,getAttribute:k=>({'data-trim':'380TSI 豪华版','data-trim-label':'380TSI Люкс',href:'#ast-request'}[k]||''),matches:s=>s==='a[data-lead-open][href="#ast-request"]'};
ctx=env.context(null,tiguan);assert.equal(ctx.model,'Volkswagen Tiguan L Pro');assert.equal(ctx.trim,'380TSI Люкс (380TSI 豪华版)');assert.equal(ctx.market,'Китай');assert.equal(env.isQuoteOpener(tiguan),true);
currentPath='/another-page';assert.equal(env.isQuoteOpener(nissan),false);assert.equal(env.isQuoteOpener(tiguan),false);
console.log('PASS model-specific contexts, selected trim and colors, fallback colors and restricted openers');

let wrapper,focused=0,attrs={};currentPath='/zeekr-8x';
const fakeInquiry={querySelector(s){return s===':scope > .ast-unified-entry'?wrapper:null;},setAttribute(k,v){attrs[k]=v;},appendChild(w){wrapper=w;},getAttribute(k){return k==='role'?'dialog':null;}};
env.document={querySelectorAll:()=>[fakeInquiry],createElement:()=>({appendChild(form){this.form=form;}})};
env.context=()=>({model:'ZEEKR 8X'});env.makeForm=info=>({info,elements:{phone:{focus(){focused++;}}}});
vm.runInContext(block('    function mountZeekrInquiry()', '    function mount()'),env);
env.mountZeekrInquiry();env.mountZeekrInquiry();assert.equal(attrs['data-ast-unified-inquiry'],'1');assert.equal(wrapper.form.__astQuoteSource,fakeInquiry);assert.equal(focused,1);
console.log('PASS one unified form per React inquiry and one focus action');
