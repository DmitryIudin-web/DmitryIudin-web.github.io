#!/usr/bin/env node
// Проверка того, что реально уходит в приёмник заявок с форм сайта.
//
// Зачем: по состоянию на 06.09.2026 цепочка «заявка → amoCRM» ни разу не была
// проверена end-to-end, а формы сайта относятся к четырём разным семействам с
// разным составом полей. Скрипт заполняет каждую форму тестовыми данными,
// перехватывает POST в /api/max-page/order и печатает таблицу: какие поля
// атрибуции доходят до приёмника, а какие теряются.
//
// Живых записей нет: все запросы к /api/* перехватываются, внешние — блокируются.
//
// Запуск (из корня репозитория):
//   NODE_PATH=$(npm root -g) node scripts/verify-lead-intake.mjs
//   NODE_PATH=$(npm root -g) node scripts/verify-lead-intake.mjs --all
//
// Код возврата 1, если хотя бы одна форма теряет обязательное поле атрибуции —
// это гейт Measurement из docs/bishkek-launch.md, а не просто отчёт.
//
// Режим --live НЕ отправляет ничего сам: он печатает готовый payload с пометкой
// «ТЕСТ» и curl-команду, чтобы владелец выполнил A3-тест со своей машины и
// сверил карточку в amoCRM. Отправка заявки в боевой приёмник — внешний эффект,
// он требует отдельного разрешения владельца.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('playwright не найден: запустите с NODE_PATH=$(npm root -g)');
  process.exit(2);
}

// По одной странице на каждое семейство форм; --all прогоняет весь список.
const FAMILIES = [
  { slug: 'auto-iz-bishkeka', family: 'bishkek', form: '[data-bishkek-form]' },
  { slug: 'rolls-royce-cullinan', family: 'model_page', form: '[data-ast-model-lead-form]' },
  { slug: 'raschet-avto-pod-klyuch', family: 'intent_landing', form: '[data-intent-form]' },
  { slug: 'volkswagen-tavendor-2026', family: 'tavendor', form: '#tavendor-form' },
];
const EXTRA = [
  { slug: 'porsche-cayenne-import', family: 'model_page', form: '[data-ast-model-lead-form]' },
  { slug: 'mercedes-amg-g63', family: 'model_page', form: '[data-ast-model-lead-form]' },
  { slug: 'bentley-bentayga', family: 'model_page', form: '[data-ast-model-lead-form]' },
  { slug: 'auto-s-nds-dlya-biznesa', family: 'intent_landing', form: '[data-intent-form]' },
  { slug: 'auto-v-lizing', family: 'intent_landing', form: '[data-intent-form]' },
  { slug: 'bezopasnaya-pokupka-avto', family: 'intent_landing', form: '[data-intent-form]' },
  { slug: 'logistics-partners-erlyan', family: 'intent_landing', form: 'form' },
];

// Без этих полей заявку нельзя связать с источником и обработать по регламенту
// (crm/lead-schema.md: источник, контакт, согласие, следующий шаг).
const REQUIRED = ['request_id', 'source', 'source_detail', 'page_url', 'contact', 'consent_version'];
// Эти поля определяют, можно ли посчитать CPQL по кампании и модели.
const ATTRIBUTION = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'offer', 'page', 'ym_client_id'];

const UTM = 'utm_source=verify&utm_medium=cpc&utm_campaign=intake_check&utm_content=probe&utm_term=test';
const out = path.resolve(process.env.QA_OUTPUT || 'build/verify-lead-intake');
const targets = process.argv.includes('--all') ? [...FAMILIES, ...EXTRA] : FAMILIES;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}

// Тестовые значения по имени поля: телефон из tracking-check, остальное с пометкой ТЕСТ.
function testValue(name) {
  const n = name.toLowerCase();
  if (/contact|phone|tel/.test(n)) return '+79000000001';
  if (/budget/.test(n)) return '4500000';
  if (/city|город/.test(n)) return 'ТЕСТ-город';
  if (/model|марка/.test(n)) return 'Toyota RAV4';
  if (/name|имя/.test(n)) return 'ТЕСТ заявка';
  if (/mail/.test(n)) return 'test@example.com';
  return 'ТЕСТ';
}

async function fillAndSubmit(page, formSel) {
  const form = page.locator(formSel).first();
  const controls = await form.locator('input, select, textarea').all();
  for (const control of controls) {
    const [tag, type, name, disabled] = await Promise.all([
      control.evaluate(el => el.tagName.toLowerCase()),
      control.evaluate(el => (el.type || '').toLowerCase()),
      control.evaluate(el => el.name || ''),
      control.evaluate(el => el.disabled),
    ]);
    if (disabled || type === 'hidden' || type === 'submit' || type === 'button') continue;
    if (type === 'checkbox') {
      if (/consent|соглас/i.test(name)) await control.check().catch(() => {});
      continue;
    }
    if (type === 'radio') { await control.check().catch(() => {}); continue; }
    if (tag === 'select') {
      const value = await control.evaluate(el => {
        const opt = Array.from(el.options).find(o => o.value && o.value !== '');
        return opt ? opt.value : '';
      });
      if (value) await control.selectOption(value).catch(() => {});
      continue;
    }
    await control.fill(testValue(name)).catch(() => {});
  }
  await form.locator('button[type="submit"], input[type="submit"]').first().click({ timeout: 5000 });
}

fs.mkdirSync(out, { recursive: true });
const port = await freePort();
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
await new Promise(r => setTimeout(r, 800));

const executablePath = process.env.PLAYWRIGHT_CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const rows = [];

try {
  for (const target of targets) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    let payload = null;
    page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        if (!payload) payload = route.request().postDataJSON();
        // Успех, чтобы форма не уходила в каскад и не дублировала запрос.
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      // Внешние домены (Метрика, tildacdn) в этой среде недоступны — блокируем.
      if (url.origin !== base) return route.abort();
      return route.continue();
    });

    let note = '';
    try {
      await page.goto(`${base}/${target.slug}/?${UTM}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      await fillAndSubmit(page, target.form);
      await page.waitForTimeout(1200);
    } catch (error) {
      note = String(error.message).split('\n')[0].slice(0, 120);
    }

    const keys = payload ? Object.keys(payload) : [];
    rows.push({
      slug: target.slug,
      family: target.family,
      submitted: Boolean(payload),
      missingRequired: payload ? REQUIRED.filter(k => !payload[k]) : REQUIRED,
      missingAttribution: payload ? ATTRIBUTION.filter(k => !payload[k]) : ATTRIBUTION,
      fieldCount: keys.length,
      jsErrors: errors.length,
      note,
      payload,
    });
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}

const pad = (s, n) => String(s).padEnd(n);
console.log('\nЧто доходит до приёмника заявок (локально, живых записей нет)\n');
console.log(pad('страница', 28), pad('семейство', 16), pad('полей', 6), pad('нет обязательных', 34), 'нет атрибуции');
for (const r of rows) {
  console.log(
    pad(r.slug, 28), pad(r.family, 16), pad(r.submitted ? r.fieldCount : '—', 6),
    pad(r.missingRequired.join(',') || 'нет', 34),
    r.missingAttribution.join(',') || 'нет',
    r.note ? `| ${r.note}` : '',
  );
}

const broken = rows.filter(r => !r.submitted || r.missingRequired.length);
fs.writeFileSync(path.join(out, 'intake-report.json'),
  JSON.stringify({ checkedAt: new Date().toISOString(), liveWrites: false, rows }, null, 2));

if (process.argv.includes('--live')) {
  const sample = rows.find(r => r.payload);
  console.log('\n--- A3-тест: выполняется владельцем со своей машины ---');
  console.log('Скрипт ничего не отправляет: заявка в боевой приёмник — внешний эффект.');
  console.log('1) Отправьте одну заявку через реальную страницу с пометкой «ТЕСТ» и телефоном +7 900 000-00-01.');
  console.log('2) Проверьте карточку в amoCRM: request_id, source_detail, utm_*, город, бюджет.');
  console.log('3) Результат впишите в docs/tracking-check-2026-09.md §2 и в файл готовности спринта.');
  if (sample) console.log('\nОбразец payload этой формы:\n' + JSON.stringify(sample.payload, null, 2));
}

console.log(`\nОтчёт: ${path.join(out, 'intake-report.json')}`);
if (broken.length) {
  console.log(`\nНЕ ГОТОВО: ${broken.length} форм(ы) теряют обязательные поля — заявку нельзя связать с источником.`);
  process.exit(1);
}
console.log('\nВсе проверенные формы отдают обязательные поля.');
