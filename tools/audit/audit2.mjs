import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const BASE = 'http://127.0.0.1:8099';
const PAGES = [
  ['главная',    '/'],
  ['модельная',  '/porsche-cayenne-import/'],
  ['безопасная', '/bezopasnaya-sdelka/'],
  ['лизинг',     '/premium-auto-lizing/'],
  ['гайд',       '/guides/rastamozhka-avto-2026/'],
  ['новость',    '/news/porsche/2026-05-10/'],
  ['каталог',    '/offers/'],
  ['tavendor',   '/volkswagen-tavendor-2026/'],
];

const browser = await chromium.launch();
const out = [];

for (const [label, path] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Глушим всё внешнее: в песочнице оно всё равно недоступно и только шумит.
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();

  await page.addInitScript(() => {
    window.__goals = [];
    window.ym = function (id, action, target, params) {
      if (action === 'reachGoal') window.__goals.push({ target, params });
      if (action === 'getClientID' && typeof target === 'function') target('test-client-id');
    };
    // Не даём кликам уводить со страницы.
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a');
      if (a) e.preventDefault();
    }, true);
  });

  const jsErrors = [], otherConsole = [];
  page.on('pageerror', e => jsErrors.push(e.message.split('\n')[0]));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/ERR_|net::|Failed to load resource|TildaStat|ProgressEvent/.test(t)) return; // сетевой шум песочницы
    otherConsole.push(t);
  });

  const r = { label, path, jsErrors, otherConsole };
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);
    r.runtime = await page.evaluate(() => typeof window.ASTConversion === 'object');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.3));
    await page.waitForTimeout(3300);
    const sticky = page.locator('.ast-sticky-cta').first();
    r.sticky = (await sticky.count()) > 0 && await sticky.isVisible();

    r.articleCta = await page.locator('.ast-article-cta').count();
    r.offer = await page.evaluate(() => document.querySelector('[data-offer]')?.getAttribute('data-offer') ?? null);

    // Клик по мессенджер-ссылке через DOM: делегированный обработчик обязан поймать.
    r.msgClicked = await page.evaluate(() => {
      const a = document.querySelector('a[href*="t.me"], a[href*="wa.me"]');
      if (!a) return false;
      a.click();
      return true;
    });
    await page.waitForTimeout(500);
    r.goalsAfterMsg = await page.evaluate(() => window.__goals.map(g => g.target));

    // Клик по CTA-кнопке квиза, если есть.
    r.ctaClicked = await page.evaluate(() => {
      const b = document.querySelector('[data-ast-quiz-open]');
      if (!b) return false;
      b.click();
      return true;
    });
    await page.waitForTimeout(700);
    r.quizVisible = await page.evaluate(() =>
      !!document.querySelector('.ast-quiz, [class*="ast-quiz"]')?.offsetParent);
    r.goals = await page.evaluate(() => window.__goals.map(g => g.target));
    r.goalParams = await page.evaluate(() => {
      const g = window.__goals.find(x => x.target === 'ast_cta_click');
      return g && g.params ? JSON.stringify(g.params) : null;
    });
  } catch (e) {
    r.fatal = e.message.split('\n')[0];
  }
  out.push(r);
  await ctx.close();
}
await browser.close();

let bad = 0;
for (const r of out) {
  console.log(`\n── ${r.label}  ${r.path}`);
  if (r.fatal) { console.log(`   FATAL: ${r.fatal}`); bad++; continue; }
  console.log(`   рантайм=${r.runtime} липкая=${r.sticky} квиз-открылся=${r.quizVisible} article-cta=${r.articleCta} offer=${r.offer}`);
  console.log(`   цели после клика по мессенджеру: ${r.goalsAfterMsg?.join(', ') || '(нет)'}`);
  console.log(`   все цели: ${[...new Set(r.goals || [])].join(', ') || '(нет)'}`);
  if (r.goalParams) console.log(`   params ast_cta_click: ${r.goalParams.slice(0,150)}`);
  if (r.jsErrors.length) { bad++; console.log(`   JS-ОШИБКИ (${r.jsErrors.length}): ` + [...new Set(r.jsErrors)].slice(0,3).join(' | ')); }
  else console.log('   JS-ошибок нет');
  if (r.otherConsole.length) console.log(`   прочее в консоли: ` + [...new Set(r.otherConsole)].slice(0,3).join(' | '));
}
console.log(`\n=== страниц с проблемами: ${bad} из ${out.length} ===`);
