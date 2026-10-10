/* AST unify v1 (draft for approval, 2026-10-10)
 * One sitewide file for avtonds.ru: unified lead form, unified bottom button,
 * AST logo in header, one-line safe deal, similar models + class comparison,
 * removal of manufacturer/dealer texts, no Telegram links, tighter mobile spacing.
 * Leads are sent through the existing unified transport (offers-api -> MAX).
 * Rollback: add ?ast_unify=off to any URL, or remove the <script> tag.
 */
(function () {
  "use strict";
  if (window.__astUnify) return;
  if (/[?&]ast_unify=off\b/.test(location.search)) return;
  window.__astUnify = "v1-2026-10-10";

  var CFG = {
    brand: "#D82C30",
    logoHref: "/catalog",
    phone: "+79991583458",
    phoneDisplay: "+7 999 158-34-58",
    safeHref: "/bezopasnaya-sdelka",
    privacyHref: "/privacy",
    endpoint: "https://offers-api.89-125-27-177.sslip.io/api/max-page/order",
    metrikaId: 106049767
  };
  var DATA = {"models": [{"k": "bz3x", "n": "Toyota bZ3X", "h": "/toyota-bz3x", "a": ["/toyota-bz3x-showcase", "/toyota-bz3x-podbor"], "s": "cn", "p": "от 2 319 000 ₽", "o": "Китай", "d": "Электрический кроссовер GAC Toyota: сравниваем 9 комплектаций, батареи 50–68 кВт·ч и заявленный запас хода 430–610 км CL", "i": "https://static.tildacdn.com/tild3939-6136-4938-b337-666263323634/KV-mob.jpg"}, {"k": "cx5", "n": "Mazda CX-5", "h": "/mazda-cx-5", "a": ["/mazda-cx5-ru", "/mazda-cx-5-podbor"], "s": "cn", "p": "от 2 690 000 ₽", "o": "Китай · Грузия", "d": "Не переносим китайские и грузинские названия CX-5 друг на друга: привод, двигатель, оснащение и допы сверяются п", "i": "https://static.tildacdn.com/tild6334-3436-4138-a262-643537376136/photo.webp"}, {"k": "highlander", "n": "Toyota Highlander", "h": "/toyota-highlander-china", "a": [], "s": "cn", "p": "от 5 033 000 ₽", "o": "Китай · GAC Toyota", "d": "Китайская версия GAC Toyota: сравните оснащение и запросите расчёт поставки конкретного автомобиля. З", "i": "https://static.tildacdn.com/tild6435-6535-4164-b163-386565383934/KV00-PC.jpg"}, {"k": "q5l", "n": "Audi Q5L", "h": "/audi-q5l", "a": ["/audi-q5l-china", "/audi-q5l-podbor"], "s": "cn", "p": "5 920 000 ₽", "o": "Китай", "d": "Проверяем китайскую длиннобазную Q5L: рыночное название, двигатель, quattro, пакет оснащения и экспортные документы. Завод", "i": "https://static.tildacdn.com/tild6263-3062-4633-b136-666166653833/01.webp"}, {"k": "x3", "n": "BMW X3", "h": "/bmw-x3", "a": [], "s": "cn", "p": "", "o": "Китай", "d": "Сопоставляем три китайские длиннобазные версии BMW X3 по M Sport Shadowline, оснащению и совместимым допам. Завод Цена по зап", "i": "https://static.tildacdn.com/tild3665-6632-4264-b334-643233613765/cq5damresizedimg1680.jpg"}, {"k": "tiguan", "n": "Volkswagen Tiguan L Pro", "h": "/volkswagen-tiguan-l-pro", "a": ["/volkswagen-tiguan-l-china", "/volkswagen-tiguan-l-pro-podbor"], "s": "cn", "p": "", "o": "Китай", "d": "Проверяем китайскую длиннобазную Tiguan L Pro: 300TSI/380TSI, передний или полный привод, R-Line и экспортны", "i": "https://static.tildacdn.com/tild6465-3562-4537-b464-353961383161/feature-aerodynamics.webp"}, {"k": "rav4", "n": "Toyota RAV4", "h": "/toyota-rav4", "a": [], "s": "cn", "p": "", "o": "Китай · FAW Toyota · Грузия", "d": "Сравниваем FAW Toyota в Китае с официальными грузинскими MID, STYLE, HIGH и GR-S; удалённые гибрид", "i": "https://static.tildacdn.com/tild3263-6336-4135-b265-636636623032/photo.webp"}, {"k": "q05", "n": "Changan Qiyuan Q05", "h": "/changan-qiyuan-q05", "a": [], "s": "cn", "p": "", "o": "", "d": "Электрокроссовер Changan Qiyuan: подбираем сочетание цвета кузова и салона под конкретный автомобиль.", "i": "https://static.tildacdn.com/tild3662-6364-4638-b538-356539313565/exterior-white.jpg"}, {"k": "yu7", "n": "Xiaomi YU7", "h": "/xiaomi-yu7", "a": [], "s": "cn", "p": "", "o": "Китай", "d": "Сравниваем Standard, Pro, Max и GT по приводу, батарее, зарядной архитектуре и программным функциям. Завод Цена по запрос", "i": "https://static.tildacdn.com/tild3836-3838-4265-a238-306438336566/photo.webp"}, {"k": "zeekr8x", "n": "ZEEKR 8X", "h": "/zeekr-8x", "a": ["/zeekr-8x-podbor"], "s": "fam", "p": "", "o": "Китай", "d": "Для новой модели показываем китайские Max, Ultra и Ultra+ по батарее, но order guide, экспорт и допы остаются отдельной про", "i": "https://static.tildacdn.com/tild3665-6537-4262-b862-616438383630/zeekr-8x-2.jpg"}, {"k": "zeekr9x", "n": "ZEEKR 9X", "h": "/zeekr-9x", "a": ["/zeekr-9x-podbor"], "s": "fam", "p": "", "o": "Китай", "d": "Сравниваем Max, Ultra, Hyper и Black Edition по реальной спецификации, батарее, шасси и документам. Завод Цена по запросу A", "i": "https://static.tildacdn.com/tild3066-3863-4163-a430-383033306136/photo.webp"}, {"k": "n90", "n": "Xiaomi SkyNomad N90", "h": "/xiaomi-n90", "a": [], "s": "fam", "p": "", "o": "", "d": "Семиместный SUV с последовательным гибридом и салоном 2+2+3.", "i": "https://static.tildacdn.com/tild3965-3964-4133-b836-666162353330/1.webp"}, {"k": "l9", "n": "Li Auto L9", "h": "/li-auto-l9", "a": [], "s": "fam", "p": "", "o": "Китай", "d": "Сопоставляем китайские Ultra и Livis по семейному оснащению, электронным функциям и экспортной готовности. Завод Цена по", "i": "https://static.tildacdn.com/tild6634-3139-4464-a130-363162616231/photo.webp"}, {"k": "l6", "n": "Li Auto L6", "h": "/li-auto-l6", "a": [], "s": "fam", "p": "", "o": "Китай", "d": "Показываем актуальную Standard Configuration; другие исполнения добавляются только для конкретного автомобиля с подтвержд", "i": "https://static.tildacdn.com/tild3135-3236-4336-b337-633439363363/photo.webp"}, {"k": "taishan", "n": "Voyah Taishan", "h": "/voyah-taishan", "a": [], "s": "fam", "p": "", "o": "Китай", "d": "Для новой шестиместной модели отдельно подтверждаем исполнение, гибридную систему, электронные функции и документы. За", "i": "https://static.tildacdn.com/tild3833-3932-4532-b662-366638343766/photo.webp"}, {"k": "x5", "n": "BMW X5", "h": "/bmw-x5-import", "a": ["/bmw-x5-import-podbor", "/bmw-x5-new"], "s": "prem", "p": "", "o": "Китай · Германия · Южная Корея", "d": "Сравниваем китайские, немецкие и корейские версии BMW X5 по рынку, поколению, двигателю, включённому", "i": "https://static.tildacdn.com/tild3936-3265-4030-a661-313134313935/bmw-x5-import-card.webp"}, {"k": "x6", "n": "BMW X6", "h": "/x6-oem", "a": ["/bmw-x6"], "s": "prem", "p": "", "o": "", "d": "Купе-версия X5: сравниваем бензин, дизель и M-исполнения по рынку поставки и документам. Завод Цена по запросу", "i": "https://static.tildacdn.com/tild6237-3438-4364-b363-393733356532/bmw-x6.webp"}, {"k": "x7", "n": "BMW X7", "h": "/bmw-x7", "a": ["/bmw-x7-legacy"], "s": "prem", "p": "", "o": "", "d": "Трёхрядный флагман BMW: рациональный бензин, дизель, M60i и ALPINA — разница в документах и сроке поставки. Зав", "i": "https://static.tildacdn.com/tild3432-6166-4237-b134-383031356136/bmw-x7-card.webp"}, {"k": "gle", "n": "Mercedes-Benz GLE", "h": "/gle-oem", "a": ["/mercedes-benz-gle-import"], "s": "prem", "p": "", "o": "Китай · Германия · Южная Корея", "d": "Не смешиваем китайские, немецкие и корейские обозначения GLE: рынок, двигатель, линия осн", "i": "https://static.tildacdn.com/tild3366-6162-4739-a436-643032316664/mercedes-benz-gle-im.webp"}, {"k": "gls", "n": "Mercedes-Benz GLS", "h": "/gls-oem", "a": ["/mercedes-benz-gls-import"], "s": "prem", "p": "", "o": "", "d": "От GLS 450 до Maybach GLS 600: класс салона и стоимость обслуживания различаются сильнее, чем цена в", "i": "https://static.tildacdn.com/tild6633-6261-4239-a566-376432626532/mercedes-benz-gls-im.webp"}, {"k": "cayenne", "n": "Porsche Cayenne", "h": "/cayenne-oem", "a": ["/porsche-cayenne-import"], "s": "prem", "p": "", "o": "Германия / ЕС", "d": "Сравниваем SUV-версии Cayenne для Германии/ЕС: бензин, PHEV и отдельная электрическая группа без Coupé. Заво", "i": "https://static.tildacdn.com/tild3464-3338-4432-a134-343333643533/porsche-cayenne-impo.webp"}, {"k": "rr", "n": "Range Rover", "h": "/range-rover-original", "a": ["/range-rover", "/range-rover-oem"], "s": "prem", "p": "", "o": "", "d": "Range Rover: дизель, PHEV и V8 дают разную экономику владения, а SV — отдельный разговор по сро", "i": "https://static.tildacdn.com/tild3766-3133-4565-a437-633339333139/photo.webp"}, {"k": "lx", "n": "Lexus LX", "h": "/lx-oem", "a": ["/lexus-lx"], "s": "prem", "p": "", "o": "ОАЭ · Грузия", "d": "Отдельно сравниваем ОАЭ и Грузию: LX600, LX700h, LX500d и рыночные пакеты не смешиваются в одну комплектацию. Завод", "i": "https://static.tildacdn.com/tild3966-3330-4532-b231-313734396633/lexus-lx-card.webp"}, {"k": "gx", "n": "Lexus GX", "h": "/gx-oem", "a": ["/lexus-gx"], "s": "prem", "p": "", "o": "", "d": "Рамный GX 550: Overtrail и Luxury решают разные задачи, поэтому сравнивать их по цене входа некорректно. Заво", "i": "https://static.tildacdn.com/tild3635-3534-4737-a138-373739613965/lexus-gx.webp"}, {"k": "lc300", "n": "Toyota Land Cruiser 300", "h": "/land-cruiser-300-oem", "a": ["/toyota-land-cruiser-300"], "s": "prem", "p": "", "o": "", "d": "Исполнения LC300 сильно различаются по рынкам: название версии без указания рынка ничего не га", "i": "https://static.tildacdn.com/tild6366-3531-4761-b162-383963656463/toyota-land-cruiser-.webp"}, {"k": "prado", "n": "Toyota Prado 250", "h": "/prado-250-oem", "a": ["/toyota-prado-250"], "s": "prem", "p": "", "o": "", "d": "Prado 250 продаётся с разными двигателями в Японии, Австралии и на Ближнем Востоке — рынок определяет", "i": "https://static.tildacdn.com/tild3930-3638-4934-b631-326337343331/toyota-prado-250-car.webp"}, {"k": "bentayga", "n": "Bentley Bentayga", "h": "/bentley-bentayga", "a": ["/bentley-bentayga-podbor", "/bentayga-oem", "/bentayga-original"], "s": "lux", "p": "", "o": "", "d": "Bentayga: EWB, Azure и Speed — это разные автомобили по назначению, а не ступени одной лестницы. Заво", "i": "https://static.tildacdn.com/tild3763-3730-4663-b930-396462383364/hero-exterior-3-4.jpg"}, {"k": "torcal", "n": "Bentley Torcal", "h": "/bentley-torcal", "a": [], "s": "lux", "p": "", "o": "", "d": "Электрический Bentley: комплектацию, доступность и маршрут поставки проверяем для конкретного заказа. З", "i": "https://static.tildacdn.com/tild6430-3064-4530-a131-356534393566/67cab4dbeb4d0c29.jpg"}, {"k": "urus", "n": "Lamborghini Urus", "h": "/urus-oem", "a": ["/lamborghini-urus"], "s": "lux", "p": "", "o": "", "d": "Urus S, Performante и гибридный SE — три разных характера; выбор влияет на сроки и стоимость обслужив", "i": "https://static.tildacdn.com/tild3833-6630-4662-a662-363135613061/photo.webp"}, {"k": "purosangue", "n": "Ferrari Purosangue", "h": "/purosangue-oem", "a": ["/ferrari-purosangue"], "s": "lux", "p": "", "o": "", "d": "Purosangue: силовая установка одна, разница — в комплектации конкретного автомобиля и его доступнос", "i": "https://static.tildacdn.com/tild6634-3531-4366-b037-396239396562/purosangue-oem.webp"}, {"k": "cullinan", "n": "Rolls-Royce Cullinan", "h": "/rolls-royce-cullinan", "a": ["/rolls-royce-cullinan-podbor"], "s": "lux", "p": "", "o": "", "d": "Cullinan Series II и Black Badge: по этой машине решает не прайс-лист, а комплектация конкретного", "i": "https://static.tildacdn.com/tild6639-3366-4835-b937-393761613365/hero-exterior-3-4.jpg"}, {"k": "dbx", "n": "Aston Martin DBX707", "h": "/dbx707-oem", "a": ["/aston-martin-dbx707"], "s": "lux", "p": "", "o": "", "d": "DBX707 приходит штучно: решает не версия, а конкретный автомобиль, его история и подтверждённая до", "i": "https://static.tildacdn.com/tild3962-3366-4262-a466-366261653530/photo.webp"}, {"k": "g63", "n": "Mercedes-AMG G 63", "h": "/g63-oem", "a": ["/mercedes-amg-g63"], "s": "lux", "p": "", "o": "", "d": "Разница между исполнениями G 63 — это пакеты и отделка, а не силовая установка: она одна на всю лине", "i": "https://static.tildacdn.com/tild3736-6633-4663-b439-303762353861/hero-exterior-3-4.jpg"}, {"k": "contgt", "n": "Bentley Continental GT", "h": "/continental-gt-oem", "a": ["/bentley-continental-gt"], "s": "lux", "p": "", "o": "", "d": "Continental GT: поколение и кузов важнее названия версии — проверяем их до любого расчёта. Заво", "i": "https://static.tildacdn.com/tild3361-6631-4638-b931-393333366537/hero-exterior-3-4.jpg"}, {"k": "sclass", "n": "Mercedes-Benz S-Class", "h": "/s-class-oem", "a": ["/mercedes-benz-s-class-import"], "s": "lux", "p": "", "o": "", "d": "Представительский седан: от S 450 до Maybach и AMG — выбор определяется задачей владельца, а не", "i": "https://static.tildacdn.com/tild3465-6636-4633-a133-663932373263/mercedes-benz-s-clas.webp"}, {"k": "p911", "n": "Porsche 911", "h": "/911-oem", "a": ["/porsche-911", "/porsche-911-dakar"], "s": "lux", "p": "", "o": "", "d": "От Carrera до Turbo S: у 911 версия определяет и цену владения, и доступность конкретного автомобиля. Заво", "i": "https://static.tildacdn.com/tild6466-3635-4038-a334-393166646637/filtersformatavif.avif"}, {"k": "panamera", "n": "Porsche Panamera", "h": "/panamera-oem", "a": ["/porsche-panamera-import"], "s": "lux", "p": "", "o": "", "d": "Гран-туризмо с гибридными версиями: сравниваем V6, PHEV и V8 по задаче, а не по максимальной мощности", "i": "https://static.tildacdn.com/tild6236-3431-4138-b963-356536333134/filters3Aformat28web.webp"}], "segments": {"cn": "Кроссоверы из Китая", "fam": "Большие семейные SUV из Китая", "prem": "Премиальные внедорожники", "lux": "Люкс и спорт"}};

  var SEG = DATA.segments || {};
  var MODELS = DATA.models || [];
  var isMobile = function () { return window.innerWidth < 760; };
  var path = function () { return location.pathname.replace(/\/+$/, "") || "/"; };

  function currentModel() {
    var p = path();
    for (var i = 0; i < MODELS.length; i++) {
      var m = MODELS[i];
      if (m.h === p || (m.a || []).indexOf(p) > -1) return m;
    }
    return null;
  }
  var MODEL = currentModel();

  function goal(name, extra) {
    try { if (typeof window.ym === "function") window.ym(CFG.metrikaId, "reachGoal", name, extra || {}); } catch (e) {}
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function vis(e) {
    if (!e || !e.getBoundingClientRect) return false;
    var r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.height > 0 && r.width > 0 && s.display !== "none" && s.visibility !== "hidden";
  }
  function ours(e) { return e && e.closest && e.closest("[data-astu]"); }
  function hide(e, why) {
    if (!e || ours(e) || e.hasAttribute("data-astu-hidden")) return;
    e.setAttribute("data-astu-hidden", why || "1");
    e.style.setProperty("display", "none", "important");
  }
  function lum(color) {
    var m = String(color).match(/[\d.]+/g);
    if (!m || (m.length > 3 && +m[3] < 0.3)) return null;
    var c = m.slice(0, 3).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function isDarkAt(node) {
    var e = node;
    while (e && e !== document.documentElement) {
      var s = getComputedStyle(e);
      var l = lum(s.backgroundColor);
      if (l != null) return l < 0.25;
      var bi = s.backgroundImage || "none";
      if (bi !== "none") {
        if (/gradient/.test(bi)) { var g = bi.match(/rgba?\([^)]+\)/); var gl = g ? lum(g[0]) : null; if (gl != null) return gl < 0.25; }
        else if (/url\(/.test(bi)) return true;
      }
      e = e.parentElement;
    }
    return false;
  }
  var ICON = {
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9zm3 4a1.6 1.6 0 0 1 .9 2.9V18h-1.8v-1.1A1.6 1.6 0 0 1 12 14z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.2 5.3 11.8 6.7l4.3 4.3H4v2h12.1l-4.3 4.3 1.4 1.4L20 12z"/></svg>'
  };

  /* ------------------------------------------------------------ styles */
  var CSS = [
    "[data-astu]{box-sizing:border-box;font-family:TildaSans,Inter,Arial,sans-serif;-webkit-font-smoothing:antialiased}",
    "[data-astu] *{box-sizing:border-box}",
    "[data-astu]{opacity:1!important;visibility:visible!important;transform:none;animation:none!important}",
    ".astu-inline,.astu-sheet{color:#14161a!important;text-align:left!important}",
    ".astu-inline p,.astu-inline span,.astu-inline label,.astu-sheet p,.astu-sheet span,.astu-sheet label{color:inherit;text-transform:none!important;letter-spacing:normal!important;font-family:inherit!important}",
    ".astu-f label.astu-l,.astu-f .astu-l{color:#4d5560!important}",
    ".astu-chips span{color:#14161a!important;background:#fff!important}",
    ".astu-chips input:checked+span{color:#D82C30!important;background:rgba(216,44,48,.08)!important}",
    ".astu-ok,.astu-ok span{color:#6b7280!important}",
    ".astu-h{color:#14161a!important}.astu-sub{color:#4d5560!important}",
    ".astu-f input[type=text]::placeholder{color:#8a919c!important;opacity:1}",
    /* logo */
    ".astu-logo{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 9px;margin-right:10px;border-radius:8px;background:" + CFG.brand + ";color:#fff!important;font-weight:800;font-style:italic;font-size:16px;letter-spacing:.02em;text-decoration:none!important;line-height:1;flex:0 0 auto;z-index:5}",
    ".astu-logo{width:auto!important;max-width:64px!important;flex:0 0 auto!important;align-self:center!important;box-shadow:none!important}",
    ".astu-safe span,.astu-safe b{color:inherit!important;opacity:1!important;-webkit-text-fill-color:currentColor!important;background:none!important;filter:none!important}",
    "[data-astu] p,[data-astu] span,[data-astu] b,[data-astu] label,[data-astu] a,[data-astu] h2{-webkit-text-fill-color:currentColor!important;filter:none!important}",
    ".astu-safe .astu-more{color:#D82C30!important}",
    ".astu-logo--float{position:absolute;top:12px;left:16px;z-index:60;margin:0}",
    /* bottom pill */
    ".astu-pill:not(.is-on){transform:translate(-50%,140%)!important}",
    ".astu-pill{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147483000;transform:translate(-50%,140%);transition:transform .35s ease;display:flex;align-items:center;gap:8px;height:44px;padding:0 20px;border:0;border-radius:22px;background:rgba(216,44,48,.80);-webkit-backdrop-filter:saturate(160%) blur(10px);backdrop-filter:saturate(160%) blur(10px);color:#fff;font-size:15px;font-weight:600;line-height:1;box-shadow:0 6px 20px rgba(0,0,0,.22);cursor:pointer;white-space:nowrap}",
    ".astu-pill.is-on{transform:translate(-50%,0)!important}",
    ".astu-pill svg{width:16px;height:16px}",
    "@media (min-width:760px){.astu-pill{left:auto;right:24px;transform:translateY(140%)}.astu-pill.is-on{transform:none!important}}",
    /* safe-deal line */
    ".astu-safe{display:flex;align-items:center;gap:10px;margin:12px 16px;padding:11px 14px;border-radius:12px;font-size:14px;line-height:1.35;text-decoration:none!important;background:#fff;color:#14161a!important;border:1px solid rgba(20,22,26,.10)}",
    ".astu-safe.is-dark{background:rgba(255,255,255,.08);color:#eef2f6!important;border-color:rgba(255,255,255,.16)}",
    ".astu-safe svg{width:18px;height:18px;flex:0 0 18px;color:" + CFG.brand + "}",
    ".astu-safe b{font-weight:700}",
    ".astu-safe .astu-more{margin-left:auto;white-space:nowrap;font-weight:600;color:" + CFG.brand + "}",
    "@media (min-width:760px){.astu-safe{max-width:1120px;margin:16px auto}}",
    /* sheet + form */
    ".astu-back{position:fixed;inset:0;z-index:2147483600;background:rgba(10,12,16,.55);opacity:0;transition:opacity .2s;display:flex;align-items:flex-end;justify-content:center}",
    ".astu-back.is-open{opacity:1}",
    ".astu-sheet{position:relative;width:100%;max-width:480px;max-height:92vh;overflow:auto;background:#fff;color:#14161a;border-radius:20px 20px 0 0;padding:22px 18px calc(18px + env(safe-area-inset-bottom));transform:translateY(30px);transition:transform .25s}",
    ".astu-back.is-open .astu-sheet{transform:none}",
    "@media (min-width:760px){.astu-back{align-items:center}.astu-sheet{border-radius:20px;padding:28px}}",
    ".astu-x{position:absolute;top:8px;right:8px;width:44px;height:44px;border:0;background:none;color:#4d5560;cursor:pointer;display:flex;align-items:center;justify-content:center}.astu-x svg{width:22px;height:22px}",
    ".astu-h{margin:0 40px 4px 0;font-size:21px;line-height:1.2;font-weight:700}",
    ".astu-sub{margin:0 0 16px;font-size:14px;line-height:1.4;color:#4d5560}",
    ".astu-f label.astu-l{display:block;margin:0 0 6px;font-size:13px;font-weight:600;color:#4d5560}",
    ".astu-f .astu-row{margin:0 0 14px}",
    ".astu-f input[type=text],.astu-f input[type=tel],.astu-f select{width:100%;height:50px;padding:0 14px;border:1px solid #d6dae1;border-radius:12px;background:#fff;color:#14161a;font-size:16px;font-family:inherit;-webkit-appearance:none;appearance:none}",
    ".astu-f select{background-image:linear-gradient(45deg,transparent 50%,#6b7280 50%),linear-gradient(135deg,#6b7280 50%,transparent 50%);background-position:calc(100% - 20px) 22px,calc(100% - 15px) 22px;background-size:5px 5px;background-repeat:no-repeat;padding-right:36px}",
    ".astu-f input:focus,.astu-f select:focus{outline:2px solid " + CFG.brand + ";outline-offset:0;border-color:transparent}",
    ".astu-chips{display:flex;gap:8px}",
    ".astu-chips label{flex:1 1 0;position:relative}",
    ".astu-chips input{position:absolute;opacity:0;pointer-events:none}",
    ".astu-chips span{display:flex;align-items:center;justify-content:center;height:44px;padding:0 6px;border:1px solid #d6dae1;border-radius:12px;font-size:14px;font-weight:600;text-align:center;line-height:1.1;cursor:pointer}",
    ".astu-chips input:checked+span{border-color:" + CFG.brand + ";background:rgba(216,44,48,.08);color:" + CFG.brand + "}",
    ".astu-ok{display:flex;gap:10px;align-items:flex-start;margin:4px 0 16px;font-size:12px;line-height:1.4;color:#6b7280}",
    ".astu-ok input{width:20px;height:20px;margin:0;flex:0 0 20px;accent-color:" + CFG.brand + "}",
    ".astu-ok a{color:inherit;text-decoration:underline}",
    ".astu-trust{margin:10px 0 0;font-size:12px;line-height:1.4;color:#6b7380!important;-webkit-text-fill-color:#6b7380;text-align:center}",
    ".astu-go{width:100%;height:52px;border:0;border-radius:14px;background:" + CFG.brand + ";color:#fff;font-size:16px;font-weight:700;font-family:inherit;cursor:pointer}",
    ".astu-go[disabled]{opacity:.6}",
    ".astu-alt{margin:12px 0 0;text-align:center;font-size:14px;color:#4d5560}.astu-alt a{color:#14161a;font-weight:600;text-decoration:none}",
    ".astu-st{margin:10px 0 0;font-size:14px;line-height:1.4;text-align:center}",
    ".astu-done{padding:18px 0 6px;text-align:center}.astu-done b{display:block;font-size:20px;margin-bottom:6px}",
    /* inline form */
    ".astu-inline{margin:16px;padding:20px 16px;border-radius:18px;background:#fff;color:#14161a;border:1px solid rgba(20,22,26,.10);box-shadow:0 8px 30px rgba(0,0,0,.06)}",
    "@media (min-width:760px){.astu-inline{max-width:560px;margin:24px auto}}",
    /* similar models */
    ".astu-sim{padding:28px 0 8px;background:#f4f5f7;color:#14161a}",
    ".astu-sim.is-dark{background:#111317;color:#eef2f6}",
    ".astu-sim__in{max-width:1180px;margin:0 auto}",
    ".astu-sim__k{margin:0 16px 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:" + CFG.brand + "}",
    ".astu-sim__h{margin:0 16px 14px;font-size:24px;line-height:1.15;font-weight:700}",
    ".astu-sim__row{display:flex;gap:12px;overflow-x:auto;padding:0 16px 14px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}",
    ".astu-sim__row::-webkit-scrollbar{display:none}",
    ".astu-card{flex:0 0 72%;max-width:280px;scroll-snap-align:start;border-radius:16px;overflow:hidden;background:#fff;color:#14161a!important;text-decoration:none!important;border:1px solid rgba(20,22,26,.08);display:flex;flex-direction:column}",
    ".astu-sim.is-dark .astu-card{background:#1b1e24;color:#eef2f6!important;border-color:rgba(255,255,255,.08)}",
    ".astu-card__img{aspect-ratio:16/10;background:#dfe3e8 center/cover no-repeat}",
    ".astu-card__b{padding:12px 14px 14px}",
    ".astu-card__n{font-size:17px;font-weight:700;line-height:1.2;margin:0 0 4px}",
    ".astu-card__o{font-size:12px;opacity:.65;margin:0 0 6px}",
    ".astu-card__p{font-size:15px;font-weight:700}",
    ".astu-sim__cmp{display:flex;align-items:center;justify-content:center;gap:8px;margin:2px 16px 16px;height:48px;border-radius:14px;border:1.5px solid currentColor;background:none;color:inherit;font-size:15px;font-weight:700;font-family:inherit;width:calc(100% - 32px);cursor:pointer}",
    "@media (min-width:760px){.astu-card{flex-basis:260px}.astu-sim__cmp{width:auto;padding:0 24px;display:inline-flex}}",
    ".astu-sim__cmp svg{width:18px;height:18px}",
    /* compare sheet */
    ".astu-cmp{max-width:760px}",
    ".astu-cmp__list{margin:8px 0 0;padding:0;list-style:none}",
    ".astu-cmp__it{display:grid;grid-template-columns:96px 1fr;gap:12px;padding:12px 0;border-top:1px solid #eceef2}",
    ".astu-cmp__it.is-cur{background:rgba(216,44,48,.05);margin:0 -18px;padding:12px 18px}",
    ".astu-cmp__img{width:96px;height:64px;border-radius:10px;background:#dfe3e8 center/cover no-repeat}",
    ".astu-cmp__n{font-size:16px;font-weight:700;line-height:1.2}",
    ".astu-cmp__o{font-size:12px;color:#6b7280;margin:2px 0 4px}",
    ".astu-cmp__d{font-size:13px;line-height:1.4;color:#4d5560;margin:0 0 6px}",
    ".astu-cmp__a{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
    ".astu-cmp__a a,.astu-cmp__a button{height:36px;padding:0 12px;border-radius:10px;font-size:13px;font-weight:700;font-family:inherit;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}",
    ".astu-cmp__a a{border:1px solid #d6dae1;color:#14161a}",
    ".astu-cmp__a button{border:0;background:" + CFG.brand + ";color:#fff}",
    ".astu-cmp__p{font-size:14px;font-weight:700;margin-right:auto}",
    /* text fixes */
    ".astu-txt{font-size:14px!important;line-height:1.45!important}"
  ].join("\n");

  /* ------------------------------------------------------------ form */
  function trimOptions() {
    var set = [];
    function add(t) {
      t = String(t || "").replace(/\s+/g, " ").trim();
      if (!t || t.length > 40 || set.indexOf(t) > -1) return;
      set.push(t);
    }
    document.querySelectorAll("a,button").forEach(function (b) {
      if (ours(b)) return;
      var m = (b.innerText || "").match(/«([^»]{2,30})»/);
      if (m) add(m[1]);
    });
    document.querySelectorAll('[class*="trim"] h3,[class*="trim"] h4,[class*="trim-card"] strong,[class*="trim"] [class*="title"],[class*="trim"] [class*="name"]').forEach(function (h) {
      if (!ours(h) && !h.children.length) add(h.innerText);
    });
    return set.slice(0, 12);
  }

  function formHTML(ctx) {
    var name = MODEL ? MODEL.n : "";
    var trims = trimOptions();
    var opts = '<option value="">Помогите выбрать</option>' + trims.map(function (t) {
      var sel = ctx.trim && t.toLowerCase() === ctx.trim.toLowerCase() ? " selected" : "";
      return '<option' + sel + '>' + t.replace(/</g, "&lt;") + "</option>";
    }).join("");
    var uid = "astu" + Math.random().toString(36).slice(2, 7);
    return '' +
      '<form class="astu-f" data-ast-lead-form="unified" novalidate>' +
        '<input type="hidden" name="model" value="' + (name + (ctx.trim ? " · " + ctx.trim : "")).replace(/"/g, "") + '">' +
        '<input type="hidden" name="source_detail" value="ast_unify_' + (ctx.where || "popup") + '">' +
        '<input type="hidden" name="cta" value="' + String(ctx.cta || "").slice(0, 60).replace(/"/g, "") + '">' +
        '<input type="hidden" name="name" value="Заявка с сайта">' +
        '<div class="astu-row"><label class="astu-l" for="' + uid + 'c">Телефон или ник в Telegram</label>' +
          '<input id="' + uid + 'c" type="text" name="contact" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00 или @ник" required></div>' +
        (name ? '<div class="astu-row"><label class="astu-l" for="' + uid + 't">Комплектация ' + name + '</label>' +
          '<select id="' + uid + 't" name="model_version">' + opts + '</select></div>' : "") +
        '<label class="astu-ok"><input type="checkbox" name="consent" value="yes" checked><span>Согласен на обработку заявки по <a href="' + CFG.privacyHref + '" target="_blank" rel="noopener">политике данных</a></span></label>' +
        '<button class="astu-go" type="submit">Получить цену</button>' +
        '<p class="astu-st" data-ast-unified-status aria-live="polite"></p>' +
        '<p class="astu-trust">Ответ до 15 минут в рабочее время · Оплата через аккредитив Сбербанка · Договор до оплаты</p>' +
        '<p class="astu-alt">или позвоните <a href="tel:' + CFG.phone + '">' + CFG.phoneDisplay + '</a></p>' +
      '</form>';
  }

  function wireForm(form) {
    // Model version goes into the "model" field the transport reads.
    var sel = form.querySelector('[name="model_version"]');
    var mf = form.querySelector('[name="model"]');
    if (sel && mf) sel.addEventListener("change", function () {
      mf.value = (MODEL ? MODEL.n : "") + (sel.value ? " · " + sel.value : "");
    });
    // Fallback sender: runs only if the unified transport is absent on the page.
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (window.__astUnifiedLeadTransport) return;
      var d = new FormData(form), contact = String(d.get("contact") || "").trim();
      var st = form.querySelector(".astu-st");
      if (!(/^@[a-z0-9_]{4,}$/i.test(contact) || contact.replace(/\D/g, "").length >= 7)) { st.textContent = "Укажите телефон или Telegram."; return; }
      var btn = form.querySelector(".astu-go"); btn.disabled = true; st.textContent = "Передаём заявку...";
      fetch(CFG.endpoint, { method: "POST", mode: "cors", credentials: "omit", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: "site_" + Date.now(), created_at: new Date().toISOString(), name: "Заявка с сайта", contact: contact,
          model: d.get("model"), page_url: location.href.split("#")[0], channel: "site_form", source: "avtonds_site",
          site_source: "avtonds.ru", source_detail: d.get("source_detail"), cta: d.get("cta"), consent: "yes", policy_url: location.origin + CFG.privacyHref }) })
        .then(function (r) { if (!r.ok) throw 0; st.textContent = "Заявка отправлена. Менеджер свяжется с вами."; goal("ast_form_submit_success", { form: "unify" }); form.reset(); })
        .catch(function () { st.innerHTML = 'Не удалось отправить. Позвоните: <a href="tel:' + CFG.phone + '">' + CFG.phoneDisplay + "</a>"; })
        .finally(function () { btn.disabled = false; });
    });
  }

  function openSheet(inner, cls) {
    closeSheet();
    var back = el("div", "astu-back");
    back.setAttribute("data-astu", "sheet");
    var sh = el("div", "astu-sheet " + (cls || ""));
    sh.setAttribute("role", "dialog");
    sh.setAttribute("aria-modal", "true");
    sh.innerHTML = '<button class="astu-x" type="button" aria-label="Закрыть">' + ICON.close + "</button>" + inner;
    back.appendChild(sh);
    document.body.appendChild(back);
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { back.classList.add("is-open"); });
    back.addEventListener("click", function (e) { if (e.target === back || e.target.closest(".astu-x")) closeSheet(); });
    return sh;
  }
  function closeSheet() {
    var b = document.querySelector(".astu-back");
    if (b) b.remove();
    document.documentElement.style.overflow = "";
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  function openLead(ctx) {
    ctx = ctx || {};
    var title = MODEL ? "Цена " + MODEL.n + " под ключ" : "Цена автомобиля под ключ";
    var sh = openSheet('<p class="astu-h">' + title + '</p><p class="astu-sub">Пришлём итоговую цену с таможней и оформлением и срок поставки. Без звонков, если не хотите.</p>' + formHTML(ctx));
    wireForm(sh.querySelector("form"));
    goal("ast_cta_click", { form: "unify", cta: ctx.cta || "" });
    setTimeout(function () { var c = sh.querySelector('[name="contact"]'); if (c && !isMobile()) c.focus(); }, 300);
  }
  window.astOpenLead = openLead;

  /* ------------------------------------------------------------ lead triggers */
  var LEAD_TXT = /(оставить|отправить)\s+(заявк|запрос)|получить\s+(расч|предлож|итогов)|рассчитать|^расч[её]т|индивидуальный\s+расч|авторасч|узнать\s+(условия|о\s+поставке|о\s+версии|цену|стоимость)|обсудить\s+поставку|запросить\s+(предлож|расч|подбор|стоимость)|^заказать|заказать\s+звонок|^связаться|получить\s+консульт|telegram|телеграм/i;
  var LEAD_HASH = /^#(lead|hl-request-form|ast-model-lead-form|consultation|ast-bentayga-lead|rr-lead|rr-autonds|offer|request|order|form|contact)/i;

  function leadTarget(a) {
    if (!a || ours(a)) return false;
    if (a.closest(".astu-back")) return false;
    // 10.10: existing bottom bars are left untouched.
    if (a.closest(".ast-sticky-cta,.ast-sticky-cta--mobile,.mobile-sticky-cta,#hl-request-sticky,.m-bottom-bar,nav.mobile-nav")) return false;
    var href = a.getAttribute("href") || "";
    var txt = (a.innerText || a.getAttribute("aria-label") || "").trim();
    if (/^tel:|^mailto:/i.test(href)) return false;
    if (/t\.me\//i.test(href)) return true;
    if (/\/contacts(\/)?(#lead)?$/.test(href) && LEAD_TXT.test(txt)) return true;
    if (/\/contacts#lead/.test(href)) return true;
    if (LEAD_HASH.test(href)) return LEAD_TXT.test(txt) || /заявк|расч|предлож|подбор/i.test(txt);
    if (a.tagName === "BUTTON" && a.type === "submit" && a.closest("form") && !a.closest("[data-astu]")) return false;
    // Same page or sibling model page with lead text (e.g. /toyota-bz3x#lead, /audi-q5l, /range-rover-original)
    if (href && LEAD_TXT.test(txt)) {
      try {
        var u = new URL(href, location.href);
        if (u.host === location.host) {
          var p = u.pathname.replace(/\/+$/, "");
          if (p === path() || (MODEL && (MODEL.h === p || (MODEL.a || []).indexOf(p) > -1))) return true;
        }
      } catch (e) {}
      return false;
    }
    if (!href || href === "#" || /^javascript/i.test(href)) return LEAD_TXT.test(txt);
    return false;
  }

  window.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a,button,[role=button]") : null;
    if (!a || !leadTarget(a)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var txt = (a.innerText || "").trim();
    var m = txt.match(/«([^»]{2,30})»/);
    openLead({ cta: txt.slice(0, 60), trim: m ? m[1] : "" });
  }, true);

  /* ------------------------------------------------------------ telegram -> lead */
  function fixTelegram() {
    document.querySelectorAll('a[href*="t.me/"]').forEach(function (a) {
      if (ours(a) || a.hasAttribute("data-astu-tg")) return;
      a.setAttribute("data-astu-tg", "1");
      a.setAttribute("href", "#lead");
      a.removeAttribute("target");
      var t = (a.innerText || "").trim();
      var inSentence = a.parentElement && (a.parentElement.innerText || "").trim().length > t.length + 12 && /^(P|SPAN|LI|SMALL|DIV)$/.test(a.parentElement.tagName) && !a.parentElement.querySelector("svg,img");
      if (/напишите\s+в\s+telegram/i.test(t)) a.textContent = "оставьте заявку";
      else if (inSentence && /telegram/i.test(t)) a.textContent = "заявку";
      else if (/telegram|@astavtomoto|телеграм/i.test(t) || !t) {
        a.querySelectorAll("svg,img").forEach(function (i) { i.remove(); });
        a.textContent = "Оставить заявку";
      }
    });
    // Unified transport fallback text mentions Telegram — phone only.
    document.querySelectorAll("[data-ast-unified-fallback]").forEach(function (n) {
      if (n.getAttribute("data-astu-fix")) return;
      n.setAttribute("data-astu-fix", "1");
      n.innerHTML = 'Если автоматическая отправка недоступна, позвоните <a href="tel:' + CFG.phone + '">' + CFG.phoneDisplay + "</a>.";
    });
  }

  /* ------------------------------------------------------------ foreign texts */
  var KILL_BTN = /тест-?драйв|найти\s+дилера|скачать\s+брошюр|^брошюра$|лист\s+ожидания|новостная\s+рассылка|^конфигуратор$/i;
  var KILL_BLOCK = /предложения\s+faw|льгот[аы]?\s+для\s+владельцев|пакет\s+к\s+\d+-?лет|программа\s+для\s+новых\s+клиентов|листу?\s+ожидания\s+на\s+официальном|присоединяйтесь\s+к\s+листу/i;
  var FOOTER_FOREIGN = /pyms\s+lane|crewe|bentley\s+motors\s+limited|найти\s+дилера/i;
  var CJK = /[㐀-鿿豈-﫿]/;

  function blockOf(node, maxScreens) {
    var e = node, vh = window.innerHeight, best = node;
    while (e && e.parentElement && e.parentElement !== document.body) {
      var p = e.parentElement, h = p.getBoundingClientRect().height;
      if (h > vh * (maxScreens || 1.6) || p.querySelector("h1")) break;
      best = p; e = p;
      if (/^(SECTION|ARTICLE|FOOTER)$/.test(p.tagName)) break;
    }
    return best;
  }

  function cleanForeign() {
    document.querySelectorAll("a,button,[role=button]").forEach(function (b) {
      if (ours(b)) return;
      var t = (b.innerText || "").trim();
      if (t && t.length < 60 && KILL_BTN.test(t)) hide(b, "foreign-btn");
    });
    document.querySelectorAll("h2,h3,h4,p,span,strong,div").forEach(function (n) {
      if (ours(n) || n.children.length > 2) return;
      var t = (n.innerText || "").trim();
      if (!t || t.length > 260) return;
      if (KILL_BLOCK.test(t)) hide(blockOf(n, 1.4), "foreign-block");
    });
    document.querySelectorAll("footer,[class*=footer]").forEach(function (f) {
      if (ours(f)) return;
      if (FOOTER_FOREIGN.test(f.innerText || "")) hide(f, "foreign-footer");
    });
    // Leaf texts in Chinese characters (captions over Russian text)
    document.querySelectorAll("h1,h2,h3,h4,p,span,small,div,figcaption").forEach(function (n) {
      if (ours(n) || n.children.length) return;
      var t = (n.textContent || "").trim();
      if (t && t.length < 120 && CJK.test(t)) hide(n, "cjk");
    });
    // WLTP / WLTC -> neutral wording
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) {
      if (!/\bWLT[PC]\b/.test(n.nodeValue) || ours(n.parentElement)) continue;
      n.nodeValue = n.nodeValue
        .replace(/,?\s*(?:метод|цикл|по\s+циклу|по\s+методике|комбинированный\s+цикл)?\s*WLT[PC]\*?/gi, " (данные производителя)")
        .replace(/\(\s*\(данные производителя\)\s*\)/g, "(данные производителя)")
        .replace(/\s{2,}/g, " ");
    }
  }

  /* ------------------------------------------------------------ header logo */
  function headerEl() {
    var c = document.querySelectorAll("header,nav,[class*=header],[class*=topbar],[class*=site-nav]");
    for (var i = 0; i < c.length; i++) {
      var h = c[i];
      if (ours(h)) continue;
      var r = h.getBoundingClientRect(), s = getComputedStyle(h);
      if (r.top < 4 && r.top > -4 && r.height >= 40 && r.height <= 130 && r.width >= 300 && vis(h) &&
          (s.position === "fixed" || s.position === "sticky" || s.position === "absolute" || h.tagName === "HEADER")) return h;
    }
    return null;
  }
  var AST_RE = /^(AST|АСТ|ACT)(\s|$)/i;
  function placeLogo() {
    if (document.querySelector(".astu-logo")) return;
    var h = headerEl();
    var logo = el("a", "astu-logo", "AST");
    logo.href = CFG.logoHref;
    logo.setAttribute("aria-label", "AST — все модели");
    logo.setAttribute("data-astu", "logo");
    if (!h) {
      logo.className += " astu-logo--float";
      var host = document.querySelector("#allrecords") || document.body;
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      host.insertBefore(logo, host.firstChild);
      return;
    }
    var hr = h.getBoundingClientRect();
    // 1) an existing AST wordmark (text) -> replace it in place
    var old = null;
    [].forEach.call(h.querySelectorAll("a,span,div,strong,b"), function (x) {
      if (old || ours(x) || !vis(x)) return;
      var t = (x.innerText || "").trim();
      if (x.querySelector("a,button,input")) return;
      if (/^(AST|АСТ|ACT)$/i.test(t.split("\n")[0].trim()) && t.length < 60 && x.getBoundingClientRect().width < 260) old = x;
    });
    // 2) or a small picture logo at the very left of the header
    if (!old) {
      [].forEach.call(h.querySelectorAll("img,svg"), function (x) {
        if (old || ours(x) || !vis(x)) return;
        var r = x.getBoundingClientRect();
        if (r.left - hr.left < 40 && r.width < 140 && r.height < 70 && !x.closest("button")) old = x;
      });
    }
    if (old) {
      var a = old.closest("a");
      if (a && a.querySelector("img,svg") === old) { // picture inside a link with text: keep the text
        old.parentNode.insertBefore(logo, old); hide(old, "old-logo");
      } else {
        var t = old.closest("a") || old;
        t.parentNode.insertBefore(logo, t); hide(t, "old-logo");
      }
      return;
    }
    // 3) manufacturer wordmark only: put AST into the first horizontal row of the header
    var rows = [h].concat([].slice.call(h.querySelectorAll("*"))).filter(function (x) {
      if (ours(x) || !vis(x) || x.children.length < 2) return false;
      var cs = getComputedStyle(x), r = x.getBoundingClientRect();
      return (cs.display.indexOf("flex") > -1 && cs.flexDirection.indexOf("row") === 0 || cs.display.indexOf("grid") > -1) &&
        r.top - hr.top < 20 && r.height < 80 && r.width > 250;
    });
    var row = rows[rows.length ? 0 : -1];
    if (!row) { logo.className += " astu-logo--float"; h.appendChild(logo); return; }
    var first = [].filter.call(row.children, vis)[0];
    var isMenu = first && /^(☰|≡|меню|menu)?$/i.test((first.innerText || "").trim()) && first.getBoundingClientRect().width < 60;
    if (getComputedStyle(row).display.indexOf("grid") > -1) { logo.className += " astu-logo--float"; h.appendChild(logo); return; }
    row.insertBefore(logo, isMenu ? first.nextSibling : row.firstChild);
  }

  /* ------------------------------------------------------------ bottom pill */
  function placePill() {
    if (document.querySelector(".astu-pill")) return;
    var b = el("button", "astu-pill", "<span>Оставить заявку</span>");
    b.type = "button";
    b.setAttribute("data-astu", "pill");
    b.addEventListener("click", function () { openLead({ cta: "Оставить заявку (нижняя кнопка)", where: "pill" }); });
    document.body.appendChild(b);
    var keepNav = [].filter.call(document.querySelectorAll("nav.mobile-nav"), vis)[0];
    if (keepNav && isMobile()) b.style.bottom = "calc(" + (Math.round(keepNav.getBoundingClientRect().height) + 10) + "px + env(safe-area-inset-bottom))";
    var on = function () { b.classList.add("is-on"); };
    setTimeout(on, 1200);
    window.addEventListener("scroll", on, { passive: true, once: true });
    var inner = document.querySelector("[data-astu-scroller]");
    if (inner) inner.addEventListener("scroll", on, { passive: true, once: true });
  }

  /* ------------------------------------------------------------ safe deal line */
  function placeSafe() {
    if (document.querySelector(".astu-safe") || !MODEL) return;
    var h1 = [].find.call(document.querySelectorAll("h1"), vis);
    if (!h1) return;
    var vh = window.innerHeight, e = h1, hero = h1;
    while (e.parentElement && e.parentElement !== document.body) {
      var p = e.parentElement, ph = p.getBoundingClientRect().height;
      if (ph > vh * 2.2) break;
      hero = p; e = p;
    }
    var line = el("a", "astu-safe", ICON.lock + "<span><b>Безопасная сделка</b> — оплата через аккредитив Сбербанка. ООО «АСТ», с 2017 года</span><span class=\"astu-more\">Подробнее</span>");
    line.href = CFG.safeHref;
    line.setAttribute("data-astu", "safe");
    hero.parentNode.insertBefore(line, hero.nextSibling);
    if (isDarkAt(line.parentElement)) line.classList.add("is-dark");
  }

  /* ------------------------------------------------------------ inline forms -> unified */
  var PAGE_FORMS = 'form[data-ast-lead-form]:not([data-ast-lead-form="unified"]),form[data-ast-model-lead-form],form[data-intent-form],form.heritage-lead-form,form.ast-launch-form,form.t-form,form';
  function removeQuiz() {
    [].forEach.call(document.querySelectorAll("p,span,div,small"), function (n) {
      if (ours(n) || n.children.length) return;
      if (!/^Шаг\s*1\s*из\s*\d/i.test((n.textContent || "").trim())) return;
      var box = blockOf(n, 1.6);
      if (!box || box.hasAttribute("data-astu-hidden") || ours(box)) return;
      if (!/как\s+оформляем|физическое\s+лицо|юридическое\s+лицо/i.test(box.innerText || "")) return;
      var f = el("div", "astu-inline");
      f.setAttribute("data-astu", "inline");
      f.innerHTML = '<p class="astu-h">' + (MODEL ? "Цена " + MODEL.n + " под ключ" : "Цена под ключ") + '</p><p class="astu-sub">Пришлём итоговую цену с таможней и оформлением и срок поставки.</p>' + formHTML({ where: "inline", cta: "inline" });
      box.parentNode.insertBefore(f, box);
      hide(box, "quiz");
      wireForm(f.querySelector("form"));
    });
  }

  function unifyInlineForms() {
    document.querySelectorAll(PAGE_FORMS).forEach(function (f) {
      if (ours(f) || f.hasAttribute("data-astu-replaced")) return;
      if (!f.querySelector('[name="contact"],[name="Phone"],[name="phone"],input[type="tel"]')) return;
      if (f.matches('.ast-offers-filter,[data-ast-offers-filter],[role=search]')) return;
      var popup = f.closest('[role=dialog],[class*=popup],[class*=modal],dialog');
      if (popup || !vis(f)) return;
      f.setAttribute("data-astu-replaced", "1");
      var box = el("div", "astu-inline");
      box.setAttribute("data-astu", "inline");
      box.innerHTML = '<p class="astu-h">' + (MODEL ? "Цена " + MODEL.n + " под ключ" : "Цена под ключ") + '</p><p class="astu-sub">Пришлём итоговую цену с таможней и оформлением и срок поставки.</p>' + formHTML({ where: "inline", cta: "inline" });
      f.parentNode.insertBefore(box, f);
      hide(f, "old-form");
      wireForm(box.querySelector("form"));
    });
  }

  /* ------------------------------------------------------------ similar + compare */
  function segModels() {
    if (!MODEL) return [];
    return MODELS.filter(function (m) { return m.s === MODEL.s; });
  }
  function cardHTML(m) {
    return '<a class="astu-card" href="' + m.h + '"><div class="astu-card__img" style="background-image:url(\'' + m.i + '\')"></div>' +
      '<div class="astu-card__b"><p class="astu-card__n">' + m.n + '</p><p class="astu-card__o">' + (m.o || SEG[m.s] || "") + '</p>' +
      (m.p ? '<p class="astu-card__p">' + m.p + "</p>" : '<p class="astu-card__p" style="font-weight:600;opacity:.75">Цена по запросу</p>') + "</div></a>";
  }
  function openCompare() {
    var list = segModels();
    var rows = list.map(function (m) {
      var cur = MODEL && m.k === MODEL.k;
      return '<li class="astu-cmp__it' + (cur ? " is-cur" : "") + '"><div class="astu-cmp__img" style="background-image:url(\'' + m.i + '\')"></div><div>' +
        '<div class="astu-cmp__n">' + m.n + (cur ? ' <span style="font-size:12px;font-weight:600;color:' + CFG.brand + '">· вы здесь</span>' : "") + "</div>" +
        '<div class="astu-cmp__o">' + (m.o || "") + "</div>" +
        '<p class="astu-cmp__d">' + m.d + "</p>" +
        '<div class="astu-cmp__a"><span class="astu-cmp__p">' + (m.p || "Цена по запросу") + "</span>" +
        (cur ? "" : '<a href="' + m.h + '">Открыть</a>') +
        '<button type="button" data-k="' + m.k + '">Расчёт</button></div></div></li>';
    }).join("");
    var sh = openSheet('<p class="astu-h">' + (SEG[MODEL.s] || "Модели класса") + '</p><p class="astu-sub">' + list.length + " моделей в одном классе. Цены — ориентир, точный расчёт пришлём по заявке.</p>" +
      '<ul class="astu-cmp__list">' + rows + "</ul>", "astu-cmp");
    sh.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-k]");
      if (!b) return;
      var m = MODELS.filter(function (x) { return x.k === b.getAttribute("data-k"); })[0];
      var keep = MODEL; MODEL = m; openLead({ cta: "Сравнение: " + m.n, where: "compare" }); MODEL = keep;
    });
    goal("ast_compare_open", { seg: MODEL.s });
  }
  function placeSimilar() {
    if (document.querySelector(".astu-sim") || !MODEL) return;
    var list = segModels().filter(function (m) { return m.k !== MODEL.k; });
    if (list.length < 2) return;
    var sec = el("section", "astu-sim");
    sec.setAttribute("data-astu", "similar");
    sec.innerHTML = '<div class="astu-sim__in"><p class="astu-sim__k">' + (SEG[MODEL.s] || "") + '</p><h2 class="astu-sim__h">Похожие модели</h2>' +
      '<div class="astu-sim__row">' + list.map(cardHTML).join("") + "</div>" +
      '<button class="astu-sim__cmp" type="button">Сравнить все ' + (list.length + 1) + " модели класса " + ICON.arrow + "</button></div>";
    sec.querySelector(".astu-sim__cmp").addEventListener("click", openCompare);
    // Before the footer / legal block, otherwise at the end of the page content
    var anchor = null;
    var foot = document.querySelectorAll("footer,[class*=footer]");
    for (var i = 0; i < foot.length; i++) { if (vis(foot[i]) && !ours(foot[i])) { anchor = foot[i]; break; } }
    if (!anchor) {
      var legal = [].filter.call(document.querySelectorAll("p,div"), function (n) { return !n.children.length && /ИНН\s*6313553773|ООО\s*«?АСТ»?/.test(n.textContent || "") && vis(n); });
      if (legal.length) anchor = blockOf(legal[legal.length - 1], 1.2);
    }
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor);
    else (document.querySelector("#allrecords") || document.body).appendChild(sec);
    if (isDarkAt(sec.parentElement)) sec.classList.add("is-dark");
  }

  /* ------------------------------------------------------------ mobile spacing + text */
  function tighten() {
    if (!isMobile()) return;
    var vh = window.innerHeight;
    document.querySelectorAll("section,article,div,header,footer,figure").forEach(function (n) {
      if (ours(n) || n.hasAttribute("data-astu-tight")) return;
      var s = getComputedStyle(n);
      if (s.position === "fixed") return;
      var pt = parseFloat(s.paddingTop), pb = parseFloat(s.paddingBottom), mt = parseFloat(s.marginTop), mb = parseFloat(s.marginBottom);
      var hit = false;
      if (pt > 88) { n.style.setProperty("padding-top", "48px", "important"); hit = true; }
      if (pb > 88) { n.style.setProperty("padding-bottom", "48px", "important"); hit = true; }
      if (mt > 88) { n.style.setProperty("margin-top", "40px", "important"); hit = true; }
      if (mb > 88) { n.style.setProperty("margin-bottom", "40px", "important"); hit = true; }
      // Empty boxes taller than half a screen: no text, no media, no background picture.
      var r = n.getBoundingClientRect();
      if (r.height > vh * 0.5 && r.height < vh * 3 && !(n.innerText || "").trim() &&
          !n.querySelector("img,video,picture,canvas,iframe,svg") && s.backgroundImage === "none" &&
          ![].some.call(n.querySelectorAll("*"), function (c) { return getComputedStyle(c).backgroundImage !== "none"; })) {
        n.style.setProperty("min-height", "0", "important");
        n.style.setProperty("height", "auto", "important");
        hit = true;
      }
      if (hit) n.setAttribute("data-astu-tight", "1");
    });
    document.querySelectorAll("p,li").forEach(function (n) {
      if (ours(n) || n.classList.contains("astu-txt")) return;
      var fs = parseFloat(getComputedStyle(n).fontSize);
      if (fs < 13 && (n.textContent || "").trim().length > 40 && vis(n)) n.classList.add("astu-txt");
    });
  }

  /* ------------------------------------------------------------ run */
  function markScroller() {
    if (document.querySelector("[data-astu-scroller]")) return;
    var s = [].find.call(document.querySelectorAll("body *"), function (e) {
      var cs = getComputedStyle(e);
      return e.clientHeight > 400 && e.scrollHeight > e.clientHeight + 300 && /(auto|scroll)/.test(cs.overflowY);
    });
    if (s) s.setAttribute("data-astu-scroller", "1");
  }
  function pass() {
    try { fixTelegram(); } catch (e) {}
    try { cleanForeign(); } catch (e) {}
    try { unifyInlineForms(); } catch (e) {}
    try { removeQuiz(); } catch (e) {}
  }
  function init() {
    if (!document.getElementById("astu-style")) {
      var st = document.createElement("style");
      st.id = "astu-style";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    document.documentElement.classList.add("astu-on");
    markScroller();
    pass();
    try { placeLogo(); } catch (e) {}
    // 10.10: bottom bars stay as they are (Dmitry) — no pill.
    try { placeSafe(); } catch (e) {}
    try { placeSimilar(); } catch (e) {}
    try { tighten(); } catch (e) {}
    // Pages render parts late: re-run the cheap passes for 12 s.
    if (window.MutationObserver) {
      var t = null;
      var mo = new MutationObserver(function () { clearTimeout(t); t = setTimeout(pass, 250); });
      mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); }, 12000);
    }
    setTimeout(function () { pass(); tighten(); }, 3000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
