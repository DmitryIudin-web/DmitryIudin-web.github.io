/* AutoNDS price categories, 2026-10-12. Replaces the unclassified market estimate. */
(function () {
  'use strict';
  var id = 'ast-market-reference-20261012';
  var marker = 'individual-business-order-v1';
  var cssId = 'ast-market-categories-style-20261012';

  function apply() {
    var section = document.getElementById(id);
    if (!section) return false;
    if (section.getAttribute('data-price-scope') === marker) return true;
    if (!document.getElementById(cssId)) {
      var style = document.createElement('style');
      style.id = cssId;
      style.textContent = '#'+id+' .amr-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}' +
        '#'+id+' .amr-price-cell{min-width:0}' +
        '#'+id+' .amr-pending-value{display:block;color:#f6f8fb;font-size:clamp(17px,2vw,22px);font-weight:600;line-height:1.25;overflow-wrap:anywhere}' +
        '#'+id+' .amr-subnote{display:block;margin-top:8px;color:#aab9c9;font-size:12px;line-height:1.5}' +
        '@media(max-width:900px){#'+id+' .amr-grid{grid-template-columns:minmax(0,1fr);gap:20px}}';
      document.head.appendChild(style);
    }
    var name = section.querySelector('.amr-eyebrow');
    var safeName = name ? name.textContent : 'АВТОМОБИЛЬ';
    // textContent below ensures the model name from the existing, allowlisted block stays inert.
    var shell = '<div class="amr-inner"><div class="amr-intro"><span class="amr-eyebrow"></span>' +
      '<h2 id="'+id+'-title">Цены по формату покупки</h2>' +
      '<p class="amr-trim">Новые автомобили и пробег до 1 000 км · период 29.09–12.10.2026</p></div>' +
      '<div class="amr-grid">' +
      '<div class="amr-price-cell"><span class="amr-label">Средняя цена для физлица</span><strong class="amr-pending-value">Данных недостаточно</strong><span class="amr-subnote">Нужна подтверждённая итоговая цена для частного покупателя.</span></div>' +
      '<div class="amr-price-cell"><span class="amr-label">Средняя цена для юрлица</span><strong class="amr-pending-value">Данных недостаточно</strong><span class="amr-subnote">Цена и наличие НДС проверяются отдельно.</span></div>' +
      '<div class="amr-price-cell"><span class="amr-label">Минимальная цена под заказ</span><strong class="amr-pending-value">Не подтверждена</strong><span class="amr-subnote">Нужна полная стоимость до передачи автомобиля в РФ.</span></div></div>' +
      '<p class="amr-note">Проверка начата 12.10.2026. Предыдущая общая средняя не разделяла цены по типу покупателя и не подтверждала пробег; для этих показателей она не применяется.</p>' +
      '<details><summary>Как считаются эти цены</summary><p>Средние считаются отдельно для физического и юридического лица по сопоставимым автомобилям одной версии. В каждую среднюю входят не менее трёх предложений с явно указанной полной ценой для соответствующего покупателя. Цена для юрлица не выводится из цены для физлица пересчётом НДС.</p><p>Минимум под заказ берётся из подтверждённых полных предложений за последние 14 дней. Неизвестный пробег, неясные условия заказа, условные скидки и неподтверждённая цена не считаются готовым ценовым ориентиром. По мере проверки появятся дата, размер выборки и ссылки на предложения.</p></details></div>';
    section.innerHTML = shell;
    section.querySelector('.amr-eyebrow').textContent = safeName;
    section.setAttribute('data-price-scope', marker);
    section.setAttribute('data-checked-at', '2026-10-12');
    return true;
  }

  function start() {
    if (apply()) return;
    var observer = new MutationObserver(function () { if (apply()) observer.disconnect(); });
    observer.observe(document.body, {childList:true, subtree:true});
    setTimeout(function () { observer.disconnect(); apply(); }, 12000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
