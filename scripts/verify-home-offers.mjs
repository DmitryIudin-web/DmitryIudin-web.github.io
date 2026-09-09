// Local Chromium regression checks. No requests or submissions reach the site.
// Run: node scripts/verify-home-offers.mjs
// Requires playwright, or PLAYWRIGHT_MODULE pointing to its installed package.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const runtime = await readFile(new URL('../assets/ast-conversion.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../assets/ast-conversion.css', import.meta.url), 'utf8');
const browser = await chromium.launch({ headless: true });
let failures = 0;

function card(id = 'test-g63', title = 'Mercedes-AMG G 63 2026', price = '265 500 USD') {
  return `<article class="ast-related-offer" data-ast-offer-id="${id}">
    <div class="ast-related-offer__body"><h3>${title}</h3>
    <div class="ast-related-offer__price">${price}</div>
    <div class="ast-related-offer__actions">
      <a href="/offers?quoteId=${id}" data-ast-offer-id="${id}" data-ast-offer-action="open">Открыть КП</a>
      <a class="ast-btn" href="#order" data-ast-offer-id="${id}" data-ast-offer-action="order"><span>Заказать расчёт</span></a>
    </div></div></article>`;
}

async function setup({ route = '/', taxPricing, late = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(2000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async request => {
    const url = new URL(request.request().url());
    if (url.hostname !== 'ast.test') return request.abort();
    if (url.pathname === '/assets/ast-conversion.js') return request.fulfill({ contentType: 'text/javascript', body: runtime });
    if (url.pathname === '/assets/ast-conversion.css') return request.fulfill({ contentType: 'text/css', body: styles });
    return request.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head>
      <meta charset="utf-8"><link rel="stylesheet" href="/assets/ast-conversion.css">
      <style>.ast-site-root .ast-hero__lead{color:#72757a!important}.ast-hero{background:white}
        @media(max-width:600px){.ast-hero__lead{display:-webkit-box!important;overflow:hidden!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;max-width:100%!important}}
        .ast-related-offer{width:300px;padding:16px;background:white}.ast-quiz-overlay{z-index:1000}</style>
      </head><body><main class="ast-site-root">
      <section class="ast-hero"><div class="ast-hero__content"><h1>Автомобили под заказ</h1>
      <p class="ast-hero__lead">АСТ начинает с того, что уже доступно в России, затем сравнивает поставку из сильных зарубежных рынков и возвращает короткий список машин, которые действительно стоит рассматривать.</p>
      <div class="ast-actions"><button data-ast-quiz-open>Общий расчёт</button></div></div></section>
      <section id="cards">${late ? '' : card()}</section>
      <section id="lead"><form data-ast-lead-form>
      <input type="hidden" name="consent_version" value="test-consent">
      <button type="submit">Отправить локально</button></form></section></main>
      <script>
        window.__submissions=[];window.__legacyClicks=0;
        window.__astPublicOffersData={offers:[{id:'test-g63',priceAmount:265500,priceCurrency:'USD',
          taxPricing:${JSON.stringify(taxPricing ?? null)}}]};
        window.ym=function(id,method,callback){if(method==='getClientID')callback('test-client');};
        document.querySelector('form').addEventListener('submit',function(e){e.preventDefault();window.__submissions.push(Object.fromEntries(new FormData(e.target)));});
        // Production's earlier document-capture anchor workaround used to consume this click.
        document.addEventListener('click',function(e){if(e.target.closest('[data-ast-offer-action="order"]')){window.__legacyClicks++;e.preventDefault();e.stopImmediatePropagation();}},true);
      </script><script src="/assets/ast-conversion.js"></script></body></html>` });
  });
  await page.goto('http://ast.test' + route + '?utm_source=yandex&utm_campaign=test-campaign');
  return { page, context, errors };
}

async function check(name, fn) {
  let env;
  try {
    env = await setup(fn.options);
    await fn(env.page);
    assert.deepEqual(env.errors, []);
    console.log('PASS ' + name);
  } catch (error) {
    failures++;
    console.error('FAIL ' + name + ': ' + error.message.split('\n')[0]);
  } finally { if (env) await env.context.close(); }
}

async function completeQuiz(page) {
  await page.locator('[data-ast-quiz-next]').click();
  await page.getByRole('button', { name: 'На юрлицо (с НДС)', exact: true }).click();
  await page.getByRole('button', { name: '1–3 месяца', exact: true }).click();
}
async function submitLocal(page) {
  await page.locator('[data-ast-quiz-phone]').fill('+7 000 000-00-00');
  await page.locator('[data-ast-quiz-phone-submit]').click();
  return page.evaluate(() => window.__submissions.at(-1));
}
function options(fn, value) { fn.options = value; return fn; }

try {
  await check('late offer CTA defeats legacy capture, opens quiz and preserves identity + source', options(async page => {
    await page.locator('#cards').evaluate((node, html) => { node.innerHTML = html; }, card());
    await page.locator('[data-ast-offer-action="order"] span').click();
    assert.equal(await page.locator('.ast-quiz-overlay--open').count(), 1);
    assert.equal(await page.locator('[data-ast-quiz-model]').inputValue(), 'Mercedes-AMG G 63 2026');
    assert.equal(await page.evaluate(() => window.__submissions.length), 0);
    assert.equal(await page.evaluate(() => window.__legacyClicks), 0);
    await completeQuiz(page);
    const message = decodeURIComponent(await page.locator('[data-ast-quiz-messenger="telegram"]').getAttribute('href'));
    assert.match(message, /test-g63/);
    const fields = await submitLocal(page);
    assert.equal(fields.offer_id, 'test-g63');
    assert.equal(fields.quoteId, 'test-g63');
    assert.equal(fields.model, 'Mercedes-AMG G 63 2026');
    assert.equal(fields.utm_source, 'yandex');
    assert.equal(fields.utm_campaign, 'test-campaign');
    assert.equal(fields.consent_version, 'test-consent');
    assert.match(fields.comment, /test-g63/);
    const clicks = await page.evaluate(() => window.dataLayer.filter(e => e.event === 'ast_cta_click' && e.offer_id === 'test-g63'));
    assert.equal(clicks.length, 1);
  }, { late: true }));

  await check('keyboard CTA and a subsequent generic quiz do not reuse a previous offer', async page => {
    await page.locator('[data-ast-offer-action="order"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.ast-quiz-overlay--open').count(), 1);
    await completeQuiz(page);
    await submitLocal(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Общий расчёт', exact: true }).click();
    assert.equal(await page.locator('[data-ast-quiz-model]').inputValue(), '');
    await page.locator('[data-ast-quiz-model]').fill('Другая модель');
    await completeQuiz(page);
    const fields = await submitLocal(page);
    assert.equal(fields.offer_id, '');
    assert.equal(fields.quoteId, '');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.astPendingOfferId || ''), '');
  });

  await check('changing the selected model clears the incompatible offer reference', async page => {
    await page.locator('[data-ast-offer-action="order"]').click();
    await page.locator('[data-ast-quiz-model]').fill('Другая модель');
    await completeQuiz(page);
    assert.doesNotMatch(decodeURIComponent(await page.locator('[data-ast-quiz-messenger="telegram"]').getAttribute('href')), /test-g63/);
    assert.equal((await submitLocal(page)).offer_id, '');
  });

  await check('foreign source price never becomes an invented Russian VAT price; dynamic cards remain single', async page => {
    await page.locator('.ast-tax-prices').waitFor();
    assert.match(await page.locator('.ast-tax-prices').innerText(), /Цена без НДС/);
    assert.match(await page.locator('.ast-tax-prices').innerText(), /Цена с НДС/);
    assert.equal(await page.locator('.ast-tax-prices dd').allTextContents().then(a => a.filter(s => s.includes('Уточняется')).length), 2);
    assert.equal(await page.locator('.ast-related-offer__price').innerText(), '265 500 USD');
    await page.locator('#cards').evaluate((node, html) => { node.insertAdjacentHTML('beforeend', html); }, card('test-second', 'BMW X5', 'Цена по запросу'));
    await page.locator('.ast-tax-prices').nth(1).waitFor();
    assert.equal(await page.locator('.ast-tax-prices').count(), 2);
    await page.locator('#cards').evaluate((node, html) => { node.innerHTML = html; }, card());
    await page.locator('.ast-tax-prices').waitFor();
    assert.equal(await page.locator('.ast-tax-prices').count(), 1);
  });

  const pricing = { currency: 'RUB', vatRate: 22, taxRegime: 'standard', evidence: 'seller_claimed', netAmount: 10000000 };
  await check('explicit seller net price gets a separately labelled calculated gross amount', options(async page => {
    await page.locator('.ast-tax-prices').waitFor();
    const text = (await page.locator('.ast-tax-prices').innerText()).replace(/[\s\u00a0\u202f]+/g, ' ');
    assert.match(text, /10 000 000/);
    assert.match(text, /12 200 000/);
    assert.match(text, /22%/);
    assert.match(text, /Заявлено продавцом/);
    assert.match(text, /Расчёт/);
  }, { taxPricing: pricing }));

  for (const [name, value] of Object.entries({
    'foreign tax basis': { ...pricing, currency: 'USD' },
    'margin tax regime': { ...pricing, taxRegime: 'margin' },
    'contradictory amounts': { ...pricing, grossAmount: 11000000 },
    'missing evidence': { ...pricing, evidence: undefined },
    'inherited evidence key': { ...pricing, evidence: 'constructor' },
    'negative amount': { ...pricing, netAmount: -1 },
    'sub-cent amount': { ...pricing, netAmount: 0.001 },
    'missing tax rate': { ...pricing, vatRate: undefined }
  })) {
    await check('reject unsupported pricing: ' + name, options(async page => {
      await page.locator('.ast-tax-prices').waitFor();
      assert.deepEqual(await page.locator('.ast-tax-prices dd').allTextContents(), ['Уточняется', 'Уточняется']);
    }, { taxPricing: value }));
  }

  await check('documented gross price computes net and uses separate provenance', options(async page => {
    await page.locator('.ast-tax-prices').waitFor();
    const text = (await page.locator('.ast-tax-prices').innerText()).replace(/[\s\u00a0\u202f]+/g, ' ');
    assert.match(text, /10 000 000/);
    assert.match(text, /12 200 000/);
    assert.match(text, /Подтверждено документами/);
    assert.match(text, /Расчёт/);
  }, { taxPricing: { ...pricing, evidence: 'document_confirmed', netAmount: undefined, grossAmount: 12200000 } }));

  await check('homepage lead has guaranteed white text on a dark backing despite later legacy CSS', async page => {
    const style = await page.locator('.ast-hero__lead').evaluate(node => {
      const s = getComputedStyle(node); return { color: s.color, background: s.backgroundColor };
    });
    assert.equal(style.color, 'rgb(255, 255, 255)');
    assert.equal(style.background, 'rgba(10, 15, 22, 0.82)');
  });
  await check('mobile hero copy remains fully readable despite old two-line clamp', async page => {
    await page.setViewportSize({ width: 390, height: 844 });
    const size = await page.locator('.ast-hero__lead').evaluate(node => ({ client: node.clientHeight, scroll: node.scrollHeight, display: getComputedStyle(node).display }));
    assert.equal(size.display, 'block');
    assert.equal(size.client, size.scroll);
  });
  await check('offer-list replacement receives prices and removes stale tax information', options(async page => {
    await page.locator('#cards').evaluate(node => { node.id = 'offersGrid'; node.innerHTML = '<article class="offer-card" data-ast-offer-id="test-g63"><div class="offer-card-body"><h3>Mercedes-AMG G 63</h3><div class="offer-actions"></div></div></article>'; });
    await page.locator('.ast-tax-prices').waitFor();
    assert.match(await page.locator('.ast-tax-prices').innerText(), /22%/);
    await page.evaluate(() => { window.__astPublicOffersData.offers[0].taxPricing = null; document.querySelector('h3').textContent = 'Обновлённое предложение'; });
    await page.waitForFunction(() => document.querySelector('.ast-tax-prices dd')?.textContent === 'Уточняется');
    assert.equal(await page.locator('.ast-tax-prices').count(), 1);
  }, { route: '/offers', taxPricing: pricing }));
  await check('individual offer detail also exposes both tax prices beside its source price', options(async page => {
    await page.locator('#cards').evaluate(node => { node.innerHTML = '<div class="ast-public-offer-detail" data-ast-offer-id="test-g63"><div class="detail-price"><strong>265 500 USD</strong><span>Финальная цена уточняется</span></div></div>'; });
    await page.locator('.detail-price .ast-tax-prices').waitFor();
    assert.deepEqual(await page.locator('.ast-tax-prices dd').allTextContents(), ['Уточняется', 'Уточняется']);
    assert.equal(await page.locator('.detail-price strong').innerText(), '265 500 USD');
  }, { route: '/offers' }));
  await check('current private-gallery list and detail receive separate VAT rows', options(async page => {
    await page.locator('#cards').evaluate(node => { node.innerHTML = '<article class="ast-pg-offer" data-ast-offer-card="test-g63"><div class="ast-pg-offer__body"><h3>Test car</h3><strong>Цена после проверки</strong><div class="ast-pg-offer__actions"></div></div></article><div class="ast-pg-offer-detail"><div><h2>Test car</h2><p>Цена после проверки</p><a data-ast-order-offer="test-g63" href="#form">Запросить проверку</a></div></div>'; });
    await page.locator('.ast-pg-offer .ast-tax-prices').waitFor();
    await page.locator('.ast-pg-offer-detail .ast-tax-prices').waitFor();
    assert.equal(await page.locator('.ast-tax-prices').count(), 2);
  }, { route: '/offers' }));
  await check('homepage changes do not intercept model-page CTA or recolour its hero', options(async page => {
    await page.locator('[data-ast-offer-action="order"]').click();
    assert.equal(await page.locator('.ast-quiz-overlay--open').count(), 0);
    assert.equal(await page.locator('.ast-tax-prices').count(), 0);
    assert.equal(await page.locator('.ast-hero__lead').evaluate(node => getComputedStyle(node).color), 'rgb(114, 117, 122)');
  }, { route: '/zeekr-8x' }));
} finally { await browser.close(); }

console.log(failures ? `${failures} failed` : 'All homepage / offer checks passed');
process.exitCode = failures ? 1 : 0;
