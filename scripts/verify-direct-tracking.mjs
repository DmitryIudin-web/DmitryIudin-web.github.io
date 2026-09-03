// Проверка контура измерения Яндекс.Директа в assets/ast-conversion.js.
// Источник требований: аудит отказов Директа от 14.05.2026 (шаг 5 —
// «проверить отказы по utm_content и utm_source_type») и план AST Reserve v2
// (п. 4.2 — версия текста согласия уходит с заявкой).
//
// Запуск:
//   npx --yes http-server -p 8199 -s .        # в отдельном терминале, из корня репозитория
//   npx --yes playwright@1.56 install chromium # один раз, если Chromium не стоит
//   node scripts/verify-direct-tracking.mjs
//
// Метрика и внешние ресурсы Tilda в песочнице недоступны — window.ym
// подменяется стабом, а сетевые ошибки внешних хостов не считаются провалом.
// Значимая проверка на ошибки — pageerror (непойманные исключения).
import pw from 'playwright';
const { chromium } = pw;

const BASE = 'http://127.0.0.1:8199';
// URL из раздела «Applied: осторожный вариант» аудита, ad 1909924594854344322,
// со значениями, которые Директ подставляет вместо {шаблонов}.
const DIRECT_QS = [
  'utm_source=yandex', 'utm_medium=cpc', 'utm_campaign=porsche_tatarstan_b2b',
  'utm_content=porsche_b2b_nds_1909924594854344322', 'utm_term=---autotargeting',
  'utm_campaign_id=709743299', 'utm_group_id=5749089993',
  'utm_source_type=type1', 'utm_position_type=premium',
  'utm_device=desktop', 'utm_retargeting=0'
].join('&');

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail === undefined ? '' : '  ' + detail));
}
page.on('pageerror', e => errors.push(String(e)));
const netNoise = [];
page.on('console', m => { if (m.type() !== 'error') return;
  const t = m.text();
  // Счётчик Tilda (stats.tilda.cc) недоступен офлайн и логирует свои ошибки —
  // они одинаковы до и после правок рантайма, это не регрессия.
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|Failed to load resource|TildaStat|ProgressEvent/.test(t)) netNoise.push(t);
  else errors.push('console: ' + t); });

// Стаб Метрики до загрузки рантайма.
await page.addInitScript(() => {
  window.__ym = [];
  window.ym = function () { window.__ym.push(Array.from(arguments)); };
});

await page.goto(`${BASE}/porsche-import/?${DIRECT_QS}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const calls = await page.evaluate(() => window.__ym);
const visitParams = calls.filter(c => c[1] === 'params');
const reachGoals = calls.filter(c => c[1] === 'reachGoal');


// 1. Параметры визита ушли и содержат utm_source_type + utm_content.
const src = visitParams[0]?.[2]?.ast_source || {};
const ok1 = visitParams.length === 1 && src.utm_source_type === 'type1'
  && src.utm_content === 'porsche_b2b_nds_1909924594854344322'
  && src.utm_campaign_id === '709743299' && src.utm_group_id === '5749089993'
  && src.landing_page === '/porsche-import';
check('visit params carry Direct dims (utm_source_type, utm_content, ids)', ok1, JSON.stringify(src));

// 2. Скрытые поля формы заполнены расширенным набором + версией согласия.
await page.evaluate(() => { if (window.ASTConversion) window.ASTConversion.openQuiz({}); });
await page.waitForTimeout(400);
const hidden = await page.evaluate(() => {
  const f = document.querySelector('form.t-form, form.ast-launch-form, form[data-ast-lead-form]');
  if (!f) return null;
  const out = {};
  f.querySelectorAll('input[type=hidden]').forEach(i => { if (i.name) out[i.name] = i.value; });
  return out;
});
const ok2 = hidden && hidden.utm_source_type === 'type1' && hidden.utm_group_id === '5749089993'
  && hidden.consent_version === 'privacy-2026-05-12' && hidden.offer && hidden.page === '/porsche-import';
check('CRM hidden fields carry source + consent_version', ok2,
  JSON.stringify(hidden && { utm_source_type: hidden.utm_source_type, utm_group_id: hidden.utm_group_id,
    consent_version: hidden.consent_version, offer: hidden.offer, page: hidden.page }));

// 3. ast_form_start сработал ровно один раз (открытие квиза).
const starts = reachGoalsAfter(await page.evaluate(() => window.__ym));
function reachGoalsAfter(all) { return all.filter(c => c[1] === 'reachGoal' && c[2] === 'ast_form_start'); }
check('ast_form_start fires on form/quiz start', starts.length === 1, JSON.stringify(starts.map(s => s[3])));

// 4. Дедупликация: повторное открытие квиза не шлёт второй form_start.
await page.evaluate(() => { if (window.ASTConversion) window.ASTConversion.openQuiz({}); });
await page.waitForTimeout(300);
const starts2 = reachGoalsAfter(await page.evaluate(() => window.__ym));
check('ast_form_start deduplicated within a visit', starts2.length === 1, 'count=' + starts2.length);

// 5. Органика: без source-параметров ast_source не шлётся.
const p2 = await ctx.newPage();
await p2.addInitScript(() => { window.__ym = []; window.ym = function () { window.__ym.push(Array.from(arguments)); }; });
await p2.goto(`${BASE}/bezopasnaya-sdelka/`, { waitUntil: 'domcontentloaded' });
await p2.waitForTimeout(2500);
const organic = (await p2.evaluate(() => window.__ym)).filter(c => c[1] === 'params');
check('no ast_source params on an organic visit', organic.length === 0, String(organic.length));

check('no uncaught JS errors', errors.length === 0, errors.length ? JSON.stringify(errors) : '');
console.log('      (blocked external resources, expected offline: ' + netNoise.length + ')');
await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
process.exit(failed.length ? 1 : 0);
