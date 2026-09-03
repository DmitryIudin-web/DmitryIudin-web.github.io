import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const BASE = 'http://127.0.0.1:8099';
const browser = await chromium.launch();
let fail = 0;

for (const [label, path, expect] of [
  ['лизинг',    '/premium-auto-lizing/',      'На юрлицо (с НДС)'],
  ['лизинг-2',  '/auto-v-lizing/',            'На юрлицо (с НДС)'],
  ['модельная', '/porsche-cayenne-import/',   null],
  ['главная',   '/',                          null],
]) {
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__goals=[];
    window.ym=(i,a,t,p)=>{ if(a==='reachGoal') window.__goals.push({t,p}); if(a==='getClientID'&&typeof t==='function') t('cid'); };
    document.addEventListener('click', e => { const a=e.target.closest?.('a'); if(a) e.preventDefault(); }, true);
  });
  const errs=[]; page.on('pageerror', e=>errs.push(e.message.split('\n')[0]));
  const resp = await page.goto(BASE+path, {waitUntil:'domcontentloaded'});
  if (!resp || resp.status() >= 400) { console.log(`── ${label} ${path}: страница недоступна (${resp?.status()}) — пропуск`); await ctx.close(); continue; }
  await page.waitForTimeout(1200);
  const offer = await page.evaluate(() => document.querySelector('[data-offer]')?.getAttribute('data-offer') ?? null);
  await page.evaluate(() => window.ASTConversion.openQuiz());
  await page.waitForTimeout(350);
  await page.locator('[data-ast-quiz-next]').click();
  await page.waitForTimeout(350);

  const active = await page.evaluate(() => {
    const a = document.querySelector('.ast-quiz__option--active');
    return a ? a.textContent.trim() : null;
  });
  const pressed = await page.evaluate(() =>
    [...document.querySelectorAll('[data-ast-quiz-client]')].map(b => b.getAttribute('aria-pressed')));
  const ok = active === expect;
  if (!ok) fail++;
  console.log(`── ${label} ${path}  offer=${offer}`);
  console.log(`   подсвечено: ${JSON.stringify(active)}  ожидалось: ${JSON.stringify(expect)}  ${ok?'OK':'ПРОВАЛ'}`);
  console.log(`   aria-pressed: ${pressed.join(', ')}`);

  // Выбор пользователя должен перебивать предустановку.
  await page.locator('[data-ast-quiz-client]').first().click();  // «На физлицо»
  await page.waitForTimeout(300);
  await page.locator('[data-ast-quiz-timeline]').first().click();
  await page.waitForTimeout(350);
  await page.locator('[data-ast-quiz-phone]').fill('+7 900 000-00-01');
  await page.locator('[data-ast-quiz-phone-submit]').click();
  await page.waitForTimeout(800);
  const q = await page.evaluate(() => window.__goals.find(g=>g.t==='ast_quiz_submit')?.p?.quiz_client_type);
  const overridden = q === 'На физлицо';
  if (!overridden) fail++;
  console.log(`   выбор пользователя перебил предустановку: ${JSON.stringify(q)}  ${overridden?'OK':'ПРОВАЛ'}`);
  console.log(`   JS-ошибки: ${errs.length? errs.slice(0,2).join(' | '):'нет'}`);
  if (errs.length) fail++;
  await ctx.close();
}
await browser.close();
console.log(`\n=== провалов: ${fail} ===`);
process.exit(fail ? 1 : 0);
