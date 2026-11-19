// Summarize every row from a sitewide audit artifact.
const fs=require('fs');
const report=JSON.parse(fs.readFileSync('sitewide-form-audit.json','utf8'));
const rows=report.rows||[];
const bad=rows.filter(r=>r.error||r.runtimeNotReady);
const nonstandard=rows.filter(r=>(r.forms||[]).some(f=>!f.standard)).map(r=>({url:r.url,fields:r.forms.filter(f=>!f.standard).map(f=>f.fields.map(x=>x.name)),wizard:r.wizard}));
const oldWizard=rows.filter(r=>r.wizard||(r.actions||[]).some(a=>!a.navigated&&a.wizard)).map(r=>r.url);
const noOutcome=rows.flatMap(r=>(r.actions||[]).filter(a=>!a.error&&!a.navigated&&!a.wizard&&!(a.forms||[]).length).map(a=>({url:r.url,button:a.text})));
const errors=rows.flatMap(r=>(r.actions||[]).filter(a=>a.error).map(a=>({url:r.url,button:a.text,error:a.error})));
const insufficient=rows.filter(r=>(r.candidateCount||0)>(r.actions||[]).length).map(r=>({url:r.url,candidateCount:r.candidateCount,attempted:r.actions.length}));
console.log('AUDIT_REPORT',JSON.stringify({checkedAt:report.checkedAt,pages:rows.length,ok:rows.length-bad.length,bad:bad.map(r=>({url:r.url,index:r.index,error:r.error,runtimeNotReady:r.runtimeNotReady})),actions:rows.reduce((n,r)=>n+(r.actions||[]).filter(a=>!a.error).length,0),nonstandard,oldWizard,noOutcome,errors,insufficient}));
