// Smoke test the candidate runtime against live page markup.
// Every non-GET request is blocked: this test never sends a production inquiry.
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const runtime = fs.readFileSync('assets/ast-conversion.js', 'utf8');
const base = 'https://avtonds.ru';

async function standard(form, name, trim) {
  await form.waitFor({state:'visible', timeout:30000});
  assert.equal(await form.locator('input[type=tel]').count(), 1, 'one phone field');
  assert.equal(await form.locator('input[type=checkbox][name=consent]').count(), 1, 'one consent');
  assert.equal(await form.locator('input:not([type=hidden]),select,textarea').count(), 2, 'no extra visible fields');
  assert.equal((await form.locator('button[type=submit]').innerText()).trim(), 'Отправить заявку');
  if (name) assert.equal(await form.locator('[name=model]').inputValue(), name);
  if (trim) assert.equal(await form.locator('[name=trim]').inputValue(), trim);
}

async function checkSafeDeal(page) {
  const path = '/bezopasnaya-sdelka';
  const tags = {
    utm_source: 'ast_test', utm_medium: 'cpc', utm_campaign: 'safe_deal_qa',
    utm_content: 'final_cta', utm_term: 'аккредитив', yclid: '1234500006789'
  };
  const width = page.viewportSize().width;
  const row = page.locator('.ast-actions:has([data-ast-source-section="final"])');
  const quote = row.locator('[data-ast-quote-open]:visible');
  const responses = [];
  const recordResponse = response => {
    const url = new URL(response.url());
    if (response.request().isNavigationRequest() || url.pathname.endsWith('/assets/ast-conversion.js')) {
      responses.push({url: url.origin + url.pathname, status: response.status()});
    }
  };
  page.on('response', recordResponse);
  try {
    // Revisit without query parameters so a value echoed from the URL cannot pass.
    for (const query of ['?' + new URLSearchParams(tags), '']) {
      const response = await page.goto(base + path + query, {waitUntil:'domcontentloaded', timeout:60000});
      assert.ok(response && response.ok(), 'safe-deal document HTTP ' + response?.status());
      await quote.first().waitFor({state:'visible'});
      assert.equal(await quote.count(), 1, 'one visible final safe-deal quote action');
      assert.equal(await quote.getAttribute('data-ast-safe-cta'), 'primary');
    }
    await quote.click();
    const form = page.locator('#ast-quote-dialog[open] form[data-ast-standard-form]');
    await standard(form);
    await form.locator('input[type=tel]').fill('+70000000000');
    await form.locator('input[name=consent]').check();
    // The context route aborts this POST. Inspect its fields before any server receives it.
    const [request] = await Promise.all([
      page.waitForRequest(req => req.method() === 'POST' &&
        /^https:\/\/forms2?\.tilda(?:cdn\.com|api\.[a-z]+)\/procces\//.test(req.url()), {timeout:20000}),
      form.locator('button[type=submit]').click()
    ]);
    const fields = request.postDataJSON();
    const expected = {...tags, Phone:'+70000000000', consent:'yes', is_test:'yes', page:path, offer:'safe-deal'};
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(fields[key], value, 'safe-deal outgoing field ' + key);
    }
    assert.ok(fields.request_id, 'safe-deal request ID');
    const pageUrl = new URL(fields.page_url);
    assert.equal(pageUrl.pathname.replace(/\/$/, ''), path);
    assert.equal(pageUrl.search, '', 'outgoing attribution came from the earlier visit');
    console.log('PASS safe-deal final form, blocked Tilda POST and retained UTM/yclid: ' + width);
  } catch (error) {
    const actions = await row.locator('a,button').evaluateAll(elements => elements.map(el => ({
      label: el.textContent.trim(), href: el.getAttribute('href'), opener: el.hasAttribute('data-ast-quote-open'),
      duplicate: el.hasAttribute('data-ast-quote-duplicate'), display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility, width: el.getBoundingClientRect().width
    })));
    console.error('SAFE DEAL DIAGNOSTIC', {width, url:page.url(), title:await page.title(), responses,
      finalMarkers:await page.locator('[data-ast-source-section="final"]').count(), rows:await row.count(),
      quoteDialog:await page.locator('#ast-quote-dialog').count(), actions});
    throw error;
  } finally {
    page.off('response', recordResponse);
  }
}

async function main() {
  const browser = await chromium.launch({headless:true});
  try {
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const context = await browser.newContext({viewport, serviceWorkers:'block'});
      await context.route('**/*', async route => {
        const request = route.request();
        if (!['GET','HEAD'].includes(request.method())) return route.abort();
        if (process.env.AST_USE_DEPLOYED !== '1' && /\/assets\/ast-conversion\.js(?:\?|$)/.test(request.url())) {
          return route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:runtime});
        }
        if (['image','media','font'].includes(request.resourceType())) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(45000);
      await page.goto(base+'/zeekr-8x?view=specifications&version=shadow&trim=Shadow&utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
      const shadow=page.locator('#ast-oem-root article').filter({has:page.getByRole('heading',{name:'Shadow',exact:true})});
      await shadow.getByRole('button',{name:'Рассчитать поставку'}).click();
      const dialog=page.locator('#ast-oem-root [role=dialog].ast-inquiry');
      const zeekr=dialog.locator('form[data-ast-standard-form]');
      await standard(zeekr,'ZEEKR 8X','Shadow');
      assert.equal(await zeekr.locator('[name=market]').inputValue(),'Китай');
      assert.equal(await dialog.locator('.ast-form-progress').isVisible(),false,'legacy steps hidden');
      await page.screenshot({path:'zeekr-form-'+viewport.width+'.png'});
      await dialog.getByRole('button',{name:'Закрыть расчёт'}).click();

      await page.goto(base+'/zeekr-8x?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('#ast-model-inquiry form[data-ast-standard-form]').waitFor({state:'visible',timeout:45000});
      await page.getByRole('tab',{name:'Серый «Лунное море»'}).click();
      await page.getByRole('tab',{name:'Чистый чёрный'}).click();
      const inline=page.locator('#ast-model-inquiry form[data-ast-standard-form]');
      await standard(inline,'ZEEKR 8X');
      await inline.locator('input[type=tel]').fill('+70000000000');
      await inline.locator('input[name=consent]').check();
      await inline.locator('button[type=submit]').click();
      assert.equal(await inline.locator('[name=exterior_color]').inputValue(),'Серый «Лунное море»');
      assert.equal(await inline.locator('[name=interior_color]').inputValue(),'Чистый чёрный');
      console.log('PASS ZEEKR modal and inline: '+viewport.width);

      await page.goto(base+'/volkswagen-tiguan-l-pro?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
      try {
        await page.locator('a[data-trim-label="380TSI Люкс"]').click({timeout:20000});
      } catch (error) {
        console.log('TIGUAN DIAGNOSTIC', JSON.stringify({url:page.url(),title:await page.title(),html:(await page.locator('body').innerText()).slice(0,1600),links:await page.locator('a[data-lead-open]').count()}));
        await page.screenshot({path:'zeekr-form-tiguan-diagnostic.png'});
        throw error;
      }
      const tiguan=page.locator('#ast-quote-dialog[open] form[data-ast-standard-form]');
      await standard(tiguan,'Volkswagen Tiguan L Pro','380TSI Люкс (380TSI 豪华版)');
      assert.equal(await page.locator('#ast-request').evaluate(el=>el.open),false,'legacy wizard stays closed');
      console.log('PASS Tiguan selection: '+viewport.width);

      await page.goto(base+'/nissan-qashqai-china?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('button[data-open][data-ast-quote-open]').click();
      const nissan=page.locator('#ast-quote-dialog[open] form[data-ast-standard-form]');
      await standard(nissan,'Nissan Qashqai');
      assert.equal(await nissan.locator('[name=market]').inputValue(),'Китай');
      assert.equal(await page.locator('#vb-r31-model-form').evaluate(el=>el.closest('dialog').open),false,'legacy Nissan form stays closed');
      console.log('PASS Nissan request: '+viewport.width);

      await page.goto(base+'/audi-a5l?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
      const audi=page.locator('form[data-ast-standard-form]').filter({visible:true}).first();
      await standard(audi,'Audi A5L');
      console.log('PASS Audi A5L canary: '+viewport.width);
      await checkSafeDeal(page);
      const priceRows = [
        ['premium-auto-moskva', '.ast-actions:has([data-ast-hero-telegram])'],
        ['premium-auto-s-nds', '.ast-actions:has([data-ast-hero-telegram])'],
        ['rolls-royce-cullinan-podbor', '.rrc-actions:has([data-cta="cullinan_hero_primary"])'],
        ['volkswagen-tavendor-2026', '.actions:has(a[data-ast-message]):not(:has([data-tavendor-goal="request"]))']
      ];
      if (viewport.width > 1000) priceRows.push(['bmw-x3', '.rrc-hdr__right']);
      for (const [slug, selector] of priceRows) {
        await page.goto(base+'/'+slug+'?utm_source=ast_test',{waitUntil:'domcontentloaded',timeout:60000});
        const row = page.locator(selector);
        const quote = row.locator('[data-ast-quote-open]:visible');
        await quote.first().waitFor({state:'visible'});
        assert.equal(await quote.count(), 1, slug+' has one visible quote action');
        await quote.click();
        const dialog = page.locator('#ast-quote-dialog[open]');
        if (await dialog.isVisible()) {
          await standard(dialog.locator('form[data-ast-standard-form]'));
          await dialog.locator('.ast-quote-close').click();
        } else {
          const anchor = new URL(page.url()).hash;
          assert.ok(['#request','#lead'].includes(anchor), slug+' opens its inline form');
          await standard(page.locator(anchor+' form[data-ast-standard-form]:visible'));
        }
        console.log('PASS single quote action and form: '+slug+' '+viewport.width);
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(err=>{console.error(err);process.exitCode=1});
