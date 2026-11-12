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

async function main() {
  const browser = await chromium.launch({headless:true});
  try {
    for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
      const context = await browser.newContext({viewport});
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
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(err=>{console.error(err);process.exitCode=1});
