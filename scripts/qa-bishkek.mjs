#!/usr/bin/env node
// Локальная QA страницы /auto-iz-bishkeka (порт scripts/qa-bishkek.mjs из ветки
// codex/bishkek-postpay-launch репозитория avtonds-ru под статический снапшот).
//
// Поднимает python3 -m http.server на 127.0.0.1, перехватывает все запросы к
// /api/* и блокирует внешние (Метрика, tildacdn), поэтому живых записей нет.
// Проверяет: один H1, noindex, отсутствие горизонтального скролла на 4 ширинах,
// отправку без согласия / с бюджетом 0, сохранение данных при 503, повтор с тем
// же request_id, отказ приёмника ({ok:false}), успех при 200 с JSON и при 204,
// отсутствие JS-ошибок.
//
// Запуск из корня репозитория:
//   NODE_PATH=$(npm root -g) node scripts/qa-bishkek.mjs
// Переменные: BASE_URL (по умолчанию поднимается свой сервер), QA_OUTPUT (папка
// для скриншотов и qa-report.json; по умолчанию build/qa-bishkek).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('playwright не найден: запустите с NODE_PATH=$(npm root -g) или npm i -D playwright');
  process.exit(2);
}

const PAGE = '/auto-iz-bishkeka/';
const out = path.resolve(process.env.QA_OUTPUT || 'build/qa-bishkek');
fs.mkdirSync(out, { recursive: true });

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}

let server;
let base = process.env.BASE_URL;
if (!base) {
  const port = await freePort();
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
  base = `http://127.0.0.1:${port}`;
  await new Promise(r => setTimeout(r, 800));
}
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Только локальная QA');

const executablePath = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const results = [];
let failed = false;
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    let mode = 'error';
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      // /api/* перехватывается на любом origin: каскад идёт на относительный адрес и на api.avtonds.ru.
      if (url.pathname.startsWith('/api/')) {
        requests.push({ url: url.origin + url.pathname, body: route.request().postDataJSON() });
        if (mode === 'empty') return route.fulfill({ status: 204 });
        if (mode === 'rejected') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
        if (mode === 'success') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, order: { id: 'test' } }) });
        return route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' });
      }
      if (url.origin !== new URL(base).origin) return route.abort();
      return route.continue();
    });

    const response = await page.goto(`${base}${PAGE}?utm_source=yandex&utm_medium=cpc&utm_campaign=bishkek_samara&utm_content=rav4&phone=private#frag`);
    assert.equal(response.status(), 200);
    assert.equal(await page.locator('h1').count(), 1, 'ровно один H1');
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://avtonds.ru/auto-iz-bishkeka');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `горизонтальный скролл при ${width}: ${overflow}`);
    await page.screenshot({ path: path.join(out, `page-${width}.png`), fullPage: true });

    const form = page.locator('[data-bishkek-form]');
    await page.locator('[data-model="Toyota RAV4"]').click();
    assert.equal(await form.locator('[name="model"]').inputValue(), 'Toyota RAV4', 'клик по модели подставляет её в форму');
    await page.locator('[data-pickup="samara"]').click();
    assert.equal(await form.locator('[name="pickup"]').inputValue(), 'samara', 'клик по пункту выдачи подставляет его');
    await form.locator('[name="budget"]').fill('4 500 000');
    await form.locator('[name="city"]').fill('Тестовый город');
    await form.locator('[name="contact"]').fill('+70000000000');

    await form.locator('button[type="submit"]').click();
    assert.equal(requests.length, 0, 'без согласия запрос не уходит');
    assert.match(await form.locator('[data-status]').textContent(), /согласие/i);
    await form.locator('[name="consent"]').check();
    await form.locator('[name="budget"]').fill('0');
    await form.locator('button[type="submit"]').click();
    assert.equal(requests.length, 0, 'бюджет 0 — запрос не уходит');
    await form.locator('[name="budget"]').fill('4 500 000');

    // 503 на обоих адресах: данные сохранены, показан fallback.
    await form.locator('button[type="submit"]').click();
    await form.locator('[data-fallback]').waitFor({ state: 'visible' });
    assert.equal(requests.length, 2, 'каскад: относительный адрес, затем api.avtonds.ru');
    assert.equal(requests[1].url, 'https://api.avtonds.ru/api/max-page/order');
    assert.equal(await form.locator('[name="model"]').inputValue(), 'Toyota RAV4', 'данные сохранены после ошибки');
    const first = requests[0].body;
    assert.equal(first.utm_source, 'yandex');
    assert.equal(first.utm_campaign, 'bishkek_samara');
    assert.equal(first.source_detail, 'bishkek_postpay_samara');
    assert.equal(first.business_line, 'bishkek_postpay');
    assert.equal(first.payment_type, 'post_inspection_no_prepayment');
    assert.equal(first.budget, '4500000');
    assert.match(first.comment, /Тестовый город/);
    assert.ok(!first.page_url.includes('private') && !first.page_url.includes('#'), 'в page_url только utm_*');
    assert.equal(requests[1].body.request_id, first.request_id, 'второй адрес получает тот же request_id');
    const whatsapp = await form.locator('[data-fallback-whatsapp]').getAttribute('href');
    assert.ok(whatsapp.startsWith('https://wa.me/79872831255?text='), 'ссылка WhatsApp с текстом заявки');

    // Отказ приёмника: без повтора на втором адресе, тот же request_id, fallback виден.
    mode = 'rejected';
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-bishkek-form] button[type="submit"]').disabled);
    assert.equal(requests.length, 3, 'явный отказ не повторяется на втором адресе');
    assert.equal(requests[2].body.request_id, first.request_id, 'повтор неизменённых данных с тем же request_id');
    assert.match(await form.locator('[data-status]').textContent(), /отклонил/);
    assert.equal(await form.locator('[data-fallback]').isVisible(), true);

    // Успех с JSON: очистка формы, request_id сброшен.
    mode = 'success';
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('[data-bishkek-form] [data-status]').textContent.includes('Данные переданы'));
    assert.equal(requests[3].body.request_id, first.request_id);
    assert.equal(await form.locator('[name="model"]').inputValue(), '', 'форма очищена');
    assert.equal(await form.locator('[name="consent"]').isChecked(), false, 'согласие снято');
    assert.equal(await form.locator('[data-fallback]').isVisible(), false);
    const successEvents = await page.evaluate(() => (window.dataLayer || []).filter(e => e.event === 'form_submit_success').length);
    assert.equal(successEvents, 1, 'form_submit_success ушёл в dataLayer один раз');

    if (width === 390) {
      // 204 без тела — тоже успех; новая заявка получает новый request_id.
      await form.locator('[name="model"]').fill('Другая модель');
      await form.locator('[name="budget"]').fill('3000000');
      await form.locator('[name="city"]').fill('Тест');
      await form.locator('[name="pickup"]').selectOption('spb');
      await form.locator('[name="contact"]').fill('@test_user');
      await form.locator('[name="consent"]').check();
      mode = 'empty';
      await form.locator('button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('[data-bishkek-form] [data-status]').textContent.includes('Данные переданы'));
      assert.equal(requests.length, 5);
      assert.equal(requests[4].body.source_detail, 'bishkek_postpay_spb');
      assert.notEqual(requests[4].body.request_id, first.request_id, 'новая заявка — новый request_id');
      assert.equal(requests[4].body.phone, '+70000000000', 'для Telegram-контакта phone — заглушка, как у модельных страниц');
    }

    assert.deepEqual(errors, [], 'JS-ошибок нет');
    results.push({ width, overflow, mockedRequests: requests.length, ok: true });
    await context.close();
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await browser.close();
  if (server) server.kill();
}
fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), base, liveWrites: false, ok: !failed, results }, null, 2));
console.log(JSON.stringify({ ok: !failed, results }, null, 2));
process.exit(failed ? 1 : 0);
