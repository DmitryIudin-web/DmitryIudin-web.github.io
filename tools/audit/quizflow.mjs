import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const BASE = 'http://127.0.0.1:8099';
const browser = await chromium.launch();

for (const [label, path] of [['модельная','/porsche-cayenne-import/'], ['лизинг','/premium-auto-lizing/'], ['главная','/']]) {
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__goals = [];
    window.ym = (id,a,t,p) => { if (a==='reachGoal') window.__goals.push({t,p}); if (a==='getClientID'&&typeof t==='function') t('cid'); };
    document.addEventListener('click', e => { const a=e.target.closest?.('a'); if(a) e.preventDefault(); }, true);
  });
  const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.goto(BASE+path, {waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  console.log(`\n══════ ${label}  ${path} ══════`);

  await page.evaluate(() => window.ASTConversion.openQuiz());
  await page.waitForTimeout(400);

  const model = await page.locator('[data-ast-quiz-model]').inputValue();
  console.log(`  шаг 1 — авто предзаполнено: "${model}"`);
  await page.locator('[data-ast-quiz-next]').click();
  await page.waitForTimeout(350);

  const clientOpts = await page.locator('[data-ast-quiz-client]').allTextContents();
  console.log(`  шаг 2 — варианты: ${clientOpts.join(' / ')}`);
  await page.locator('[data-ast-quiz-client]').nth(1).click();   // «На юрлицо (с НДС)»
  await page.waitForTimeout(350);

  const timeOpts = await page.locator('[data-ast-quiz-timeline]').allTextContents();
  console.log(`  шаг 3 — сроки: ${timeOpts.join(' / ')}`);
  await page.locator('[data-ast-quiz-timeline]').first().click();
  await page.waitForTimeout(400);

  const finalOrder = await page.evaluate(() =>
    [...document.querySelectorAll('.ast-quiz__final > a, .ast-quiz__final > button, .ast-quiz__final > input, .ast-quiz__final > .ast-quiz__divider')]
      .map(e => e.tagName.toLowerCase() + ':' + ((e.textContent||e.placeholder||'').trim().slice(0,32))));
  console.log(`  финал — порядок: ${JSON.stringify(finalOrder)}`);
  console.log(`  согласие отмечено: ${await page.locator('[data-ast-quiz-consent]').isChecked()}, ссылка на /privacy: ${await page.locator('.ast-quiz__consent a[href*="privacy"]').count()>0}`);

  const tgText = decodeURIComponent(await page.locator('[data-ast-quiz-messenger="telegram"]').getAttribute('href'));
  console.log(`  Telegram-текст: ${tgText.split('text=')[1]?.slice(0,120)}`);

  // Телефонный финал.
  await page.locator('[data-ast-quiz-phone]').fill('+7 900 000-00-01');
  await page.locator('[data-ast-quiz-phone-submit]').click();
  await page.waitForTimeout(900);
  const success = await page.locator('.ast-quiz__success').count();
  const err = (await page.locator('[data-ast-quiz-error]').textContent().catch(()=>''))?.trim();
  console.log(`  после отправки телефона: success-экран=${success>0}${err?`, ошибка="${err}"`:''}`);
  const goals = await page.evaluate(() => window.__goals.map(g => ({t:g.t, p:g.p})));
  console.log(`  цели: ${[...new Set(goals.map(g=>g.t))].join(', ')}`);
  const q = goals.find(g=>g.t==='ast_quiz_submit');
  if (q) console.log(`  params ast_quiz_submit: ${JSON.stringify(q.p).slice(0,220)}`);
  console.log(`  JS-ошибки: ${errs.length? errs.slice(0,2).join(' | ') : 'нет'}`);
  await ctx.close();
}
await browser.close();
