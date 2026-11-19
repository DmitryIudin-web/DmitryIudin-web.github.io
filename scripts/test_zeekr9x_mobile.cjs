// Responsive UI regression for the published Tilda shell and its ZEEKR 9X frame.
// Run in CI. Every non-GET/HEAD request is aborted before it can leave the browser.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium, request } = require('playwright');

const SITE = 'https://avtonds.ru';
const PAGES = 'https://dmitryiudin-web.github.io';
const DEPLOYED = process.env.AST_USE_DEPLOYED === '1';
const OUT = path.resolve('artifacts/zeekr9x-mobile');
const overrides = new Set([
  '/zeekr-9x/index.html', '/zeekr-9x/review.css', '/zeekr-9x/review.js',
  '/zeekr-9x/oem/index.html', '/zeekr-9x/oem/ru.css', '/zeekr-9x/oem/mobile.css',
  '/zeekr-9x/oem/app.js', '/zeekr-9x/oem/content.json',
  '/zeekr-9x/oem/specifications.html', '/zeekr-9x/oem/specification-data.json',
]);
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const expectedModels = JSON.parse(fs.readFileSync('zeekr-9x/oem/specification-data.json', 'utf8')).modelList.length;

async function waitForPublication() {
  if (!DEPLOYED) return;
  const files = [
    'zeekr-9x/index.html', 'zeekr-9x/review.css', 'zeekr-9x/review.js',
    'zeekr-9x/oem/index.html', 'zeekr-9x/oem/mobile.css', 'zeekr-9x/oem/app.js',
  ];
  const api = await request.newContext({ timeout: 20000 });
  let pending = files;
  try {
    const deadline = Date.now() + 6 * 60 * 1000;
    while (pending.length && Date.now() < deadline) {
      const checks = await Promise.all(files.map(async file => {
        try {
          const response = await api.get(PAGES + '/' + file + '?mobile_qa=' + Date.now());
          return response.ok() && (await response.body()).equals(fs.readFileSync(file)) ? null : file;
        } catch { return file; }
      }));
      pending = checks.filter(Boolean);
      if (pending.length) {
        console.log('Waiting for published files:', pending.join(', '));
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }
    assert.deepEqual(pending, [], 'published code must match this commit before live UI checks');
  } finally { await api.dispose(); }
}

async function makeContext(browser, width, candidate) {
  const context = await browser.newContext({
    viewport: { width, height: width < 800 ? 844 : 900 },
    isMobile: width < 800,
    hasTouch: width < 800,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const network = { blockedMutations: 0, failedOwnResources: [] };
  let allowedVideo;
  context.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(PAGES + '/zeekr-9x/')) {
      network.failedOwnResources.push({ status: response.status(), url: response.url() });
    }
  });
  await context.route('**/*', async route => {
    const req = route.request();
    if (!['GET', 'HEAD'].includes(req.method())) {
      network.blockedMutations++;
      return route.abort();
    }
    const url = new URL(req.url());
    let pathname = url.pathname;
    if (pathname === '/zeekr-9x/') pathname += 'index.html';
    if (candidate && !DEPLOYED && url.origin === PAGES && overrides.has(pathname)) {
      return route.fulfill({ path: path.resolve('.' + pathname) });
    }
    if (/mc\.yandex\.|googletagmanager\.|google-analytics\./i.test(req.url())) return route.abort();
    if (req.resourceType() === 'media') {
      if (!allowedVideo) allowedVideo = url.origin + url.pathname;
      if (url.origin + url.pathname !== allowedVideo) return route.abort();
    }
    return route.continue();
  });
  return { context, network };
}

async function open(page) {
  const response = await page.goto(SITE + '/zeekr-9x?utm_source=ast_test&utm_campaign=mobile_qa', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  assert.ok(response && response.ok(), 'Tilda page must load successfully');
  const overview = page.frameLocator('#zeekr-9x-review');
  await overview.locator('.hero h1').waitFor({ state: 'visible' });
  await overview.locator('.hero-photo').evaluate(image => {
    if (image.complete && image.naturalWidth) return;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Hero image did not load')), 15000);
      image.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
      image.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Hero image failed')); }, { once: true });
    });
  });
  return overview;
}

function currentFrame(page, oem) {
  const frame = page.frames().find(f => f.url().startsWith(PAGES + '/zeekr-9x/') && f.url().includes('/oem/') === oem);
  assert.ok(frame, 'expected ZEEKR review frame');
  return frame;
}

async function shot(page, prefix, name) {
  await page.screenshot({ path: path.join(OUT, `${prefix}-${name}.png`), fullPage: false });
}

async function metrics(frame) {
  return frame.evaluate(() => {
    const visible = el => !!el.getClientRects().length && getComputedStyle(el).display !== 'none' &&
      getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0;
    const rect = el => {
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    const text = [...document.querySelectorAll('.lead,.sub-desc,.content-desc')]
      .filter(el => visible(el) && el.textContent.trim().length > 15)
      .map(el => ({ selector: el.className, text: el.textContent.trim().slice(0, 90), fontSize: parseFloat(getComputedStyle(el).fontSize), ...rect(el) }));
    const controls = [...document.querySelectorAll('.hero .primary,.hero .secondary,#mobile-menu,[data-action="quote"],.media-controls button,.sequence-frames .tabs-item,.c-tabs-item')]
      .filter(visible).map(el => ({ text: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 70), ...rect(el) }));
    const canvas = document.querySelector('#canvas-car');
    const colors = [...document.querySelectorAll('.sequence-frames .tabs-item')].filter(visible);
    const canvasBox = canvas && rect(canvas);
    const colorOverlap = !!canvasBox && colors.some(el => {
      const b = rect(el);
      return b.y < canvasBox.y + canvasBox.height - 1 && b.y + b.height > canvasBox.y + 1;
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      text, controls, canvas: canvasBox, colorOverlap,
      images: [...document.images].filter(visible).map(el => ({ src: el.getAttribute('src'), loaded: el.complete && el.naturalWidth > 0 })).slice(0, 12),
    };
  });
}

function assertResponsive(data, mobile, label) {
  assert.ok(data.scrollWidth <= data.clientWidth + 2, `${label}: horizontal page overflow ${data.scrollWidth}/${data.clientWidth}`);
  if (!mobile) return;
  assert.ok(data.text.length > 0, `${label}: readable paragraph content exists`);
  const tiny = data.text.filter(t => t.fontSize < 15);
  assert.equal(tiny.length, 0, `${label}: undersized main text ${JSON.stringify(tiny.slice(0, 3))}`);
  for (const button of data.controls) {
    assert.ok(button.width >= 43 && button.height >= 43, `${label}: tap target too small ${JSON.stringify(button)}`);
  }
  assert.equal(data.colorOverlap, false, `${label}: color selectors must sit below the 360 image`);
}

async function fullOverview(page, overview) {
  await overview.getByRole('link', { name: 'Полный обзор', exact: true }).click();
  await overview.locator('.oem-9x [data-action="quote"][role="button"]').first().waitFor({ state: 'attached' });
  return currentFrame(page, true);
}

async function baseline(browser) {
  const { context, network } = await makeContext(browser, 390, false);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const result = { name: 'baseline', width: 390, assertions: false, stages: {} };
  try {
    const overview = await open(page);
    result.stages.short = await metrics(currentFrame(page, false));
    await shot(page, 'baseline-390', 'short');
    const frame = await fullOverview(page, overview);
    result.stages.full = await metrics(frame);
    await shot(page, 'baseline-390', 'full');
    for (const section of [3, 4, 5, 18, 29, 44]) {
      await frame.locator(`[data-section="${section}"]`).scrollIntoViewIfNeeded();
      await shot(page, 'baseline-390', `section-${section}`);
    }
    await frame.locator('.sequence-frames').scrollIntoViewIfNeeded();
    await shot(page, 'baseline-390', 'colors');
    if (await frame.locator('#mobile-menu').isVisible()) {
      await frame.locator('#mobile-menu').click();
      await shot(page, 'baseline-390', 'menu');
    }
  } catch (error) {
    result.error = String(error).slice(0, 800);
    await shot(page, 'baseline-390', 'error').catch(() => {});
  } finally {
    result.network = network;
    results.push(result);
    await context.close();
  }
}

async function candidate(browser, width) {
  const mobile = width < 800;
  const prefix = `${DEPLOYED ? 'live' : 'candidate'}-${width}`;
  const { context, network } = await makeContext(browser, width, true);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const result = { name: DEPLOYED ? 'live' : 'candidate', width, stages: {}, errors: [] };
  page.on('pageerror', error => {
    const stack = String(error.stack || error);
    result.errors.push({ message: String(error).slice(0, 400), stack: stack.slice(0, 1800), fromReview: stack.includes(PAGES + '/zeekr-9x/') });
  });
  try {
    const overview = await open(page);
    const shortFrame = currentFrame(page, false);
    result.stages.short = await metrics(shortFrame);
    assertResponsive(result.stages.short, mobile, `${prefix} short`);
    await shot(page, prefix, 'short');

    await overview.locator('.hero').getByRole('link', { name: 'Рассчитать ZEEKR 9X', exact: true }).click();
    const form = page.locator('#ast-quote-dialog[open] form[data-ast-standard-form]');
    await form.waitFor({ state: 'visible' });
    const formBox = await form.boundingBox();
    assert.ok(formBox && formBox.x >= -1 && formBox.x + formBox.width <= width + 1 &&
      formBox.y >= -1 && formBox.y + formBox.height <= page.viewportSize().height + 1, 'quote form fits the screen');
    assert.equal(await form.locator('input[name="model"]').inputValue(), 'ZEEKR 9X');
    assert.equal(await form.locator('input[name="page"]').inputValue(), '/zeekr-9x');
    const phoneFont = await form.locator('input[type="tel"]').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    if (mobile) assert.ok(phoneFont >= 16, 'phone field must avoid small text and mobile input zoom');
    result.form = { model: 'ZEEKR 9X', page: '/zeekr-9x', phoneFont, submitted: false };
    await shot(page, prefix, 'quote');
    await page.locator('#ast-quote-dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();

    const frame = await fullOverview(page, overview);
    result.stages.full = await metrics(frame);
    assertResponsive(result.stages.full, mobile, `${prefix} full`);
    await shot(page, prefix, 'full');

    if (mobile) {
      const menu = frame.locator('#mobile-menu');
      await menu.click();
      assert.equal(await menu.getAttribute('aria-expanded'), 'true');
      await shot(page, prefix, 'menu');
      const design = frame.locator('[data-anchor="1"]');
      await design.click();
      await frame.waitForFunction(() => document.querySelector('#mobile-menu')?.getAttribute('aria-expanded') === 'false');
      const anchor = await frame.locator('#section-1').boundingBox();
      assert.ok(anchor && anchor.y >= -2 && anchor.y < 180, 'closed-menu anchor lands near the visible section heading');
      await shot(page, prefix, 'design');
    }

    const video = frame.locator('.banner video').first();
    await video.scrollIntoViewIfNeeded();
    await frame.locator('.banner .media-controls').getByRole('button', { name: 'Воспроизвести / пауза', exact: true }).click();
    await frame.waitForFunction(() => {
      const v = document.querySelector('.banner video');
      return v && !v.paused && v.readyState >= 2;
    }, null, { timeout: 30000 });
    result.heroVideoPlayable = true;
    await frame.locator('.banner .media-controls').getByRole('button', { name: 'Воспроизвести / пауза', exact: true }).click();

    if (width === 390) {
      for (const section of [3, 4, 5, 18, 29, 44]) {
        await frame.locator(`[data-section="${section}"]`).scrollIntoViewIfNeeded();
        await shot(page, prefix, `section-${section}`);
      }
    }

    const colors = frame.locator('.sequence-frames .tabs-item');
    assert.equal(await colors.count(), 6, 'all exterior colors retained');
    await colors.nth(1).click();
    await frame.waitForFunction(() => document.querySelector('#canvas-car')?.dataset.color === 'black');
    const canvas = frame.locator('#canvas-car');
    const previousFrame = await canvas.getAttribute('data-frame');
    await frame.getByRole('slider', { name: '360° кузова: стрелки влево и вправо', exact: true }).press('ArrowRight');
    await frame.waitForFunction(before => document.querySelector('#canvas-car')?.dataset.frame !== before, previousFrame);
    result.rotation = { color: await canvas.getAttribute('data-color'), frame: await canvas.getAttribute('data-frame') };
    result.stages.colors = await metrics(frame);
    assertResponsive(result.stages.colors, mobile, `${prefix} colors`);
    await shot(page, prefix, 'colors');
    await colors.nth(0).click();
    await frame.waitForFunction(() => document.querySelector('#canvas-car')?.dataset.color === 'brown');

    if (mobile) await frame.locator('#mobile-menu').click();
    await frame.locator('[data-action="specs"]').click();
    const specs = frame.locator('dialog.specs-dialog[open]');
    await specs.waitFor({ state: 'visible' });
    const row = specs.locator('.parameterList-item').first();
    await row.waitFor({ state: 'visible' });
    result.specificationRows = await specs.locator('.parameterList-item').count();
    assert.ok(result.specificationRows >= 200, 'full specification content is retained');
    if (mobile) {
      const select = specs.locator('select[data-spec-version]');
      await select.waitFor({ state: 'visible' });
      assert.equal(await select.locator('option').count(), expectedModels, 'every model version is available');
      const firstRowValues = await row.locator('.value-item').allTextContents();
      for (let i = 0; i < expectedModels; i++) {
        await select.selectOption({ index: i });
        assert.equal(await row.locator('.value-item:visible').count(), 1, 'mobile specs show one value for the chosen version');
        assert.equal((await row.locator('.value-item:visible').textContent()).trim(), firstRowValues[i].trim(), 'selected specification value must match its version');
      }
      await select.selectOption({ index: 0 });
      const fit = await specs.evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
      assert.ok(fit.scrollWidth <= fit.width + 2, 'mobile specification dialog has no horizontal overflow');
      result.specificationVersions = expectedModels;
    } else {
      assert.equal(await row.locator('.value-item:visible').count(), expectedModels, 'desktop comparison keeps all seven versions');
    }
    await shot(page, prefix, 'specifications');
    await specs.getByRole('button', { name: 'Закрыть характеристики', exact: true }).click();

    // The full review must open the same parent form after the new menu closes.
    if (mobile && await frame.locator('#mobile-menu').getAttribute('aria-expanded') !== 'true') {
      await frame.locator('#mobile-menu').click();
    }
    await frame.locator('.navigation [data-action="quote"]').click();
    await form.waitFor({ state: 'visible' });
    assert.equal(await form.locator('input[name="model"]').inputValue(), 'ZEEKR 9X');
    result.fullReviewQuote = true;
    await page.locator('#ast-quote-dialog').getByRole('button', { name: 'Закрыть', exact: true }).click();
    const outer = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(outer.scrollWidth <= outer.width + 2, 'parent Tilda page has no horizontal overflow');
    assert.deepEqual(result.errors.filter(error => error.fromReview), [], 'review must not raise uncaught JavaScript errors');
    result.ok = true;
  } catch (error) {
    result.ok = false;
    result.failure = String(error).slice(0, 1800);
    result.urls = page.frames().map(frame => frame.url());
    await shot(page, prefix, 'failure').catch(() => {});
  } finally {
    result.network = network;
    results.push(result);
    fs.writeFileSync(path.join(OUT, `${prefix}-metrics.json`), JSON.stringify(result, null, 2));
    await context.close();
  }
}

async function main() {
  await waitForPublication();
  const browser = await chromium.launch({ headless: true });
  try {
    if (!DEPLOYED) await baseline(browser);
    for (const width of [360, 390, 430, 1365]) await candidate(browser, width);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  }
  console.log('MOBILE_RESULTS', JSON.stringify(results.map(({ name, width, ok, failure, form, heroVideoPlayable, rotation, specificationRows, specificationVersions, fullReviewQuote }) => ({ name, width, ok, failure, form, heroVideoPlayable, rotation, specificationRows, specificationVersions, fullReviewQuote }))));
  if (results.some(result => result.assertions !== false && !result.ok)) process.exitCode = 1;
}
main().catch(error => {
  fs.writeFileSync(path.join(OUT, 'fatal.txt'), String(error.stack || error));
  console.error(error);
  process.exitCode = 1;
});
