/* AutoNDS compact buyer prices and BMW X5 pilot, 2026-10-12. */
(function () {
  'use strict';
  var routes = {"/bmw-x5-import":"bmw-x5-import","/gle-oem":"mercedes-benz-gle-import","/porsche-cayenne-import":"porsche-cayenne-import","/lx-oem":"lexus-lx","/zeekr-8x":"zeekr-8x","/x6-oem":"bmw-x6","/bmw-x7":"bmw-x7","/gls-oem":"mercedes-benz-gls-import","/s-class-oem":"mercedes-benz-s-class-import","/g63-oem":"mercedes-amg-g63","/911-oem":"porsche-911","/porsche-911-dakar":"porsche-911-dakar","/panamera-oem":"porsche-panamera-import","/land-cruiser-300-oem":"toyota-land-cruiser-300","/range-rover-original":"range-rover","/li-auto-l9-oem":"li-auto-l9","/li-auto-l6-oem":"li-auto-l6","/zeekr-9x":"zeekr-9x","/voyah-taishan":"voyah-taishan","/mazda-cx-5":"mazda-cx-5","/toyota-bz3x":"toyota-bz3x","/toyota-rav4-oem":"toyota-rav4","/toyota-highlander-china":"toyota-highlander-china","/audi-q5l":"audi-q5l","/bmw-x3-oem":"bmw-x3","/volkswagen-tiguan-l-pro":"volkswagen-tiguan-l-pro","/gx-oem":"lexus-gx","/prado-250-oem":"toyota-prado-250","/dbx707-oem":"aston-martin-dbx707","/bentley-bentayga":"bentley-bentayga","/bentley-torcal":"bentley-torcal","/continental-gt-oem":"bentley-continental-gt","/purosangue-oem":"ferrari-purosangue","/urus-oem":"lamborghini-urus","/rolls-royce-cullinan":"rolls-royce-cullinan","/mercedes-benz-gle-import":"mercedes-benz-gle-import","/lexus-lx":"lexus-lx","/bmw-x6":"bmw-x6","/mercedes-benz-gls-import":"mercedes-benz-gls-import","/mercedes-benz-s-class-import":"mercedes-benz-s-class-import","/mercedes-amg-g63":"mercedes-amg-g63","/porsche-911":"porsche-911","/porsche-panamera-import":"porsche-panamera-import","/toyota-land-cruiser-300":"toyota-land-cruiser-300","/range-rover":"range-rover","/li-auto-l9":"li-auto-l9","/li-auto-l6":"li-auto-l6","/toyota-rav4":"toyota-rav4","/bmw-x3":"bmw-x3","/lexus-gx":"lexus-gx","/toyota-prado-250":"toyota-prado-250","/aston-martin-dbx707":"aston-martin-dbx707","/bentley-continental-gt":"bentley-continental-gt","/ferrari-purosangue":"ferrari-purosangue","/lamborghini-urus":"lamborghini-urus","/bmw-x5-import-podbor":"bmw-x5-import","/bmw-x7-legacy":"bmw-x7","/x7-oem":"bmw-x7","/zeekr-8x-podbor":"zeekr-8x","/rolls-royce-cullinan-podbor":"rolls-royce-cullinan","/cullinan-oem":"rolls-royce-cullinan","/bentley-bentayga-podbor":"bentley-bentayga","/bentayga-oem":"bentley-bentayga","/range-rover-oem":"range-rover","/zeekr-9x-podbor":"zeekr-9x","/mazda-cx-5-podbor":"mazda-cx-5","/audi-q5l-podbor":"audi-q5l","/volkswagen-tiguan-l-pro-podbor":"volkswagen-tiguan-l-pro","/toyota-bz3x-podbor":"toyota-bz3x","/xiaomi-n90":"xiaomi-n90","/volkswagen-tavendor-2026":"volkswagen-tavendor-2026","/volkswagen-tiguan-l-china":"volkswagen-tiguan-l-china","/changan-qiyuan-q05":"changan-qiyuan-q05","/unimog-offroad-oem":"unimog-offroad-oem"};
  var names = {"bmw-x5-import":"BMW X5","mercedes-benz-gle-import":"Mercedes-Benz GLE","porsche-cayenne-import":"Porsche Cayenne","lexus-lx":"Lexus LX","zeekr-8x":"ZEEKR 8X","bmw-x6":"BMW X6","bmw-x7":"BMW X7","mercedes-benz-gls-import":"Mercedes-Benz GLS","mercedes-benz-s-class-import":"Mercedes-Benz S-Class","mercedes-amg-g63":"Mercedes-AMG G 63","porsche-911":"Porsche 911","porsche-911-dakar":"Porsche 911 Dakar","porsche-panamera-import":"Porsche Panamera","toyota-land-cruiser-300":"Toyota Land Cruiser 300","range-rover":"Land Rover Range Rover","li-auto-l9":"Li Auto L9","li-auto-l6":"Li Auto L6","zeekr-9x":"ZEEKR 9X","voyah-taishan":"Voyah Taishan","mazda-cx-5":"Mazda CX-5","toyota-bz3x":"Toyota bZ3X","toyota-rav4":"Toyota RAV4","toyota-highlander-china":"Toyota Highlander","audi-q5l":"Audi Q5L","bmw-x3":"BMW X3","volkswagen-tiguan-l-pro":"Volkswagen Tiguan L Pro","lexus-gx":"Lexus GX","toyota-prado-250":"Toyota Prado 250","aston-martin-dbx707":"Aston Martin DBX707","bentley-bentayga":"Bentley Bentayga","bentley-torcal":"Bentley Torcal","bentley-continental-gt":"Bentley Continental GT","ferrari-purosangue":"Ferrari Purosangue","lamborghini-urus":"Lamborghini Urus","rolls-royce-cullinan":"Rolls-Royce Cullinan","xiaomi-n90":"Xiaomi N90","volkswagen-tavendor-2026":"Volkswagen Tavendor","volkswagen-tiguan-l-china":"Volkswagen Tiguan L","changan-qiyuan-q05":"Changan Qiyuan Q05","unimog-offroad-oem":"Mercedes-Benz Unimog"};
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var model = routes[path];
  if (!model) return;
  if (path !== '/bmw-x5-import') {
    // The other models have no audited numeric snapshot yet. Hide old placeholders.
    var hidden = document.createElement('style');
    hidden.textContent = '#ast-market-reference-20261012{display:none!important}';
    document.head.appendChild(hidden);
    return;
  }
  var id = 'ast-market-reference-20261012';
  var marker = 'buyer-category-compact-v1';
  var styleId = 'ast-market-compact-style-20261012';

  function addStyle() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent =
      '#'+id+'{display:block!important;position:relative!important;z-index:1;box-sizing:border-box;width:100%;margin:0!important;padding:20px 24px!important;background:#101b29!important;color:#f6f8fb!important;font-family:Arial,sans-serif!important;text-align:left!important;line-height:1.35!important;letter-spacing:normal!important}' +
      '#'+id+' *{box-sizing:border-box}' +
      '#'+id+' .amr-inner{max-width:1120px;margin:auto}' +
      '#'+id+' .amr-eyebrow{display:block;color:#96b5cd;font-size:10px;letter-spacing:1.2px;line-height:1.3}' +
      '#'+id+' h2{color:#fff!important;font-family:inherit!important;font-size:22px!important;font-weight:600!important;line-height:1.2!important;letter-spacing:-.3px!important;text-transform:none!important;margin:5px 0 0!important}' +
      '#'+id+' .amr-meta{margin:5px 0 0!important;color:#bdc9d6!important;font-size:12px!important;line-height:1.35!important}' +
      '#'+id+' .amr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:14px 0 9px;padding:11px 0;border-top:1px solid #314052;border-bottom:1px solid #314052}' +
      '#'+id+' .amr-cell{min-width:0}' +
      '#'+id+' .amr-label{display:block;color:#bdc9d6;font-size:11px;line-height:1.3;margin:0 0 5px}' +
      '#'+id+' .amr-value{display:block;color:#fff;font-size:18px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}' +
      '#'+id+' .amr-foot{margin:0!important;color:#aab9c9!important;font-size:11px!important;line-height:1.4!important}' +
      '#'+id+' details{margin:8px 0 0;border:0;padding:0}' +
      '#'+id+' summary{display:list-item;list-style:revert;cursor:pointer;max-width:max-content;color:#c8dded;font-size:11px;line-height:1.4}' +
      '#'+id+' summary:focus-visible{outline:2px solid #a9dbc1;outline-offset:3px}' +
      '#'+id+' details p{color:#bdc9d6!important;font-size:11px!important;line-height:1.5!important;max-width:790px!important;margin:8px 0!important}' +
      '#'+id+' details a{color:#a9dbc1!important;text-decoration:underline!important}' +
      '@media(max-width:700px){#'+id+'{padding:15px 16px!important}#'+id+' h2{font-size:20px!important}#'+id+' .amr-meta{font-size:11px!important}#'+id+' .amr-grid{display:block;margin:10px 0 7px;padding:3px 0}#'+id+' .amr-cell{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #314052}#'+id+' .amr-cell:last-child{border-bottom:0}#'+id+' .amr-label{font-size:11px;margin:0}#'+id+' .amr-value{font-size:14px;text-align:right;max-width:150px}#'+id+' .amr-foot{font-size:10px!important}#'+id+' details{margin-top:6px}}';
    document.head.appendChild(style);
  }

  function anchorForPage() {
    var heading = document.querySelector('main h1, h1');
    var anchor = heading ? heading.closest('section') : document.querySelector('#app #hero');
    if (!heading && !anchor) return null;
    if (!anchor && heading) {
      for (var parent = heading.parentElement; parent && parent !== document.body && parent.tagName !== 'MAIN'; parent = parent.parentElement) {
        if (/hero/i.test(parent.className || '')) anchor = parent;
      }
    }
    return anchor || (heading && heading.parentElement);
  }

  function insert() {
    var section = document.getElementById(id);
    if (section && section.getAttribute('data-price-scope') === marker) return true;
    if (!section) {
      var anchor = anchorForPage();
      if (!anchor || !anchor.parentElement) return false;
      section = document.createElement('aside');
      section.id = id;
      anchor.insertAdjacentElement('afterend', section);
    }
    addStyle();
    section.setAttribute('aria-labelledby', id + '-title');
    section.setAttribute('data-model', model);
    section.setAttribute('data-price-scope', marker);
    section.setAttribute('data-checked-at', '2026-10-12');
    section.innerHTML = '<div class="amr-inner"><span class="amr-eyebrow"></span>' +
      '<h2 id="'+id+'-title">Цены по типу покупки</h2>' +
      '<p class="amr-meta">BMW X5 30Li, G18 · 2026 · новые или до 1 000 км</p>' +
      '<div class="amr-grid">' +
      '<div class="amr-cell" data-metric="individual"><span class="amr-label">Средняя · физлицо (3)</span><strong class="amr-value">10 283 000 ₽</strong></div>' +
      '<div class="amr-cell" data-metric="business"><span class="amr-label">Средняя · юрлицо, с НДС (2)</span><strong class="amr-value">12 892 000 ₽</strong></div>' +
      '<div class="amr-cell" data-metric="order"><span class="amr-label">Минимум под заказ</span><strong class="amr-value">от 8 420 000 ₽</strong></div></div>' +
      '<p class="amr-foot">Срез 12.10.2026 · ориентир АСТ −2% от средних: 10 078 000 ₽ / 12 634 000 ₽ · повтор 26.10.</p>' +
      '<details><summary>Расчёт и источники</summary><p>Открытые цены предложений, не цены завершённых сделок. Средняя для физлица: (10 500 000 + 10 500 000 + 9 850 000) / 3 = 10 283 333 ₽. Для юрлица: (14 993 800 + 10 790 000) / 2 = 12 891 900 ₽; выборка из двух мала, год выпуска второго предложения не указан в доступной карточке. Ориентир АСТ −2% рассчитан от исходных средних, не является гарантированной ценой продажи. Под заказ «от» — начальная цена версии 30Li M Sport с заявленными доставкой, таможней и утильсбором; конечная стоимость зависит от курса и города. Это G18 для Китая, а не показанный выше новый X5 40 xDrive. Динамику можно считать после следующего среза.</p>' +
      '<p><a href="https://auto.drom.ru/moscow/bmw/x5/701556106.html" target="_blank" rel="noopener noreferrer nofollow">БорисХоф: 10,5 млн, новый, наличные</a> · <a href="https://auto.drom.ru/moscow/bmw/x5/615397605.html" target="_blank" rel="noopener noreferrer nofollow">PELETON: 10,5 млн, 50 км</a> · <a href="https://auto.drom.ru/moscow/bmw/x5/279969419.html" target="_blank" rel="noopener noreferrer nofollow">БалтАвтоТрейд: 9,85 млн, новый, без НДС</a> · <a href="https://procar.moscow/catalog/bmw-x5-xdrive30li-2026/" target="_blank" rel="noopener noreferrer nofollow">ProCar: 14,9938 млн с НДС</a> · <a href="https://atlas-import.ru/stock/69df391beb3258e5db7a8280/" target="_blank" rel="noopener noreferrer nofollow">Атлас: 10,79 млн, полный НДС по объявлению</a> · <a href="https://auto-geek.ru/zakaz/china/bmw/x5/" target="_blank" rel="noopener noreferrer nofollow">Auto Geek: от 8,42 млн под ключ</a>. Наличие, полный состав НДС и итоговую стоимость следует подтвердить у продавцов до сделки.</p></details></div>';
    section.querySelector('.amr-eyebrow').textContent = 'РЫНОЧНЫЙ ОРИЕНТИР · ' + (names[model] || model);
    if (path === '/bmw-x5-import') {
      section.setAttribute('data-price-evidence', 'observed-listings-20261012');
    }
    return true;
  }

  function start() {
    if (insert()) return;
    var observer = new MutationObserver(function () { if (insert()) observer.disconnect(); });
    observer.observe(document.body, {childList:true, subtree:true});
    setTimeout(function () { observer.disconnect(); insert(); }, 12000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
