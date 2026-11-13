/*
 * AST Этап 1 «Измерение + конверсия» — глобальный рантайм avtonds.ru.
 *
 * Блок A: единая схема событий Метрики (A1), составная цель ast_contact с
 * дедупликацией на визит (A2), передача источника в CRM-формы (A6).
 * Блок B: липкая панель мессенджеров (B1), предзаполненные мессенджер-ссылки (B2),
 * квиз «Рассчитать стоимость» (B3).
 * Блок C: CTA-шаблон статей /news/* (C6).
 * Директ: параметры визита из URL объявлений и цель ast_form_start
 * (аудит отказов Яндекс.Директа от 14.05.2026, шаг 5).
 *
 * Существующие автоцели и инлайн-скрипты страниц не отключаются — новые цели
 * идут параллельно для сверки (требование A1).
 */
(function () {
  'use strict';
  if (window.__astConversionRuntime) return;
  window.__astConversionRuntime = 1;

  var CONFIG = {
    metrikaId: 106049767,
    telegram: 'ASTavtomoto',
    whatsapp: '79991583458',
    phone: '+79991583458',
    phoneDisplay: '+7 999 158 34 58',
    privacyUrl: '/privacy',
    // Страницы без липкой панели (B1)
    stickyExcluded: ['/privacy', '/referal'],
    // Подпись под кнопками — словарь п. 5
    ctaHint: 'Ответим в течение часа в рабочее время · Без предоплаты за расчёт'
  };

  // Убираем устаревший номер из Tilda-инлайн кода, который может попасть в DOM
  // до загрузки этого общего рантайма. Это переходный слой для старых страниц.
  function normalizeLegacyPhone() {
    if (!document.body) return;
    var replacements = [
      ['+7 987 283-12-55', CONFIG.phoneDisplay],
      ['+7 987 283 12 55', CONFIG.phoneDisplay],
      ['987 283-12-55', '999 158 34 58'],
      ['987 283 12 55', '999 158 34 58'],
      ['+79872831255', CONFIG.phone],
      ['79872831255', CONFIG.whatsapp]
    ];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (parent && /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
      var text = node.nodeValue;
      replacements.forEach(function (pair) { text = text.split(pair[0]).join(pair[1]); });
      if (text !== node.nodeValue) node.nodeValue = text;
    }
    document.querySelectorAll('a, [content], [value], [data-phone]').forEach(function (el) {
      ['href', 'content', 'value', 'data-phone'].forEach(function (name) {
        if (!el.hasAttribute(name)) return;
        var value = el.getAttribute(name);
        replacements.forEach(function (pair) { value = value.split(pair[0]).join(pair[1]); });
        el.setAttribute(name, value);
      });
    });
  }

  // Карта оффера по маршруту: slug + человекочитаемая модель для текстов B2/B3.
  var OFFER_MAP = {
    '/bezopasnaya-sdelka': { offer: 'safe-deal' },
    '/bezopasnaya-pokupka-avto': { offer: 'safe-deal' },
    '/premium-auto-lizing': { offer: 'leasing' },
    '/auto-v-lizing': { offer: 'leasing' },
    '/leasing': { offer: 'leasing' },
    '/auto-s-nds-dlya-biznesa': { offer: 'leasing' },
    '/b2b': { offer: 'leasing' },
    '/skynomad': { offer: 'xiaomi-n90', model: 'Xiaomi SkyNomad N90 Max' },
    '/aston-martin-dbx707': { model: 'Aston Martin DBX707' },
    '/bentley-bentayga': { model: 'Bentley Bentayga' },
    '/bentley-continental-gt': { model: 'Bentley Continental GT' },
    '/bentley-continental-gt-mulliner': {model:'Bentley Continental GT Mulliner'},
    '/audi-a5l': {model:'Audi A5L',offer:'audi-a5l'},
    '/bmw-x5-import': { offer: 'bmw-x5', model: 'BMW X5' },
    '/bmw-x6': { model: 'BMW X6' },
    '/bmw-x7': { model: 'BMW X7' },
    '/ferrari-purosangue': { model: 'Ferrari Purosangue' },
    '/lamborghini-urus': { model: 'Lamborghini Urus' },
    '/lexus-gx': { model: 'Lexus GX' },
    '/lexus-lx': { model: 'Lexus LX' },
    '/mercedes-amg-g63': { model: 'Mercedes-AMG G 63' },
    '/mercedes-benz-gle-import': { offer: 'mercedes-gle', model: 'Mercedes-Benz GLE' },
    '/mercedes-benz-gls-import': { offer: 'mercedes-gls', model: 'Mercedes-Benz GLS' },
    '/mercedes-benz-s-class-import': { offer: 'mercedes-s-class', model: 'Mercedes-Benz S-Class' },
    '/nissan-qashqai-china': { model: 'Nissan Qashqai' },
    '/porsche-911': { model: 'Porsche 911' },
    '/porsche-cayenne-import': { offer: 'porsche-cayenne', model: 'Porsche Cayenne' },
    '/porsche-panamera-import': { offer: 'porsche-panamera', model: 'Porsche Panamera' },
    '/porsche-import': { offer: 'porsche', model: 'Porsche' },
    '/range-rover': { model: 'Range Rover' },
    '/rolls-royce-cullinan': { model: 'Rolls-Royce Cullinan' },
    '/toyota-land-cruiser-300': { offer: 'toyota-lc300', model: 'Toyota Land Cruiser 300' },
    '/toyota-prado-250': { model: 'Toyota Prado 250' },
    '/volkswagen-tiguan-l-pro': { model: 'Volkswagen Tiguan L Pro' },
    '/zeekr-8x': { model: 'Zeekr 8X' }
  };

  // Стандартные UTM — Метрика разбирает их сама.
  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  // Параметры шаблонов Яндекс.Директа из URL объявлений (аудит 14.05.2026).
  // Метрика не считает их UTM и никуда не выводит: без явной передачи отказы
  // по utm_source_type (автотаргетинг vs. поиск) сегментировать нечем.
  var DIRECT_KEYS = ['yclid', 'utm_campaign_id', 'utm_group_id', 'utm_source_type',
    'utm_position_type', 'utm_device', 'utm_retargeting'];
  var SOURCE_KEYS = UTM_KEYS.concat(DIRECT_KEYS);

  // ---------------------------------------------------------------- утилиты

  function path() {
    return (location.pathname.replace(/\/+$/, '') || '/');
  }

  function pageOffer() {
    var el = document.querySelector('[data-offer]');
    if (el && el.getAttribute('data-offer')) return el.getAttribute('data-offer');
    var entry = OFFER_MAP[path()];
    if (entry) return entry.offer || path().replace(/^\//, '');
    return 'generic';
  }

  function pageModel() {
    var entry = OFFER_MAP[path()];
    return (entry && entry.model) || '';
  }

  function sessionGet(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function sessionSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) {}
  }

  // A1: одно событие — одна цель Метрики + зеркалирование в dataLayer.
  function track(goal, params) {
    params = params || {};
    try {
      if (typeof window.ym === 'function') {
        window.ym(CONFIG.metrikaId, 'reachGoal', goal, params);
      }
    } catch (e) {}
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: goal }, params));
    } catch (e) {}
  }

  // A2: составная цель «AST: обращение» — один визит, одно ast_contact.
  function trackContact(channel, extra) {
    if (sessionGet('ast_contact_sent') !== '1') {
      sessionSet('ast_contact_sent', '1');
      track('ast_contact', Object.assign({
        page: path(),
        channel: channel,
        offer: pageOffer()
      }, extra || {}));
    }
  }

  function ctaParams(position, channel, extra) {
    return Object.assign({
      page: path(),
      position: position,
      channel: channel,
      offer: pageOffer()
    }, extra || {});
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // ------------------------------------------------- B2: мессенджер-ссылки

  function messengerBaseText() {
    var p = path();
    var model = pageModel();
    if (model) return 'Здравствуйте! Интересует ' + model + ' под заказ';
    if (p === '/bezopasnaya-sdelka' || p === '/bezopasnaya-pokupka-avto') {
      return 'Здравствуйте! Интересует безопасная сделка, хочу обсудить условия';
    }
    if (OFFER_MAP[p] && OFFER_MAP[p].offer === 'leasing') {
      return 'Здравствуйте! Интересует лизинг / поставка на юрлицо';
    }
    if (p.indexOf('/news') === 0 || p.indexOf('/guides') === 0) {
      var title = (document.title || '').split('|')[0].trim();
      return 'Здравствуйте! Прочитал статью «' + title + '», интересует автомобиль под заказ';
    }
    return 'Здравствуйте! Хочу подобрать автомобиль под заказ';
  }

  function messengerText(custom) {
    var marker = ' (с сайта, стр. ' + (path() === '/' ? 'главная' : path().replace(/^\//, '')) + ')';
    return (custom || messengerBaseText()) + marker;
  }

  function telegramLink(customText) {
    return 'https://t.me/' + CONFIG.telegram + '?text=' + encodeURIComponent(messengerText(customText));
  }

  function whatsappLink(customText) {
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(messengerText(customText));
  }

  function decorateMessengerLinks(root) {
    var links = (root || document).querySelectorAll(
      'a[href^="https://t.me/"], a[href^="https://wa.me/"], a[href^="https://api.whatsapp.com/"]'
    );
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute('href') || '';
      if (a.dataset.astMessengerDecorated === '1') return;
      if (href.indexOf('?') > -1 || href.indexOf('text=') > -1) return; // уже с текстом
      a.dataset.astMessengerDecorated = '1';
      var custom = a.getAttribute('data-ast-message') || null;
      if (href.indexOf('t.me/') > -1) {
        a.setAttribute('href', telegramLink(custom));
      } else {
        a.setAttribute('href', whatsappLink(custom));
      }
    });
  }

  // --------------------------------------- A1: делегированный сбор событий

  function channelOf(anchor) {
    var href = (anchor.getAttribute('href') || '').toLowerCase();
    if (href.indexOf('t.me/') > -1 || href.indexOf('tg://') === 0) return 'telegram';
    if (href.indexOf('wa.me/') > -1 || href.indexOf('api.whatsapp.com') > -1) return 'whatsapp';
    if (href.indexOf('tel:') === 0) return 'phone';
    return '';
  }

  function positionOf(el) {
    if (el.closest('.ast-sticky-cta, .ast-traffic-sticky, .ast-sticky')) return 'sticky';
    if (el.closest('.ast-article-cta')) return 'article_end';
    if (el.closest('.ast-article-inline-cta')) return 'article_inline';
    if (el.closest('footer, .ast-footer')) return 'footer';
    if (el.closest('.ast-hero, .ast-model-hero, .ast-luxury-hero, .ast-zeekr-hero, header, .ast-header-v2, .t-cover')) return 'hero';
    if (el.closest('.ast-quiz')) return 'quiz';
    return 'inline';
  }

  function isCta(el) {
    return !!el.closest('.ast-btn, [data-ast-cta], [data-ast-quiz-open], [data-ast-header-v2-open], [data-ast-sticky-v2], .ast-sticky-cta__btn, .ast-sticky-cta__item, .ast-sticky-cta__fab, .ast-quiz__btn, .ast-article-cta__actions');
  }

  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('a, button') : null;
    if (!el) return;
    var channel = el.tagName === 'A' ? channelOf(el) : '';
    var cta = isCta(el);
    if (!channel && !cta) return;
    var position = positionOf(el);

    if (cta || channel) {
      var ch = channel || (el.closest('[data-ast-quiz-open], .ast-quiz') ? 'quiz'
        : (el.closest('form, [data-ast-header-v2-open], [data-ast-sticky-v2="calc"]') || el.hasAttribute('data-ast-header-v2-open') ? 'form' : ''));
      track('ast_cta_click', ctaParams(position, ch || 'other'));
    }
    if (channel === 'telegram' || channel === 'whatsapp') {
      track('ast_messenger_open', ctaParams(position, channel));
      trackContact(channel, { position: position });
    } else if (channel === 'phone') {
      track('ast_phone_click', ctaParams(position, 'phone'));
      trackContact('phone', { position: position });
    }
  }, true);

  // --------------- Директ: параметры визита и старт формы (аудит 14.05.2026)

  // Отказ — метрика уровня визита, поэтому параметрами цели он не сегментируется.
  // Шаг 5 аудита («через 48–72 часа проверить отказы по utm_content и
  // utm_source_type») требует именно параметров визита: отчёт
  // «Содержание → Параметры визитов → ast_source».
  function sourceParams() {
    var out = {};
    SOURCE_KEYS.forEach(function (key) {
      var value = sessionGet('ast_' + key);
      if (value) out[key] = value;
    });
    return out;
  }

  function sendVisitParams(attempt) {
    attempt = attempt || 0;
    var source = sourceParams();
    // Без источника в URL параметры визита не отправляем: пустой ast_source
    // только зашумил бы отчёт органикой и прямыми заходами.
    if (!Object.keys(source).length) return;
    if (typeof window.ym === 'function') {
      source.landing_page = sessionGet('ast_landing_page') || path();
      try { window.ym(CONFIG.metrikaId, 'params', { ast_source: source }); } catch (e) {}
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'ast_source_params', ast_source: source });
      } catch (e) {}
      return;
    }
    // Метрика на сайте грузится с задержкой — та же схема ретраев, что у A6.
    if (attempt > 20) return;
    setTimeout(function () { sendVisitParams(attempt + 1); }, 1500);
  }

  // Аудит: «считать не CTR, а qualified lead / form start / messenger click».
  // Одно событие на визит — как у ast_contact (A2).
  function trackFormStart(position, extra) {
    if (sessionGet('ast_form_start_sent') === '1') return;
    sessionSet('ast_form_start_sent', '1');
    track('ast_form_start', ctaParams(position || 'inline', 'form', extra || {}));
  }

  function bindFormStart() {
    document.addEventListener('focusin', function (event) {
      var el = event.target;
      if (!el || !el.closest || !el.matches) return;
      if (!el.matches('input, textarea, select')) return;
      if (el.type === 'hidden') return;
      var quiz = el.closest('.ast-quiz');
      if (quiz) { trackFormStart('quiz'); return; }
      if (el.closest('[data-ast-standard-form],#ast-quote-native-record')) return;
      if (!el.closest('form.t-form, form.ast-launch-form, form[data-ast-lead-form]')) return;
      trackFormStart(positionOf(el));
    }, true);
  }

  // ------------------------------------- отправка форм Tilda → ast_form_submit

  function reportFormSubmit(meta) {
    track('ast_form_submit', ctaParams((meta && meta.position) || 'inline', 'form', meta));
    trackContact('form');
  }

  // 1) Наблюдаем за успех-боксами Tilda (.js-successbox становится видимым).
  function watchTildaSuccess() {
    var seen = [];
    function scan() {
      var boxes = document.querySelectorAll('.js-successbox, .t-form__successbox');
      Array.prototype.forEach.call(boxes, function (box) {
        if (seen.indexOf(box) > -1 || box.closest('#ast-quote-native-record')) return;
        var visible = box.offsetParent !== null && box.style.display !== 'none';
        if (visible) {
          seen.push(box);
          reportFormSubmit({ form: 'tilda' });
        }
      });
    }
    if (window.MutationObserver) {
      var mo = new MutationObserver(scan);
      onReady(function () {
        if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
      });
    }
    setInterval(scan, 2500);
  }

  // 2) Инлайн-скрипты страниц пушат свои success-события в dataLayer — зеркалим.
  function bridgeDataLayer() {
    window.dataLayer = window.dataLayer || [];
    var origPush = window.dataLayer.push.bind(window.dataLayer);
    var successRe = /^(form_submit_success|tilda_form_success|lead_form_success)$/;
    window.dataLayer.push = function () {
      try {
        for (var i = 0; i < arguments.length; i += 1) {
          var item = arguments[i];
          if (item && typeof item === 'object' && successRe.test(String(item.event || ''))) {
            reportFormSubmit({ form: String(item.form || 'inline') });
          }
        }
      } catch (e) {}
      return origPush.apply(null, arguments);
    };
  }

  // ------------------------------ A6: источник и clientID в скрытые поля форм

  function persistUtm() {
    var params = new URLSearchParams(location.search);
    var found = false;
    SOURCE_KEYS.forEach(function (key) { if (params.get(key)) found = true; });
    if (found) {
      SOURCE_KEYS.forEach(function (key) { sessionSet('ast_' + key, params.get(key) || ''); });
    }
    if (!sessionGet('ast_landing_page')) sessionSet('ast_landing_page', path());
    if (!sessionGet('ast_referrer')) sessionSet('ast_referrer', document.referrer || '');
  }

  // Версия текста согласия на обработку ПДн (план AST Reserve v2, п. 4.2:
  // версия фиксируется вместе с заявкой). Формы сайта уже несут поле
  // consent_version — рантайм только переносит это значение в формы, где поля
  // нет, и никогда не проставляет версию, которой на странице не существует.
  var consentVersion = '';
  function pageConsentVersion() {
    if (consentVersion) return consentVersion;
    var input = document.querySelector('input[name="consent_version"]');
    if (input && input.value) consentVersion = input.value;
    return consentVersion;
  }

  function ensureHidden(form, name) {
    var input = form.querySelector('[name="' + name + '"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    return input;
  }

  function fillFormSources() {
    var clientId = sessionGet('ast_ym_client_id') || '';
    var forms = document.querySelectorAll('form.t-form, form.ast-launch-form, form[data-ast-lead-form]');
    Array.prototype.forEach.call(forms, function (form) {
      SOURCE_KEYS.forEach(function (key) {
        var stored = sessionGet('ast_' + key);
        var input = ensureHidden(form, key);
        if (stored && !input.value) input.value = stored;
      });
      var pageInput = ensureHidden(form, 'page');
      if (!pageInput.value) pageInput.value = path();
      var offerInput = ensureHidden(form, 'offer');
      if (!offerInput.value) offerInput.value = pageOffer();
      var consentValue = pageConsentVersion();
      if (consentValue) {
        var consentInput = ensureHidden(form, 'consent_version');
        if (!consentInput.value) consentInput.value = consentValue;
      }
      if (clientId) ensureHidden(form, 'ym_client_id').value = clientId;
    });
  }

  function fetchClientId(attempt) {
    attempt = attempt || 0;
    if (attempt > 20) return;
    if (typeof window.ym === 'function') {
      try {
        window.ym(CONFIG.metrikaId, 'getClientID', function (clientID) {
          sessionSet('ast_ym_client_id', String(clientID || ''));
          fillFormSources();
        });
        return;
      } catch (e) {}
    }
    setTimeout(function () { fetchClientId(attempt + 1); }, 1500);
  }

  // --------------------------------------------- B1: липкая панель мессенджеров

  var ICONS = {
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.4 4.6 18 20.5c-.3 1.4-1.1 1.8-2.2 1.1l-5.1-3.8-2.5 2.4c-.3.3-.5.5-1 .5l.4-5.2 9.5-8.6c.4-.4-.1-.7-.6-.4L4.7 13 0 11.5c-1-.3-1-1 .2-1.4L19 2.8c.9-.3 2 .2 2.4 1.8z"/></svg>',
    request: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1 2v16h10V7h-4V4H7zm2 6h6v2H9v-2zm0 4h6v2H9v-2z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.8-4.4-3.9-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4.2.5.7 1.8.8 1.9.1.1.1.3 0 .4-.1.2-.1.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 1.9 1.1.9 1.9 1.2 2.2 1.4.3.1.4.1.6-.1.2-.2.7-.8.8-1 .2-.3.4-.2.6-.1l1.8.8c.3.1.4.2.5.3 0 .2 0 .6-.2 1z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>'
  };

  function stickyAllowed() {
    var p = path();
    if (CONFIG.stickyExcluded.indexOf(p) > -1) return false;
    if (/spasibo|thank/.test(p)) return false;
    return true;
  }

  function buildSticky() {
    if (!stickyAllowed()) return;
    if (document.querySelector('.ast-sticky-cta')) return;

    var mobile = document.createElement('div');
    mobile.className = 'ast-sticky-cta ast-sticky-cta--mobile';
    mobile.setAttribute('role', 'navigation');
    mobile.setAttribute('aria-label', 'Быстрая связь');
    mobile.innerHTML =
      '<a class="ast-sticky-cta__btn ast-sticky-cta__btn--request" href="/contacts#lead">' +
        ICONS.request + '<span>Оставить заявку</span></a>' +
      '<a class="ast-sticky-cta__btn ast-sticky-cta__btn--whatsapp" href="' + whatsappLink() + '" rel="noopener">' +
        ICONS.whatsapp + '<span>WhatsApp</span></a>';

    var desktop = document.createElement('div');
    desktop.className = 'ast-sticky-cta ast-sticky-cta--desktop';
    desktop.setAttribute('aria-label', 'Быстрая связь');
    desktop.innerHTML =
      '<div class="ast-sticky-cta__menu">' +
        '<a class="ast-sticky-cta__item ast-sticky-cta__item--request" href="/contacts#lead">' +
          ICONS.request + '<span>Оставить заявку</span></a>' +
        '<a class="ast-sticky-cta__item ast-sticky-cta__item--whatsapp" href="' + whatsappLink() + '" rel="noopener">' +
          ICONS.whatsapp + '<span>Написать в WhatsApp</span></a>' +
        '<a class="ast-sticky-cta__item ast-sticky-cta__item--phone" href="tel:' + CONFIG.phone + '">' +
          ICONS.phone + '<span>Позвонить: ' + CONFIG.phoneDisplay + '</span></a>' +
      '</div>' +
      '<button class="ast-sticky-cta__fab" type="button" aria-label="Связаться с нами">' + ICONS.request + '</button>';

    desktop.querySelector('.ast-sticky-cta__fab').addEventListener('click', function () {
      desktop.classList.toggle('ast-sticky-cta--open');
    });

    document.body.appendChild(mobile);
    document.body.appendChild(desktop);
    document.documentElement.classList.add('ast-sticky-cta-active');

    var shown = false;
    function show() {
      if (shown) return;
      shown = true;
      mobile.classList.add('ast-sticky-cta--visible');
      desktop.classList.add('ast-sticky-cta--visible');
    }
    // Появление: через 3 секунды или после скролла 15%.
    setTimeout(show, 3000);
    window.addEventListener('scroll', function onScroll() {
      var doc = document.documentElement;
      var max = Math.max(1, doc.scrollHeight - window.innerHeight);
      if ((window.scrollY || window.pageYOffset || 0) / max >= 0.15) {
        show();
        window.removeEventListener('scroll', onScroll);
      }
    }, { passive: true });
  }

  // ----------------------------------------- B3: квиз «Рассчитать стоимость»

  var quizState = null;

  function quizAnswersText() {
    var s = quizState;
    return 'Здравствуйте! Прошу расчёт стоимости.\n' +
      'Автомобиль: ' + (s.model || 'не выбран') + '\n' +
      (s.offerId ? 'Предложение: ' + s.offerId + '\n' : '') +
      'Оформление: ' + (s.clientType || '—') + '\n' +
      'Срок: ' + (s.timeline || '—');
  }

  function quizRender() {
    var overlay = document.querySelector('.ast-quiz-overlay');
    if (!overlay) return;
    var box = overlay.querySelector('.ast-quiz');
    var s = quizState;
    var html = '<button class="ast-quiz__close" type="button" aria-label="Закрыть">×</button>';

    if (s.step === 1) {
      html += '<p class="ast-quiz__step-label">Шаг 1 из 3</p>' +
        '<h3 class="ast-quiz__title">Какой автомобиль?</h3>';
      var preset = s.model || pageModel();
      html += '<input class="ast-quiz__input" type="text" data-ast-quiz-model placeholder="Марка и модель" value="' +
        String(preset).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '">' +
        '<button class="ast-quiz__btn" type="button" data-ast-quiz-next>Дальше</button>';
    } else if (s.step === 2) {
      html += '<p class="ast-quiz__step-label">Шаг 2 из 3</p>' +
        '<h3 class="ast-quiz__title">Как оформляем?</h3>' +
        '<div class="ast-quiz__options">' +
        ['На физлицо', 'На юрлицо (с НДС)', 'Пока не знаю'].map(function (v) {
          // C5: предустановленный вариант виден как выбранный, иначе предустановка
          // ничем не проявлялась и терялась при первом же клике.
          var on = v === s.clientType;
          return '<button class="ast-quiz__option' + (on ? ' ast-quiz__option--active' : '') +
            '" type="button" aria-pressed="' + (on ? 'true' : 'false') +
            '" data-ast-quiz-client="' + v + '">' + v + '</button>';
        }).join('') + '</div>' +
        '<button class="ast-quiz__back" type="button" data-ast-quiz-back>← Назад</button>';
    } else if (s.step === 3) {
      html += '<p class="ast-quiz__step-label">Шаг 3 из 3</p>' +
        '<h3 class="ast-quiz__title">Когда нужен автомобиль?</h3>' +
        '<div class="ast-quiz__options">' +
        ['До 1 месяца', '1–3 месяца', 'Смотрю варианты'].map(function (v) {
          return '<button class="ast-quiz__option" type="button" data-ast-quiz-timeline="' + v + '">' + v + '</button>';
        }).join('') + '</div>' +
        '<button class="ast-quiz__back" type="button" data-ast-quiz-back>← Назад</button>';
    } else if (s.step === 4) {
      // Финал: Telegram — первый и самый заметный, телефон — третий.
      html += '<p class="ast-quiz__step-label">Готово</p>' +
        '<h3 class="ast-quiz__title">Куда прислать расчёт?</h3>' +
        '<div class="ast-quiz__final">' +
        '<a class="ast-quiz__btn ast-quiz__btn--telegram" data-ast-quiz-messenger="telegram" href="' +
          'https://t.me/' + CONFIG.telegram + '?text=' + encodeURIComponent(messengerText(quizAnswersText())) +
          '" rel="noopener">' + ICONS.telegram + 'Получить расчёт в Telegram</a>' +
        '<a class="ast-quiz__btn ast-quiz__btn--whatsapp" data-ast-quiz-messenger="whatsapp" href="' +
          'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(messengerText(quizAnswersText())) +
          '" rel="noopener">' + ICONS.whatsapp + 'Получить в WhatsApp</a>' +
        '<div class="ast-quiz__divider">или по телефону</div>' +
        '<div class="ast-quiz__error" data-ast-quiz-error></div>' +
        '<input class="ast-quiz__input" type="tel" data-ast-quiz-phone placeholder="+7 ___ ___-__-__" autocomplete="tel">' +
        '<label class="ast-quiz__consent"><input type="checkbox" data-ast-quiz-consent checked>' +
          '<span>Согласен на обработку персональных данных по <a href="' + CONFIG.privacyUrl +
          '" target="_blank" rel="noopener">политике конфиденциальности</a>. ООО «АСТ» · ИНН 6313553773.</span></label>' +
        '<button class="ast-quiz__btn ast-quiz__btn--ghost" type="button" data-ast-quiz-phone-submit>Жду звонка с расчётом</button>' +
        '</div>' +
        '<p class="ast-quiz__note">' + CONFIG.ctaHint + '</p>' +
        '<button class="ast-quiz__back" type="button" data-ast-quiz-back>← Назад</button>';
    } else if (s.step === 5) {
      html += '<div class="ast-quiz__success"><b>Заявка принята</b>' +
        '<p>Пришлём расчёт в течение часа в рабочее время.</p></div>';
    }

    box.innerHTML = html;
    var input = box.querySelector('[data-ast-quiz-model]');
    if (input) input.focus();
  }

  function quizSubmitPhone(phoneValue) {
    var s = quizState;
    var payload = {
      page: path(),
      position: s.position || 'inline',
      channel: 'quiz',
      offer: s.offer || pageOffer(),
      offer_id: s.offerId || '',
      quiz_model: s.model || '',
      quiz_client_type: s.clientType || '',
      quiz_timeline: s.timeline || '',
      quiz_contact: 'phone'
    };
    // Prefer the existing native receiver used by the site's working forms.
    // Do not report a conversion until this particular form is accepted.
    var form = Array.from(document.querySelectorAll('form.js-form-proccess')).find(function (f) {
      return f.querySelector('input[name="formservices[]"]') &&
        f.querySelector('[name="Phone"],[name="tildaspec-phone-part[]"]') &&
        f.querySelector('[type="submit"]');
    });
    if (!form || !window.tildaForm) return Promise.reject(new Error('native_form_unavailable'));
    var button = form.querySelector('[type="submit"]');
    if (form.dataset.astQuizBusy === '1' || button.tildaSendingStatus === '1') return Promise.reject(new Error('native_form_busy'));
    var set = function (name, value) {
      var inp = ensureHidden(form, name);
      inp.value = value || '';
      try {
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    };
    set('Name', 'Квиз: расчёт стоимости');
    var mask = form.querySelector('input[name="tildaspec-phone-part[]"]');
    if (mask) {
      var digits = phoneValue.replace(/\D/g, '');
      if (digits.length === 11 && digits.charAt(0) === '8') digits = '7' + digits.slice(1);
      if (digits.length === 10) digits = '7' + digits;
      if (typeof window.t_form_phonemask__setValue !== 'function') return Promise.reject(new Error('phone_mask_not_ready'));
      window.t_form_phonemask__setValue(mask.parentNode, '+' + digits, null, {noFocus:true});
    } else set('Phone', phoneValue);
    // The caller has checked the explicit consent in the quiz.
    form.querySelectorAll('input[type="checkbox"][data-tilda-req="1"]').forEach(function (el) {
      if (/^(Checkbox|consent)$/i.test(el.name)) {
        el.checked = true;
        el.dispatchEvent(new Event('change', {bubbles:true}));
      }
    });
    set('phone', phoneValue);
    set('contact', phoneValue);
    set('model', s.model || '');
    if (path() === '/' || s.offerId) {
      set('offer_id', s.offerId || '');
      set('quoteId', s.offerId || '');
    }
    set('scenario', 'quiz');
    set('client_type', s.clientType || '');
    set('timeline', s.timeline || '');
    set('source_detail', 'ast_quiz');
    set('comment', 'Квиз avtonds.ru\nАвтомобиль: ' + (s.model || '—') +
      (s.offerId ? '\nПредложение: ' + s.offerId : '') +
      '\nОформление: ' + (s.clientType || '—') +
      '\nСрок: ' + (s.timeline || '—') +
      '\nТелефон: ' + phoneValue);
    fillFormSources();

    return new Promise(function (resolve, reject) {
      var done = false;
      form.dataset.astQuizBusy = '1';
      var timer = setTimeout(function () { finish(false); }, 45000);
      var observer = new MutationObserver(function () {
        var errorBox = form.querySelector('.js-errorbox-all');
        if (errorBox && getComputedStyle(errorBox).display !== 'none' && errorBox.textContent.trim()) finish(false);
      });
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        observer.disconnect();
        form.removeEventListener('tildaform:aftersuccess', accepted);
        form.removeEventListener('tildaform:aftererror', failed);
        delete form.dataset.astQuizBusy;
        if (ok) {
          track('ast_quiz_submit', payload);
          trackContact('quiz', {position:payload.position});
          resolve();
        } else reject(new Error('native_form_not_accepted'));
      }
      function accepted() { finish(true); }
      function failed() { finish(false); }
      form.addEventListener('tildaform:aftersuccess', accepted);
      form.addEventListener('tildaform:aftererror', failed);
      observer.observe(form, {subtree:true, childList:true, attributes:true, attributeFilter:['class','style']});
      try { button.click(); } catch (error) { finish(false); }
    });
  }

  function openQuiz(options) {
    if (window.__astUniversalQuote) { window.__astUniversalQuote.open(options || {}); return; }
    options = options || {};
    var overlay = document.querySelector('.ast-quiz-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'ast-quiz-overlay';
      overlay.innerHTML = '<div class="ast-quiz" role="dialog" aria-modal="true" aria-label="Рассчитать стоимость"></div>';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (event) {
        if (event.target === overlay || event.target.closest('.ast-quiz__close')) {
          overlay.classList.remove('ast-quiz-overlay--open');
          return;
        }
        var next = event.target.closest('[data-ast-quiz-next]');
        var back = event.target.closest('[data-ast-quiz-back]');
        var client = event.target.closest('[data-ast-quiz-client]');
        var timeline = event.target.closest('[data-ast-quiz-timeline]');
        var phoneSubmit = event.target.closest('[data-ast-quiz-phone-submit]');
        var messenger = event.target.closest('[data-ast-quiz-messenger]');
        if (next) {
          var model = overlay.querySelector('[data-ast-quiz-model]');
          quizState.model = model ? model.value.trim() : '';
          // Изменённая модель уже не относится к выбранному КП.
          if (quizState.offerId && quizState.model !== quizState.offerModel) {
            quizState.offerId = '';
            syncHomeQuizOffer();
          }
          quizState.step = 2;
          quizRender();
        } else if (back) {
          quizState.step = Math.max(1, quizState.step - 1);
          quizRender();
        } else if (client) {
          quizState.clientType = client.getAttribute('data-ast-quiz-client');
          quizState.step = 3;
          quizRender();
        } else if (timeline) {
          quizState.timeline = timeline.getAttribute('data-ast-quiz-timeline');
          quizState.step = 4;
          quizRender();
        } else if (messenger) {
          // Контакт получен в мессенджере — фиксируем отправку квиза.
          track('ast_quiz_submit', {
            page: path(),
            position: quizState.position || 'inline',
            channel: 'quiz',
            offer: quizState.offer || pageOffer(),
            offer_id: quizState.offerId || '',
            quiz_model: quizState.model || '',
            quiz_client_type: quizState.clientType || '',
            quiz_timeline: quizState.timeline || '',
            quiz_contact: messenger.getAttribute('data-ast-quiz-messenger')
          });
          trackContact('quiz', { position: quizState.position || 'inline' });
          // ссылка откроет мессенджер сама; окно закрываем
          setTimeout(function () { overlay.classList.remove('ast-quiz-overlay--open'); }, 300);
        } else if (phoneSubmit) {
          var phoneInput = overlay.querySelector('[data-ast-quiz-phone]');
          var consent = overlay.querySelector('[data-ast-quiz-consent]');
          var error = overlay.querySelector('[data-ast-quiz-error]');
          var value = phoneInput ? phoneInput.value.trim() : '';
          if (value.replace(/\D/g, '').length < 10) {
            if (error) error.textContent = 'Укажите телефон в формате +7 ___ ___-__-__.';
            return;
          }
          if (consent && !consent.checked) {
            if (error) error.textContent = 'Нужно согласие на обработку персональных данных.';
            return;
          }
          if (phoneSubmit.disabled) return;
          phoneSubmit.disabled = true;
          error.textContent = 'Отправляем заявку…';
          var submittingState = quizState;
          quizSubmitPhone(value).then(function () {
            if (quizState !== submittingState) return;
            quizState.step = 5;
            quizRender();
          }).catch(function () {
            error.textContent = 'Приём заявки не подтверждён. ';
            var retry = document.createElement('a');
            var target = new URL('/contacts', location.origin);
            SOURCE_KEYS.forEach(function (key) {
              var saved = sessionGet('ast_' + key);
              if (saved) target.searchParams.set(key, saved);
            });
            if (submittingState.model) target.searchParams.set('model', submittingState.model);
            target.hash = 'lead';
            retry.href = target.href;
            retry.textContent = 'Открыть форму заявки';
            error.appendChild(retry);
            error.appendChild(document.createTextNode(' или позвоните ' + CONFIG.phoneDisplay + '.'));
          }).finally(function () { phoneSubmit.disabled = false; });
        }
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') overlay.classList.remove('ast-quiz-overlay--open');
      });
    }

    quizState = {
      step: options.step || 1,
      model: options.model || pageModel(),
      clientType: options.clientType || '',
      timeline: '',
      offer: options.offer || pageOffer(),
      offerId: String(options.offerId || ''),
      offerModel: String(options.model || '').trim(),
      position: options.position || 'inline'
    };
    // C5: для лизинговых страниц шаг 2 предустановлен «На юрлицо (с НДС)».
    if (!quizState.clientType && quizState.offer === 'leasing') {
      quizState.clientType = 'На юрлицо (с НДС)';
    }
    syncHomeQuizOffer();
    overlay.classList.add('ast-quiz-overlay--open');
    quizRender();
    trackFormStart(quizState.position, { offer: quizState.offer });
  }

  function syncHomeQuizOffer() {
    if (path() !== '/') return;
    // Legacy form bridges read this dataset as a fallback. Clear it for a
    // generic quiz too, so a previous card cannot leak into the next request.
    document.documentElement.dataset.astPendingOfferId = quizState.offerId;
    document.documentElement.dataset.astPendingOfferTitle = quizState.offerId ? quizState.offerModel : '';
    Array.prototype.forEach.call(document.querySelectorAll(
      'form [name="offer_id"], form [name="quoteId"]'
    ), function (input) { input.value = quizState.offerId; });
  }

  // The old #order workaround captures clicks on document before card handlers.
  // Capture on window, limited to homepage offer cards, including late renders.
  window.addEventListener('click', function (event) {
    if (window.__astUniversalQuote) return;
    if (path() !== '/' || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var trigger = event.target && event.target.closest ? event.target.closest('[data-ast-offer-action="order"]') : null;
    var card = trigger && trigger.closest('.ast-related-offer');
    var heading = card && card.querySelector('h3, h2');
    var offerId = trigger && trigger.getAttribute('data-ast-offer-id');
    if (!heading || !offerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    var model = heading.textContent.trim();
    track('ast_cta_click', ctaParams('offer_card', 'quiz', { offer_id: offerId }));
    track('offer_order', { offer_id: offerId, scenario: 'offers' });
    openQuiz({ model: model, offerId: offerId, position: 'offer_card' });
  }, true);

  // Открытие квиза по data-атрибуту с любого элемента.
  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-ast-quiz-open]') : null;
    if (!trigger) return;
    event.preventDefault();
    openQuiz({
      position: positionOf(trigger),
      offer: trigger.getAttribute('data-offer') || pageOffer(),
      model: trigger.getAttribute('data-ast-quiz-model-preset') || pageModel()
    });
  });

  // --------------------------------------------- C6: CTA-шаблон статей /news/*

  function isArticlePage() {
    return /^\/news\/[^/]+\/./.test(path()) || /^\/guides\/[^/]+/.test(path());
  }

  function articleModels(article) {
    var raw = (article && article.getAttribute('data-models')) || '';
    return raw ? raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
  }

  function buildArticleCta() {
    if (!isArticlePage()) return;
    if (document.querySelector('.ast-article-cta')) return;
    var article = document.querySelector('article') ||
      document.querySelector('main .t-container, main') || document.body;

    var models = articleModels(document.querySelector('article[data-models], [data-models]'));
    var title = (document.title || '').split('|')[0].trim();
    var lead = models.length
      ? '<b>Привезём ' + models.join(' или ') + ' из Европы / Китая.</b>'
      : '<b>Привезём автомобиль из этой статьи под заказ из Европы / Китая.</b>';

    // 1. Плашка после вывода статьи (в конце контента, не в подвале).
    var cta = document.createElement('aside');
    cta.className = 'ast-article-cta';
    cta.setAttribute('data-offer', pageOffer());
    cta.innerHTML =
      '<p>' + lead + '</p>' +
      '<p class="ast-article-cta__sub">Расчёт под ключ за 24 часа, оплата поэтапно под документы.</p>' +
      '<div class="ast-article-cta__actions">' +
        '<button type="button" class="ast-article-cta__quiz" data-ast-quiz-open>Рассчитать стоимость</button>' +
        '<a class="ast-article-cta__telegram" rel="noopener" href="' +
          telegramLink('Здравствуйте! Прочитал статью «' + title + '», интересует ' +
            (models[0] || 'автомобиль под заказ')) + '">Написать в Telegram</a>' +
      '</div>' +
      '<p class="ast-article-cta__hint">' + CONFIG.ctaHint + '</p>';
    article.appendChild(cta);

    // 2. Короткий CTA на ~45% глубины текста.
    var paragraphs = article.querySelectorAll('p');
    if (paragraphs.length >= 6) {
      var anchor = paragraphs[Math.floor(paragraphs.length * 0.45)];
      var inline = document.createElement('a');
      inline.className = 'ast-article-inline-cta';
      inline.href = '/catalog#models';
      inline.textContent = '→ Узнать цену под ключ' + (models[0] ? ' на ' + models[0] : '') + ' — расчёт за 24 часа';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(inline, anchor.nextSibling);
    }
  }

  // --------------------------------- C1–C5: постраничные CTA (аддитивно)

  function htmlToEl(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function quizBtnHtml(label, extraClass) {
    return '<button type="button" class="ast-btn ' + (extraClass || '') +
      '" data-ast-quiz-open>' + label + '</button>';
  }

  function tgBtnHtml(label, message, extraClass) {
    return '<a class="ast-btn ' + (extraClass || '') + '" rel="noopener" href="' +
      telegramLink(message) + '">' + label + '</a>';
  }

  function ctaRowHtml(inner) {
    return '<div class="ast-inner ast-cta-row" data-ast-cta-row>' + inner +
      '<p class="ast-cta-row__hint">' + CONFIG.ctaHint + '</p></div>';
  }

  // C1. Главная: primary hero — квиз, secondary — Telegram; повтор после каталога.
  function enhanceHome() {
    var root = document.querySelector('.ast-site-root');
    if (root) root.classList.add('ast-home-conversion');
    var actions = document.querySelector('.ast-hero .ast-actions');
    if (actions && !actions.querySelector('[data-ast-quiz-open]')) {
      actions.insertBefore(htmlToEl(quizBtnHtml('Рассчитать стоимость под ключ')), actions.firstChild);
      actions.appendChild(htmlToEl(tgBtnHtml('Написать в Telegram',
        'Здравствуйте! Хочу подобрать автомобиль под заказ', 'ast-btn--ghost')));
    }
    var modelsSection = document.querySelector('.ast-model-entry');
    if (modelsSection && !document.querySelector('[data-ast-cta-row="home"]')) {
      var row = htmlToEl(ctaRowHtml(quizBtnHtml('Рассчитать стоимость под ключ')));
      row.setAttribute('data-ast-cta-row', 'home');
      modelsSection.parentNode.insertBefore(row, modelsSection.nextSibling);
    }
  }

  // Price figures in the existing feed have no stated Russian VAT basis.
  // Only an explicit taxPricing object may supply net/gross amounts; never
  // divide a foreign/source price by 1.22. See docs/offer-tax-pricing.md.
  function taxPriceRows(offer) {
    var unknown = { net: 'Уточняется', gross: 'Уточняется', known: false };
    var tax = offer && offer.taxPricing;
    if (!tax || tax.currency !== 'RUB' || tax.vatRate !== 22 || tax.taxRegime !== 'standard') return unknown;
    if (tax.evidence !== 'seller_claimed' && tax.evidence !== 'document_confirmed') return unknown;
    var evidence = {
      seller_claimed: 'Заявлено продавцом',
      document_confirmed: 'Подтверждено документами'
    }[tax.evidence];
    if (!evidence) return unknown;
    function valid(amount) { return typeof amount === 'number' && isFinite(amount) && amount >= 0.01 && amount <= Number.MAX_SAFE_INTEGER / 122; }
    var hasNet = tax.netAmount != null;
    var hasGross = tax.grossAmount != null;
    if ((!hasNet && !hasGross) || (hasNet && !valid(tax.netAmount)) || (hasGross && !valid(tax.grossAmount))) return unknown;
    function cents(amount) { return Math.round(amount * 100); }
    var net = hasNet ? cents(tax.netAmount) : Math.round(cents(tax.grossAmount) / 1.22);
    var gross = hasGross ? cents(tax.grossAmount) : Math.round(net * 1.22);
    if (hasNet && hasGross && Math.abs(gross - Math.round(net * 1.22)) > 1) return unknown;
    function money(amount) {
      return (amount / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₽';
    }
    return {
      net: money(net), gross: money(gross), known: true,
      netEvidence: hasNet ? evidence : 'Расчёт от цены с НДС',
      grossEvidence: hasGross ? evidence : 'Расчёт от цены без НДС'
    };
  }

  function enhanceOfferPrices() {
    if (['/', '/offers', '/catalog'].indexOf(path()) === -1) return;
    var source = window.__astPublicOffersData;
    var offers = Array.isArray(source) ? source : (source && source.offers) || [];
    if (!Array.isArray(offers)) offers = [];
    var byId = Object.create(null);
    offers.forEach(function (offer) { if (offer && offer.id) byId[String(offer.id)] = offer; });
    var cards = document.querySelectorAll('.ast-related-offer, #offersGrid .offer-card, #offersGrid article, ' +
      '.ast-public-offer-detail[data-ast-offer-id], .ast-pg-offer[data-ast-offer-card], .ast-pg-offer-detail');
    Array.prototype.forEach.call(cards, function (card) {
      var action = card.querySelector('[data-ast-offer-id], [data-ast-order-offer]');
      var id = card.getAttribute('data-ast-offer-id') || card.getAttribute('data-ast-offer-card') ||
        (action && (action.getAttribute('data-ast-offer-id') || action.getAttribute('data-ast-order-offer')));
      var rows = taxPriceRows(byId[id]);
      var signature = JSON.stringify(rows);
      var panel = card.querySelector('.ast-tax-prices');
      if (panel && panel.getAttribute('data-ast-tax-value') === signature) return;
      if (!panel) {
        panel = document.createElement('div');
        panel.className = 'ast-tax-prices';
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', 'Цены и НДС');
        var actions = card.querySelector('.ast-related-offer__actions, .offer-actions, .ast-pg-offer__actions, [data-ast-order-offer]');
        var body = card.querySelector('.ast-related-offer__body, .offer-card-body, .ast-pg-offer__body') || card;
        var detailPrice = card.querySelector('.detail-price');
        var galleryPrice = card.querySelector('.ast-pg-offer__body > strong, .ast-pg-offer-detail > div > h2 + p');
        if (galleryPrice) galleryPrice.parentNode.insertBefore(panel, galleryPrice.nextSibling);
        else if (detailPrice) detailPrice.appendChild(panel);
        else if (actions) actions.parentNode.insertBefore(panel, actions);
        else body.appendChild(panel);
      }
      panel.setAttribute('data-ast-tax-value', signature);
      panel.innerHTML = '<dl><div><dt>Цена без НДС</dt><dd></dd></div>' +
        '<div><dt>Цена с НДС' + (rows.known ? ' (22%)' : '') + '</dt><dd></dd></div></dl>' +
        '<p class="ast-tax-prices__note"></p>';
      var values = panel.querySelectorAll('dd');
      [rows.net, rows.gross].forEach(function (value, index) {
        values[index].textContent = value;
        if (rows.known) {
          var label = document.createElement('small');
          label.textContent = index === 0 ? rows.netEvidence : rows.grossEvidence;
          values[index].appendChild(label);
        }
      });
      panel.querySelector('.ast-tax-prices__note').textContent = rows.known
        ? 'Состав поставки и условия оплаты — в расчёте по выбранному автомобилю.'
        : 'Налоговая база и состав цены пока не подтверждены. Уточним их в расчёте по автомобилю.';
      var sourcePrice = card.querySelector('.ast-related-offer__price, .detail-price > strong, .ast-pg-offer__body > strong, .ast-pg-offer-detail > div > h2 + p');
      if (sourcePrice && !card.querySelector('.ast-tax-price-source')) {
        var sourceLabel = document.createElement('p');
        sourceLabel.className = 'ast-tax-price-source';
        sourceLabel.textContent = 'Цена в предложении · заявлено продавцом';
        sourcePrice.parentNode.insertBefore(sourceLabel, sourcePrice);
      }
    });
  }

  function watchOfferPrices() {
    if (['/', '/offers', '/catalog'].indexOf(path()) === -1) return;
    enhanceOfferPrices();
    if (!window.MutationObserver || !document.body) return;
    var queued = false;
    var observer = new MutationObserver(function (changes) {
      if (queued || !changes.some(function (change) {
        var node = change.target.nodeType === 1 ? change.target : change.target.parentElement;
        return node && !node.closest('.ast-tax-prices, .ast-tax-price-source');
      })) return;
      queued = true;
      setTimeout(function () { queued = false; enhanceOfferPrices(); }, 0);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // C2. /bezopasnaya-sdelka: primary — «Обсудить мою сделку» в Telegram,
  // повтор после этапов оплаты, квиз внизу. FAQ и FAQPage уже есть на странице.
  // Keep the existing Tilda form, receiver bindings and native acknowledgement.
  // Its submit handler is delegated to the Tilda record, so stay in that record.
  function mountSafeQuickForm() {
    var form = document.getElementById('ast-safe-deal-form');
    var hero = document.querySelector('.ast-safe-hero__copy');
    if (!form || !hero || !form.closest('.t-rec') || form.closest('.t-rec') !== hero.closest('.t-rec')) return false;
    if (form.dataset.quickRequest === '1') return true;
    var contact = form.elements.Phone;
    var consent = form.elements.consent;
    var send = form.querySelector('[type="submit"]');
    if (!contact || !consent || !send || !form.querySelector('.js-formaction-services')) return false;

    form.dataset.quickRequest = '1';
    Array.from(form.querySelectorAll('.t-input-group')).forEach(function (group) {
      if (!group.contains(contact) && !group.contains(consent)) group.remove();
    });
    var model = ensureHidden(form, 'model');
    form.elements.source_detail.value = 'safe_deal_quick';
    var meta = form.querySelector('.ast-formmeta');
    if (meta) meta.remove();
    contact.type = 'tel';
    contact.required = true;
    contact.placeholder = '+7 999 123-45-67';
    var label = form.querySelector('label[for="' + contact.id + '"]');
    if (label) label.textContent = 'Ваш телефон';
    consent.defaultChecked = consent.checked = false;
    consent.required = true;
    send.textContent = 'Оставить заявку';
    form.setAttribute('aria-label', 'Быстрая заявка на безопасную сделку');
    form.style.setProperty('display', 'block', 'important');
    form.style.cssText += ';color:#17191c;background:#fff;max-width:480px;box-sizing:border-box;margin:16px 0;scroll-margin-top:90px';
    form.querySelector('.t-form__inputsbox').style.gridTemplateColumns = '1fr';
    var heading = document.createElement('h2');
    heading.textContent = 'Быстрая заявка';
    heading.style.cssText = 'color:#17191c;font-size:22px;line-height:1.2;margin:0 0 12px';
    form.prepend(heading);
    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.style.cssText = 'color:#222;margin:10px 0 0';
    form.appendChild(status);
    hero.appendChild(form);
    var leadCopy = document.querySelector('#lead .ast-leadbox p');
    if (leadCopy) leadCopy.textContent = 'Оставьте телефон. Менеджер уточнит модель и условия сделки при звонке.';
    var leadActions = document.querySelector('#lead .ast-leadbox .ast-actions');
    if (leadActions) {
      var link = htmlToEl('<a class="ast-btn" href="#ast-safe-deal-form">Оставить заявку</a>');
      leadActions.replaceChildren(link);
    }
    function check(event) {
      var digits = contact.value.replace(/\D/g, '');
      contact.setCustomValidity(digits.length >= 10 && digits.length <= 15 && /^\+?[\d\s()-]+$/.test(contact.value.trim()) ? '' : 'Введите номер телефона с кодом города или оператора.');
      var valid = form.reportValidity();
      if (!valid || !window.tildaForm || !window.initForms || !window.initForms[form.closest('.t-rec').id]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (valid) status.textContent = 'Не удалось подключить форму. Повторите отправку или позвоните в АСТ: ' + CONFIG.phoneDisplay;
        return;
      }
      contact.setCustomValidity('');
      status.textContent = '';
      fillFormSources();
      var yclid = new URLSearchParams(location.search).get('yclid');
      if (yclid) ensureHidden(form, 'yclid').value = yclid;
    }
    contact.addEventListener('input', function () { contact.setCustomValidity(''); });
    send.addEventListener('click', check, true);
    form.addEventListener('submit', check, true);
    var lastReceipt = '';
    form.addEventListener('tildaform:aftersuccess', function () {
      var receipt = String(form.tildaTranId || form.tildaOrderId || '');
      if (receipt && receipt === lastReceipt) return;
      if (status.dataset.accepted === '1' && !receipt) return;
      lastReceipt = receipt;
      status.dataset.accepted = '1';
      status.textContent = 'Спасибо! АСТ приняла заявку на обратный звонок.';
      track('ast_form_submit_success', {form: 'safe_deal_quick', delivered: 'tilda'});
    });
    // Some page-level scripts add their own quiz buttons after DOMContentLoaded.
    // Intercept only lead actions on this page, including the mobile request link.
    window.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('a,button');
      if (!el || form.contains(el) || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      var isLead = el.matches('[data-order-model],[data-ast-quiz-open],[data-ast-hero-calc],[data-ast-prot-calc],a[href="#ast-safe-deal-form"],a[href="#lead"]') ||
        ((el.closest('.ast-actions,.ast-menu,.ast-sticky-cta,.ast-nav,header') || (el.tagName === 'A' && el.origin === location.origin && el.pathname === '/contacts')) &&
          /^(Рассчитать стоимость|Оставить заявку|Заявка|Перейти к заявке|Проверить условия аккредитива)$/.test(el.textContent.trim()));
      if (!isLead || /^(https?:\/\/t\.me\/|tg:|tel:|mailto:)/i.test(el.getAttribute('href') || '')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      model.value = el.getAttribute('data-order-model') || '';
      form.scrollIntoView({block:'center'});
      contact.focus({preventScroll:true});
    }, true);
    return true;
  }

  function enhanceSafeDeal() {
    if (window.__astUniversalQuote) return;
    var msg = 'Здравствуйте! Интересует безопасная сделка, хочу обсудить условия';
    var hero = document.querySelector('.ast-safe-hero .ast-actions, .ast-hero .ast-actions');
    if (hero && !hero.querySelector('[data-ast-safe-tg]')) {
      var btn = htmlToEl(tgBtnHtml('Обсудить мою сделку в Telegram', msg));
      btn.setAttribute('data-ast-safe-tg', '1');
      hero.insertBefore(btn, hero.firstChild);
    }
    var payment = document.getElementById('payment');
    if (payment && !document.querySelector('[data-ast-cta-row="safe-deal"]')) {
      var row = htmlToEl(ctaRowHtml(tgBtnHtml('Обсудить мою сделку в Telegram', msg)));
      row.setAttribute('data-ast-cta-row', 'safe-deal');
      payment.parentNode.insertBefore(row, payment.nextSibling);
    }
    var lead = document.getElementById('lead');
    if (lead && !lead.querySelector('[data-ast-quiz-open]')) {
      var inner = lead.querySelector('.ast-inner') || lead;
      inner.appendChild(htmlToEl(ctaRowHtml(quizBtnHtml('Рассчитать стоимость', 'ast-btn--dark'))));
    }
  }

  // C3. /offers и /catalog: действие на каждой карточке + строка подбора.
  function offerEntryForLink(href) {
    href = String(href || '');
    var keys = Object.keys(OFFER_MAP);
    for (var i = 0; i < keys.length; i += 1) {
      if (keys[i] !== '/' && href.indexOf(keys[i]) > -1) {
        return { path: keys[i], entry: OFFER_MAP[keys[i]] };
      }
    }
    return null;
  }

  function enhanceShowcase() {
    var cards = document.querySelectorAll('.ast-card, .ast-offer-card, [data-ast-offer-card]');
    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.astCardCta === '1') return;
      var actions = card.querySelector('.ast-card__actions, .ast-offer-card__actions');
      if (!actions) return;
      card.dataset.astCardCta = '1';
      var link = card.querySelector('a[href]');
      var match = offerEntryForLink(link && link.getAttribute('href'));
      var btn = htmlToEl(quizBtnHtml('Рассчитать под ключ', 'ast-btn--dark'));
      if (match) {
        btn.setAttribute('data-offer', match.entry.offer || match.path.replace(/^\//, ''));
        if (match.entry.model) btn.setAttribute('data-ast-quiz-model-preset', match.entry.model);
      }
      actions.appendChild(btn);
    });

    if (!document.querySelector('[data-ast-cta-row="showcase"]')) {
      var firstCard = document.querySelector('.ast-card, .ast-offer-card');
      var section = (firstCard && firstCard.closest('section')) ||
        document.querySelector('#offersListView, .ast-offers-terms, .ast-section');
      if (section) {
        var html = '<p class="ast-cta-row__lead">Не нашли нужную комплектацию? ' +
          'Напишите — подберём за 24 часа.</p>' +
          tgBtnHtml('Написать в Telegram',
            'Здравствуйте! Не нашёл нужную комплектацию, помогите подобрать', 'ast-btn--dark') +
          quizBtnHtml('Рассчитать стоимость под ключ', 'ast-btn--ghost');
        var below = htmlToEl(ctaRowHtml(html));
        below.setAttribute('data-ast-cta-row', 'showcase');
        section.parentNode.insertBefore(below, section.nextSibling);
      }
    }
  }

  // C4. Модельные страницы: primary «Рассчитать под мою комплектацию»,
  // блоки «Как считается цена» и «Безопасная сделка», повтор primary в конце.
  function enhanceModelPage() {
    var model = pageModel();
    var root = document.querySelector('main') || document.body;
    root.setAttribute('data-offer', pageOffer());

    var hero = document.querySelector(
      '.ast-hero .ast-actions, .ast-model-hero .ast-actions, .ast-zeekr-hero__actions, ' +
      '.ast-zeekr-hero .ast-actions, .ast-luxury-hero .ast-actions, ' +
      '.ast-model-lead-section .ast-actions, .ast-model-contact-actions');
    if (hero && !hero.querySelector('[data-ast-quiz-open]')) {
      hero.insertBefore(htmlToEl(quizBtnHtml('Рассчитать под мою комплектацию')), hero.firstChild);
      if (!hero.querySelector('a[href*="t.me"]')) {
        hero.appendChild(htmlToEl(tgBtnHtml('Написать в Telegram',
          'Здравствуйте! Интересует ' + model + ' под заказ', 'ast-btn--ghost')));
      }
    }

    if (!document.querySelector('[data-ast-model-blocks]')) {
      var anchor = document.querySelector('footer, .ast-footer');
      var wrap = htmlToEl(
        '<section class="ast-section ast-model-extra" data-ast-model-blocks>' +
          '<div class="ast-inner">' +
            '<div class="ast-model-extra__grid">' +
              '<article class="ast-model-extra__card">' +
                '<h3>Как считается цена</h3>' +
                '<ol class="ast-model-extra__steps">' +
                  '<li><b>Закупка и проверка</b> — автомобиль, продавец и документы проверяются до оплаты.</li>' +
                  '<li><b>Логистика и таможня</b> — доставка и оформление до СВХ, все платежи прозрачны.</li>' +
                  '<li><b>Под ключ</b> — полная стоимость с документами, без скрытых доплат.</li>' +
                '</ol>' +
                '<p class="ast-model-extra__note">Предварительный расчёт по вашей комплектации — за 24 часа.</p>' +
              '</article>' +
              '<article class="ast-model-extra__card">' +
                '<h3>Безопасная сделка</h3>' +
                '<ol class="ast-model-extra__steps">' +
                  '<li>Договор и фиксация условий до оплаты.</li>' +
                  '<li>Оплата поэтапно — под документы, а не под обещания.</li>' +
                  '<li>Расчёт через аккредитив: деньги раскрываются после проверки.</li>' +
                '</ol>' +
                '<p class="ast-model-extra__note"><a href="/bezopasnaya-sdelka">Как проходит безопасная сделка — поэтапная оплата под документы</a></p>' +
              '</article>' +
            '</div>' +
            '<div class="ast-cta-row" data-ast-cta-row="model">' +
              quizBtnHtml('Рассчитать под мою комплектацию', 'ast-btn--dark') +
              '<p class="ast-cta-row__hint">' + CONFIG.ctaHint + '</p>' +
            '</div>' +
          '</div>' +
        '</section>');
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor);
      else root.appendChild(wrap);
    }
  }

  // C5. Лизинговые страницы: primary «Получить расчёт для юрлица» (квиз с
  // предустановленным юрлицом), блок «Что получает юрлицо».
  function enhanceLeasing() {
    var hero = document.querySelector('.ast-hero .ast-actions');
    if (hero && !hero.querySelector('[data-ast-quiz-open]')) {
      hero.insertBefore(htmlToEl(quizBtnHtml('Получить расчёт для юрлица')), hero.firstChild);
      if (!hero.querySelector('a[href*="t.me"]')) {
        hero.appendChild(htmlToEl(tgBtnHtml('Написать в Telegram',
          'Здравствуйте! Интересует лизинг / поставка на юрлицо', 'ast-btn--ghost')));
      }
    }
    if (!document.querySelector('[data-ast-b2b-block]')) {
      var heroSection = document.querySelector('.ast-hero') ||
        document.querySelector('section');
      if (heroSection && heroSection.parentNode) {
        var block = htmlToEl(
          '<section class="ast-section ast-model-extra" data-ast-b2b-block>' +
            '<div class="ast-inner">' +
              '<article class="ast-model-extra__card">' +
                '<h3>Что получает юрлицо</h3>' +
                '<ul class="ast-model-extra__steps">' +
                  '<li>НДС к вычету и полный пакет документов для бухгалтерии.</li>' +
                  '<li>ЭПТС и ЭРА-ГЛОНАСС — автомобиль готов к постановке на учёт.</li>' +
                  '<li>Поставка до СВХ или под ключ — по задаче компании.</li>' +
                  '<li>Договор с ООО «АСТ», оплата в рублях.</li>' +
                '</ul>' +
              '</article>' +
              '<div class="ast-cta-row" data-ast-cta-row="b2b">' +
                quizBtnHtml('Получить расчёт для юрлица', 'ast-btn--dark') +
                '<p class="ast-cta-row__hint">' + CONFIG.ctaHint + '</p>' +
              '</div>' +
            '</div>' +
          '</section>');
        heroSection.parentNode.insertBefore(block, heroSection.nextSibling);
      }
    }
  }

  function simplifyAudiQuoteForm() {
    var form = document.getElementById('a5l-form-bottom');
    if (!form || form.dataset.quoteCopy === '1') return;
    var role = form.querySelector('select[name="a5l_role"]');
    var button = form.querySelector('[type="submit"]');
    if (!role || !button) return;
    form.dataset.quoteCopy = '1';
    var field = role.closest('label');
    if (field) { field.hidden = true; field.style.display = 'none'; }
    role.required = false;
    role.replaceChildren(new Option('Узнать цену', 'partner', true, true));
    role.value = 'partner';
    var title = document.getElementById('lead-title');
    if (title) title.textContent = 'Узнать цену';
    var grid = form.querySelector('.oem-form-grid');
    if (grid) grid.style.gridTemplateColumns = '1fr';
    function label() {
      if (button.textContent !== 'Отправить заявку') button.textContent = 'Отправить заявку';
    }
    function intent() {
      role.value = 'partner';
      form.elements.cta.value = 'get_quote';
      form.elements.scenario.value = 'a5l_quote';
      form.elements.comment.value = 'Запрос коммерческого предложения на Audi A5L.';
      label();
    }
    intent();
    // Existing role/reset handlers may update the button after this setup.
    new MutationObserver(label).observe(button, {childList:true,subtree:true,characterData:true});
    window.addEventListener('submit', function (event) {
      if (event.target === form) intent();
    }, true);
    form.addEventListener('reset', function () { setTimeout(intent, 0); });
  }

  // Shared phone-only quote form. Native receiver bindings are copied from
  // the Audi A5L Tilda twin whose delivery the owner confirmed.
  function installUniversalQuoteForm() {
    if (window.__astUniversalQuote) { window.__astUniversalQuote.mount(); return; }
    var bindings = ['7276e623a45a50dd178179e21426028e','c72bf547c9097a2f8ebc4c382f5942ac','f0b3ef2e0259fbb3e9a3d8b69e12c83d','94faeba672cf847b6b5818c51163a1bd','210e33c45a404507cadd487eaf0595a8'];
    var record, nativeForm, modal, lastFocus, active = null, loading = null, serial = 0;
    var lastAccepted = null;
    var priceLabel = 'Узнать цену';
    var sourceKeys = ['model','offer_id','quoteId','trim','exterior_color','interior_color','brand','generation','market','a5l_role','ev_calculation'];
    var marketing = 'form[data-oem-ast-form],form[data-ast-lead-form],form[data-ast-model-lead-form],form.ast-launch-form,form[data-ast-static-mini-form],form#tavendor-form,form.ast-oem-form,form.rrc-form,form.ast-pg-price-form,form#x7-request,form.qf#qf,form#lead,form.t-form,form[data-ast-ev-final-form]';
    if (path() === '/porsche-cayenne-import') marketing += ',form[data-lead-form]';
    function field(form, name, value) {
      var el = form.querySelector('[name="' + name + '"]');
      if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); }
      el.value = String(value == null ? '' : value);
    }
    function context(source, trigger) {
      var result = {};
      sourceKeys.forEach(function (key) { var el = source && source.querySelector('[name="' + key + '"]'); if (el && el.value) result[key] = el.value; });
      if (trigger) {
        var card = trigger.closest('[data-offer-id],[data-ast-offer-card],.ast-related-offer');
        result.model = trigger.getAttribute('data-order-model') || trigger.getAttribute('data-ast-set-model') || trigger.getAttribute('data-ast-quiz-model-preset') || result.model;
        result.offer_id = trigger.getAttribute('data-ast-offer-id') || trigger.getAttribute('data-offer-id') || (card && card.getAttribute('data-offer-id')) || result.offer_id;
        if (card && !result.model) { var title = card.querySelector('h2,h3'); if (title) result.model = title.textContent.trim(); }
      }
      // ZEEKR's React configurator keeps its selections in the rendered inquiry
      // and swatches, not in input fields. Read the active UI without changing it.
      if (path() === '/zeekr-8x' && document.querySelector('#ast-oem-root[data-ast-oem-model="zeekr-8x"]')) {
        var inquiry = source && source.closest('.ast-inquiry');
        var description = inquiry && inquiry.querySelector('.ast-inquiry-model');
        var chosen = inquiry && inquiry.querySelector('.ast-chosen-colors');
        var colors = chosen && chosen.textContent.trim().split(/\s*·\s*/);
        var desc = description ? description.textContent.replace(chosen ? chosen.textContent : '', '').trim() : '';
        var trim = desc.replace(/^ZEEKR\s+8X\s*/i, '').trim();
        var article = trigger && trigger.closest('article');
        if (!trim && article) { var heading = article.querySelector('h2,h3'); trim = heading ? heading.textContent.trim() : ''; }
        if (!trim) trim = new URLSearchParams(location.search).get('trim') || '';
        var outside = document.querySelector('[role="tablist"][aria-label="Цвет кузова"] [role="tab"][aria-selected="true"]');
        var inside = document.querySelector('[role="tablist"][aria-label="Цвет салона"] [role="tab"][aria-selected="true"]');
        result.model = 'ZEEKR 8X';
        result.market = 'Китай';
        if (/^(Max|Ultra\+|Ultra|Shadow)$/i.test(trim)) result.trim = trim;
        if (outside) result.exterior_color = outside.getAttribute('aria-label') || outside.textContent.trim();
        else if (colors && colors[0]) result.exterior_color = colors[0];
        if (inside) result.interior_color = inside.getAttribute('aria-label') || inside.textContent.trim();
        else if (colors && colors[1]) result.interior_color = colors[1];
      }
      if (path() === '/zeekr-9x') { result.model = 'ZEEKR 9X'; }
      if (path() === '/nissan-qashqai-china') {
        result.model = 'Nissan Qashqai'; result.brand = 'Nissan'; result.generation = 'III'; result.market = 'Китай';
      }
      if (path() === '/volkswagen-tiguan-l-pro') {
        result.model = 'Volkswagen Tiguan L Pro'; result.brand = 'Volkswagen'; result.market = 'Китай';
        var trimCode = trigger && trigger.getAttribute('data-trim');
        var trimLabel = trigger && trigger.getAttribute('data-trim-label');
        if (trimCode) result.trim = trimLabel ? trimLabel + ' (' + trimCode + ')' : trimCode;
      }
      if (path() === '/ev' && source && source.matches('form[data-ast-ev-lead-form]')) {
        var evValue = function (name) { var input = source.querySelector('[name="' + name + '"]'); return input ? input.value : ''; };
        result.ev_calculation = JSON.stringify({
          target_model:evValue('target_model'),km_year:evValue('km_year'),
          ice_consumption_l100:evValue('ice_consumption_l100'),fuel_price_rub_l:evValue('fuel_price_rub_l'),
          electricity_rub_kwh:evValue('electricity_rub_kwh'),ev_saving_rub_year:evValue('ev_saving_rub_year'),
          util_track:evValue('util_track'),util_fee_rub:evValue('util_fee_rub')
        });
      }
      if (!result.model) result.model = pageModel() || '';
      result.page_url = location.href.split('#')[0]; result.page = path(); result.offer = result.offer_id || (path() === '/' ? 'generic' : pageOffer());
      return result;
    }
    function quoteTestMode() {
      return new URLSearchParams(location.search).get('utm_source') === 'ast_test' || sessionGet('ast_utm_source') === 'ast_test';
    }
    function quoteRequestId(form) {
      if (!form.dataset.requestId) form.dataset.requestId = 'quote_' + Date.now() + '_' + Math.random().toString(36).slice(2,10);
      return form.dataset.requestId;
    }
    function quoteMeta(form, extra) {
      var out = {form:'standard_quote',form_id:form.id,request_id:quoteRequestId(form),page:path(),page_path:path(),is_test:quoteTestMode() ? 1 : 0};
      ['model','offer','a5l_role'].forEach(function (key) { var input = form.elements[key]; if (input && input.value) out[key] = input.value; });
      SOURCE_KEYS.forEach(function (key) { var value = new URLSearchParams(location.search).get(key) || sessionGet('ast_' + key); if (value) out[key] = value; });
      return Object.assign(out,extra || {});
    }
    function quoteTrack(goal, form, extra) {
      var info = quoteMeta(form,extra);
      var key = info.request_id + ':' + goal + ':' + (info.attempt || 0);
      form.__astQuoteEvents = form.__astQuoteEvents || {};
      if (form.__astQuoteEvents[key]) return;
      form.__astQuoteEvents[key] = true;
      form.dataset.astQuoteLastEvent = goal;
      form.dataset.astQuoteEventCount = String(Object.keys(form.__astQuoteEvents).length);
      if (goal === 'ast_form_submit_success') form.dataset.astAcceptedRequestId = info.request_id;
      track(quoteTestMode() ? goal.replace(/^ast_/, 'ast_test_') : goal,info);
    }
    function quoteStart(form) {
      if (!form.elements.phone.value.trim()) return;
      quoteTrack('ast_form_start',form,{position:positionOf(form),channel:'form'});
    }
    function makeForm(info) {
      var form = document.createElement('form');
      form.className = 'ast-quote-form'; form.setAttribute('data-ast-standard-form', '1');
      form.id = 'ast-quote-form-' + (serial + 1); form.dataset.attempt = '0';
      form.setAttribute('aria-label', priceLabel);
      var id = 'ast-quote-phone-' + (++serial);
      form.innerHTML = '<label class="ast-quote-field" for="' + id + '">Ваш телефон</label><input id="' + id + '" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 999 123-45-67" required>' +
        '<label class="ast-quote-consent"><input type="checkbox" name="consent" required><span>Согласен на обработку данных по <a href="/privacy" target="_blank" rel="noopener">политике конфиденциальности</a>.</span></label>' +
        '<button type="submit">Отправить заявку</button><p class="ast-quote-status" role="status" aria-live="polite"></p>';
      sourceKeys.concat(['page_url','page','offer']).forEach(function (key) { field(form,key,info[key] || ''); });
      return form;
    }
    function setStatus(form, text, retry) {
      var status = form.querySelector('.ast-quote-status'); status.textContent = text;
      if (retry) { var a = document.createElement('a'); a.href = 'tel:' + CONFIG.phone; a.textContent = 'Позвонить в АСТ'; status.appendChild(document.createTextNode(' ')); status.appendChild(a); }
    }
    function show(trigger, source) {
      lastFocus = trigger;
      var old = modal.querySelector('form'), info = context(source,trigger);
      if (active && active.form === old) { modal.showModal(); old.elements.phone.focus(); return; }
      var form = makeForm(info); old.replaceWith(form);
      if (source && source.matches('form[data-ast-ev-lead-form]')) form.__astQuoteSource = source;
      modal.showModal(); quoteTrack('ast_form_open',form,{position:positionOf(trigger || form),channel:'form'}); form.elements.phone.focus();
    }
    // Tilda pages and the shared header add lead buttons at different times.
    // Remember text-only openers after relabelling, so their click path stays the same.
    function isQuoteOpener(el) {
      if (path() === '/ev' && el.matches('[data-ast-ev-unified-open]')) return true;
      if (el.closest('form,dialog')) return false;
      if (el.tagName === 'A' && el.hasAttribute('href') && el.origin !== location.origin) return false;
      var href = el.getAttribute('href') || '';
      if (path() === '/nissan-qashqai-china' && el.matches('button[data-open]') && el.textContent.trim() === 'Рассчитать стоимость под ключ') return true;
      if (path() === '/volkswagen-tiguan-l-pro' && el.matches('a[data-lead-open][href="#ast-request"]')) return true;
      return el.matches('[data-ast-quote-open],[data-ast-quiz-open],[data-order-model],[data-ast-set-model],[data-ast-offer-action="order"],[data-ast-hero-calc],[data-ast-prot-calc],[data-a5l-jump],[data-a5l-choose]') ||
        /^#(?:lead|ast-safe-deal-form|order|request)(?:$|-)/.test(href) ||
        /^(Получить КП|Получить коммерческое предложение|Оставить заявку|Заявка|Перейти к заявке|Рассчитать стоимость|Рассчитать под ключ|Получить расчёт|Обсудить автомобиль)$/.test(el.textContent.trim());
    }
    function linksToInlineQuote(el) {
      var href = el.getAttribute('href') || '';
      if (href.charAt(0) !== '#' || !/^(?:Получить|Запросить|Рассчитать|Узнать|Оставить|Открыть форму заявки|К форме заявки|Заказать$)/i.test(el.textContent.trim())) return false;
      var target = document.getElementById(href.slice(1));
      return !!(target && (target.matches('[data-ast-quote-replaced]') || target.querySelector('[data-ast-standard-form]')));
    }
    function labelOpener(el) {
      var opensDialog = isQuoteOpener(el);
      if (!opensDialog && !linksToInlineQuote(el)) return;
      if (opensDialog && !el.hasAttribute('data-ast-quote-open')) el.setAttribute('data-ast-quote-open', '');
      var model = el.getAttribute('data-order-model') || el.getAttribute('data-ast-set-model');
      var accessibleLabel = model ? priceLabel + ' — ' + model : priceLabel;
      if (el.hasAttribute('aria-label') && el.getAttribute('aria-label') !== accessibleLabel) el.setAttribute('aria-label', accessibleLabel);
      if (el.hasAttribute('title') && el.title !== priceLabel) el.title = priceLabel;
      // Keep icons, styled spans, and the contents of linked vehicle cards.
      if (el.querySelector('picture,img,h2,h3,h4,small')) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var node, label;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim() || node.parentElement.closest('svg,style,script,[aria-hidden="true"]')) continue;
        if (label) return;
        label = node;
      }
      if (label && label.textContent !== priceLabel) label.textContent = priceLabel;
    }
    function mountZeekrInquiry() {
      if (path() !== '/zeekr-8x') return;
      document.querySelectorAll('#ast-oem-root[data-ast-oem-model="zeekr-8x"] #ast-model-inquiry, #ast-oem-root[data-ast-oem-model="zeekr-8x"] [role="dialog"].ast-inquiry').forEach(function (inquiry) {
        if (inquiry.querySelector(':scope > .ast-unified-entry')) return;
        var wrapper = document.createElement('div');
        wrapper.className = 'ast-unified-entry';
        var form = makeForm(context(inquiry));
        form.__astQuoteSource = inquiry;
        wrapper.appendChild(form);
        inquiry.setAttribute('data-ast-unified-inquiry', '1');
        inquiry.appendChild(wrapper);
        if (inquiry.getAttribute('role') === 'dialog') form.elements.phone.focus({preventScroll:true});
      });
    }
    function mountEvCalculator() {
      if (path() !== '/ev') return;
      document.querySelectorAll('form[data-ast-ev-lead-form]').forEach(function (calculator) {
        var contact = calculator.querySelector('[name="contact"]');
        var button = calculator.querySelector('button[type="submit"],button[data-ast-ev-unified-open]');
        if (!contact || !button) return;
        var label = contact.closest('label');
        if (label) { label.hidden = true; label.style.setProperty('display','none','important'); }
        contact.required = false;
        button.type = 'button';
        button.setAttribute('data-ast-ev-unified-open','1');
      });
    }
    function mount() {
      // Keep the agent programme's navigation and copy intact while replacing
      // its mail-client form with the same phone-and-consent enquiry.
      if (/^\/referal\/?$/.test(location.pathname)) {
        document.querySelectorAll('form').forEach(function (source) {
          if (source.dataset.astQuoteReplaced || source.matches('[data-ast-standard-form]') ||
              !source.querySelector('[name="contact"]') || !source.querySelector('[name="scenario"]') ||
              !source.querySelector('[name="source"]') || !source.querySelector('[name="comment"]')) return;
          if (source.hidden || getComputedStyle(source).display === 'none') return;
          var form = makeForm(context(source));
          form.__astQuoteSource = source;
          source.dataset.astReferralInquiry = '1'; source.dataset.astQuoteReplaced = '1';
          source.hidden = true; source.style.setProperty('display','none','important');
          source.insertAdjacentElement('afterend',form);
        });
        return;
      }
      // Native receiver forms remain in place; do not replace payment, account, or carrier-registration forms.
      document.querySelectorAll(marketing).forEach(function (source) {
        if (source.dataset.astQuoteReplaced || source.matches('[data-ast-standard-form]') || source.closest('#ast-quote-native-record') || (source.closest('.ast-ev-panel') && !source.matches('form[data-ast-ev-final-form]'))) return;
        if (!source.querySelector('[name="Phone"],[name="phone"],[name="contact"]')) return;
        if (source.hidden || source.getAttribute('aria-hidden') === 'true' || getComputedStyle(source).display === 'none') return;
        if (source.querySelector('input[type="file"],input[type="password"],[name="referral_code"],[name="agent_id"],[name="inn"],[name="truck_count"]')) return;
        var form = makeForm(context(source));
        form.__astQuoteSource = source;
        source.dataset.astQuoteReplaced = '1'; source.hidden = true; source.style.setProperty('display','none','important');
        source.insertAdjacentElement('afterend',form);
      });
      mountZeekrInquiry();
      mountEvCalculator();
      document.querySelectorAll('a,button').forEach(labelOpener);
      document.querySelectorAll('#lead,#gr-order').forEach(function (section) {
        var heading = section.querySelector('#lead-title,h2');
        if (heading && (section.id === 'gr-order' || section.querySelector('[data-ast-standard-form]')) && heading.textContent !== priceLabel) {
          heading.textContent = priceLabel;
        }
      });
    }
    function buildNative() {
      if (nativeForm) return;
      record = document.createElement('div'); record.id = 'ast-quote-native-record'; record.className = 'r t-rec'; record.dataset.recordType = '123';
      // Keep the native inputs rendered for Tilda validation; only the UI is offscreen.
      record.style.cssText = 'position:absolute;left:-10000px;top:0;width:1px;height:1px;overflow:hidden';
      record.style.setProperty('display','block','important');
      record.innerHTML = '<form id="ast-quote-native-form" class="t-form js-form-proccess" data-formactiontype="2" data-inputbox=".t-input-group" action="#" novalidate aria-hidden="true">' +
        bindings.map(function (id) { return '<input type="hidden" name="formservices[]" value="' + id + '" class="js-formaction-services">'; }).join('') +
        '<div class="js-successbox t-form__successbox" style="display:none"></div><div class="t-form__inputsbox">' +
        [['Name','nm'],['Phone','ph'],['Email','em'],['comment','ta']].map(function (spec) { return '<div class="t-input-group t-input-group_' + spec[1] + '" data-input-lid="quote_' + spec[0] + '" data-field-type="' + spec[1] + '" data-field-name="' + spec[0] + '"><div class="t-input-block">' + (spec[0] === 'comment' ? '<textarea name="comment" class="t-input t-input-ta js-tilda-rule" tabindex="-1"></textarea>' : '<input type="text" name="' + spec[0] + '" class="t-input js-tilda-rule" ' + (spec[0] === 'Phone' ? 'data-tilda-req="1" ' : '') + 'tabindex="-1">') + '</div><div class="t-input-error"></div></div>'; }).join('') +
        '</div><div class="t-form__errorbox-middle"><div class="js-errorbox-all t-form__errorbox-wrapper" style="display:none"><div class="t-form__errorbox-text"><p class="t-form__errorbox-item js-rule-error js-rule-error-all"></p><p class="t-form__errorbox-item js-rule-error js-rule-error-empty"></p><p class="t-form__errorbox-item js-rule-error js-rule-error-req"></p></div></div></div><div class="t-form__submit"><button type="submit" class="t-submit" tabindex="-1">send</button></div></form>';
      var all = document.getElementById('allrecords'); (all || document.body).appendChild(record); nativeForm = record.querySelector('form');
      nativeForm.addEventListener('tildaform:aftersuccess', function () { finish(true); });
      nativeForm.addEventListener('tildaform:aftererror', function () { finish(false); });
    }
    function ready() {
      if (loading) return loading;
      loading = new Promise(function (resolve,reject) {
        buildNative();
        if (!document.querySelector('script[src*="tilda-forms-1.0"]')) { var script = document.createElement('script'); script.src = 'https://static.tildacdn.com/js/tilda-forms-1.0.min.js'; script.async = true; document.head.appendChild(script); }
        var tries = 0, interval = setInterval(function () {
          if (typeof window.t_forms__initForms === 'function' && window.tildaForm) {
            try { window.t_forms__initForms(); if (!window.initForms || !window.initForms[record.id]) throw new Error('not_initialized'); clearInterval(interval); resolve(); } catch (e) { clearInterval(interval); loading = null; reject(e); }
          } else if (++tries >= 80) { clearInterval(interval); loading = null; reject(new Error('native_library_unavailable')); }
        },150);
      });
      return loading;
    }
    function finish(ok, reason) {
      if (!active) return;
      var request = active; clearTimeout(request.timer); if (request.observer) request.observer.disconnect(); active = null;
      var form = request.form; form.querySelector('[type="submit"]').disabled = false;
      if (!ok) { quoteTrack('ast_form_submit_error',form,{reason:reason || 'native_rejected',attempt:request.attempt}); setStatus(form,'Не удалось отправить заявку. Повторите отправку или свяжитесь с АСТ.',true); return; }
      setStatus(form,'Спасибо! Заявка принята.');
      var receipt = String(nativeForm.tildaTranId || nativeForm.tildaOrderId || '');
      var safe = {delivered:'tilda',receipt_id:receipt};
      quoteTrack('ast_form_submit_success',form,safe); quoteTrack('ast_form_submit',form,safe);
      if (!quoteTestMode()) trackContact('form',{form:'standard_quote',request_id:request.id});
      lastAccepted = {fingerprint:request.fingerprint,time:Date.now()};
      form.reset(); delete form.dataset.requestId; form.dataset.attempt = '0';
    }
    function submit(form) {
      if (active) { setStatus(form,'Предыдущая заявка ещё обрабатывается. Дождитесь подтверждения.',true); return; }
      var phone = form.elements.phone, digits = phone.value.replace(/\D/g,'');
      phone.setCustomValidity(/^\+?[\d\s()-]+$/.test(phone.value.trim()) && digits.length >= 10 && digits.length <= 15 ? '' : 'Введите номер телефона с кодом города или оператора.');
      if (!form.reportValidity()) return;
      if (form.__astQuoteSource) { var latest = context(form.__astQuoteSource); sourceKeys.forEach(function (key) { field(form,key,latest[key] || ''); }); }
      var fingerprint = [digits, path()].concat(['model','offer_id','quoteId','trim','exterior_color','interior_color','ev_calculation'].map(function (key) { return (form.elements[key] && form.elements[key].value) || ''; })).join('|');
      if (lastAccepted && lastAccepted.fingerprint === fingerprint && Date.now() - lastAccepted.time < 120000) { setStatus(form,'Заявка уже принята. Мы свяжемся с вами.'); return; }
      quoteStart(form);
      form.dataset.attempt = String(Number(form.dataset.attempt || 0) + 1);
      form.querySelector('[type="submit"]').disabled = true; setStatus(form,'Отправляем заявку…');
      var request = {form:form,id:quoteRequestId(form),attempt:Number(form.dataset.attempt),fingerprint:fingerprint,timer:null,observer:null};
      quoteTrack('ast_form_submit_attempt',form,{attempt:request.attempt});
      form.dataset.requestId = request.id; active = request;
      ready().then(function () {
        if (active !== request) return;
        if (form.__astQuoteSource) { var latest = context(form.__astQuoteSource); sourceKeys.forEach(function (key) { field(form,key,latest[key] || ''); }); }
        var values = {Name:quoteTestMode() ? 'TEST AST — не звонить' : 'Заявка с сайта',Phone:phone.value.trim(),Email:'',comment:(quoteTestMode() ? 'TEST AST — проверка формы, не звонить. ' : '') + 'Заявка с сайта. Страница: ' + location.href.split('#')[0],request_id:request.id,created_at:new Date().toISOString(),channel:'site_form',source:'avtonds_site',site_source:'avtonds.ru',source_detail:'standard_quote',consent:'yes',consent_version:pageConsentVersion() || 'privacy-2026-05-12',policy_url:location.origin + '/privacy',scenario:'get_quote',cta:'get_quote',via:'ast_confirmed_tilda_quote',is_test:quoteTestMode() ? 'yes' : 'no'};
        sourceKeys.concat(['page_url','page','offer']).forEach(function (key) { values[key] = form.elements[key] ? form.elements[key].value : ''; });
        SOURCE_KEYS.forEach(function (key) { values[key] = new URLSearchParams(location.search).get(key) || sessionGet('ast_' + key) || ''; });
        values.ym_client_id = sessionGet('ast_ym_client_id') || '';
        Object.keys(values).forEach(function (key) { field(nativeForm,key,values[key]); });
        nativeForm.querySelectorAll('.js-errorbox-all,.js-successbox').forEach(function (el) { el.style.display = 'none'; });
        request.observer = new MutationObserver(function () { var error = nativeForm.querySelector('.js-errorbox-all'); if (active === request && error && getComputedStyle(error).display !== 'none' && error.textContent.trim()) finish(false); });
        request.observer.observe(nativeForm,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
        request.timer = setTimeout(function () {
          if (active !== request) return;
          // Keep the channel occupied until native acknowledgement/error arrives.
          // A late response must never be attributed to a second submission.
          request.timedOut = true;
          quoteTrack('ast_form_submit_pending',form,{reason:'ack_timeout',attempt:request.attempt});
          setStatus(form,'Подтверждение задерживается. Заявка может ещё обрабатываться. Свяжитесь с АСТ.',true);
        },45000);
        nativeForm.querySelector('[type="submit"]').click();
      }).catch(function () { if (active === request) finish(false,'native_unavailable'); });
    }
    var style = document.createElement('style'); style.textContent = '.ast-quote-form{box-sizing:border-box;width:100%;max-width:520px;padding:24px;border:1px solid #4b4e52;border-radius:18px;background:#24272b;color:#fff;text-align:left;font:16px/1.45 Arial,sans-serif}.ast-quote-form .ast-quote-field{display:block;color:#d3d5d7;font-size:14px;margin:0 0 7px}.ast-quote-form input[type=tel]{box-sizing:border-box;width:100%;min-height:48px;padding:12px;border:1px solid #73767a;border-radius:8px;background:#36393d;color:#fff;font:16px Arial,sans-serif}.ast-quote-form .ast-quote-consent{display:flex;gap:9px;align-items:flex-start;margin:18px 0;color:#d3d5d7;font-size:13px}.ast-quote-form .ast-quote-consent input{width:18px;height:18px;margin:2px 0;flex-shrink:0}.ast-quote-form a{color:inherit;text-decoration:underline}.ast-quote-form button{border:0;border-radius:28px;padding:14px 23px;background:#e0001b;color:white;font:bold 17px Arial,sans-serif;cursor:pointer;min-height:48px}.ast-quote-form button:disabled{opacity:.6;cursor:wait}.ast-quote-status{margin:12px 0 0;font-size:14px}.ast-quote-status:empty{display:none}.ast-quote-dialog{max-width:540px;width:calc(100% - 32px);padding:18px;border:1px solid #555;border-radius:20px;background:#24272b;color:white;box-sizing:border-box}.ast-quote-dialog::backdrop{background:#000a}.ast-quote-dialog h2{font:700 26px/1.2 Arial,sans-serif;margin:10px 34px 18px 6px;color:white}.ast-quote-dialog .ast-quote-close{position:absolute;right:12px;top:10px;border:0;background:none;color:white;font-size:28px;cursor:pointer}.ast-quote-dialog .ast-quote-form{padding:8px;border:0}#ast-oem-root [data-ast-unified-inquiry] > :not(.ast-inquiry-close):not(.ast-inquiry-title):not(.ast-inquiry-model):not(.ast-unified-entry){display:none!important}#ast-oem-root [data-ast-unified-inquiry] > .ast-unified-entry{display:block!important}#oem-audi-a5l .a5l-actions [data-a5l-choose][data-ast-quote-open] + [data-a5l-choose][data-ast-quote-open]{display:none}'; document.head.appendChild(style);
    modal = document.createElement('dialog'); modal.id = 'ast-quote-dialog'; modal.className = 'ast-quote-dialog'; modal.setAttribute('aria-labelledby','ast-quote-dialog-title'); modal.innerHTML = '<button type="button" class="ast-quote-close" aria-label="Закрыть">×</button><h2 id="ast-quote-dialog-title">' + priceLabel + '</h2>'; modal.appendChild(makeForm(context())); document.body.appendChild(modal);
    modal.querySelector('.ast-quote-close').addEventListener('click',function () { modal.close(); });
    modal.addEventListener('close',function () { if (lastFocus && lastFocus.isConnected) lastFocus.focus({preventScroll:true}); });
    window.addEventListener('submit',function (event) {
      var form = event.target;
      if (path() === '/ev' && form.matches && form.matches('form[data-ast-ev-lead-form]')) {
        event.preventDefault(); event.stopImmediatePropagation(); show(form.querySelector('[data-ast-ev-unified-open]'),form); return;
      }
      if (!form.matches || !form.matches('[data-ast-standard-form]')) return;
      event.preventDefault(); event.stopImmediatePropagation(); submit(form);
    },true);
    window.addEventListener('focusin',function (event) { if (event.target.matches('.ast-quote-form input[type="tel"]')) quoteTrack('ast_form_open',event.target.form,{position:positionOf(event.target),channel:'form'}); },true);
    window.addEventListener('input',function (event) { if (event.target.matches('.ast-quote-form input[type="tel"]')) { event.target.setCustomValidity(''); quoteStart(event.target.form); } },true);
    window.addEventListener('click',function (event) {
      if (event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var trigger = event.target.closest && event.target.closest('a,button');
      if (!trigger || /^\/referal\/?$/.test(location.pathname)) return;
      if (!isQuoteOpener(trigger)) {
        // Some configurators link to the original form's ID and set a trim in their own click handlers.
        var href = trigger.getAttribute('href') || '';
        var original = href.charAt(0) === '#' && document.getElementById(href.slice(1));
        var inline = original && original.hasAttribute('data-ast-quote-replaced') && original.nextElementSibling;
        if (inline && inline.matches('[data-ast-standard-form]')) {
          event.preventDefault();
          requestAnimationFrame(function () { inline.scrollIntoView({block:'center'}); quoteTrack('ast_form_open',inline,{position:positionOf(trigger),channel:'form'}); inline.elements.phone.focus({preventScroll:true}); });
        }
        return;
      }
      event.preventDefault(); event.stopImmediatePropagation();
      var source = trigger.closest('form[data-ast-ev-lead-form]') || trigger.closest('section,article');
      if (source && source.tagName !== 'FORM') source = source.querySelector('form:not([data-ast-standard-form])');
      show(trigger,source);
      quoteTrack('ast_cta_click',modal.querySelector('form'),{position:positionOf(trigger),channel:'form'});
    },true);
    var scheduled = false;
    new MutationObserver(function () { if (!scheduled) { scheduled = true; setTimeout(function () { scheduled = false; mount(); },100); } }).observe(document.body,{childList:true,subtree:true});
    window.__astUniversalQuote = {mount:mount,open:function (options) { show(document.activeElement,null); var f = modal.querySelector('form'); if (options.model) field(f,'model',options.model); if (options.offerId) field(f,'offer_id',options.offerId); }}; mount();
  }

  function enhancePages() {
    var p = path();

    var entry = OFFER_MAP[p] || {};
    try {
      if (p === '/') enhanceHome();
      else if (p === '/bezopasnaya-sdelka' || p === '/bezopasnaya-pokupka-avto') enhanceSafeDeal();
      else if (p === '/offers' || p === '/catalog') enhanceShowcase();
      else if (entry.offer === 'leasing') enhanceLeasing();
      else if (entry.model) enhanceModelPage();
    } catch (e) {}
  }

  // ------------------------------------------------------------------ запуск

  persistUtm();
  sendVisitParams();
  bindFormStart();
  bridgeDataLayer();
  watchTildaSuccess();
  fetchClientId();

  onReady(function () {
    installUniversalQuoteForm();
    normalizeLegacyPhone();
    enhancePages();
    watchOfferPrices();
    decorateMessengerLinks();
    fillFormSources();
    buildSticky();
    buildArticleCta();
  });
  // Контент Tilda дорисовывается асинхронно — повторяем прогон, как принято на сайте.
  [1500, 4000, 8000].forEach(function (delay) {
    setTimeout(function () {
      normalizeLegacyPhone();
      enhancePages();
      enhanceOfferPrices();
      decorateMessengerLinks();
      fillFormSources();
      buildArticleCta();
    }, delay);
  });

  window.ASTConversion = {
    config: CONFIG,
    track: track,
    sourceParams: sourceParams,
    consentVersion: pageConsentVersion,
    openQuiz: openQuiz,
    telegramLink: telegramLink,
    whatsappLink: whatsappLink
  };
})();

/* AutoNDS compact buyer prices, 2026-10-12. */
(function () {
  'use strict';
  var paths=["/bmw-x5-import","/gle-oem","/porsche-cayenne-import","/lx-oem","/zeekr-8x","/x6-oem","/bmw-x7","/gls-oem","/s-class-oem","/g63-oem","/911-oem","/porsche-911-dakar","/panamera-oem","/land-cruiser-300-oem","/range-rover-original","/li-auto-l9-oem","/li-auto-l6-oem","/zeekr-9x","/voyah-taishan","/mazda-cx-5","/toyota-bz3x","/toyota-rav4-oem","/toyota-highlander-china","/audi-q5l","/bmw-x3-oem","/volkswagen-tiguan-l-pro","/gx-oem","/prado-250-oem","/dbx707-oem","/bentley-bentayga","/bentley-torcal","/continental-gt-oem","/purosangue-oem","/urus-oem","/rolls-royce-cullinan","/mercedes-benz-gle-import","/lexus-lx","/bmw-x6","/mercedes-benz-gls-import","/mercedes-benz-s-class-import","/mercedes-amg-g63","/porsche-911","/porsche-panamera-import","/toyota-land-cruiser-300","/range-rover","/li-auto-l9","/li-auto-l6","/toyota-rav4","/bmw-x3","/lexus-gx","/toyota-prado-250","/aston-martin-dbx707","/bentley-continental-gt","/ferrari-purosangue","/lamborghini-urus","/bmw-x5-import-podbor","/bmw-x7-legacy","/x7-oem","/zeekr-8x-podbor","/rolls-royce-cullinan-podbor","/cullinan-oem","/bentley-bentayga-podbor","/bentayga-oem","/range-rover-oem","/zeekr-9x-podbor","/mazda-cx-5-podbor","/audi-q5l-podbor","/volkswagen-tiguan-l-pro-podbor","/toyota-bz3x-podbor","/xiaomi-n90","/volkswagen-tavendor-2026","/volkswagen-tiguan-l-china","/changan-qiyuan-q05","/unimog-offroad-oem"];
  if (paths.indexOf(location.pathname.replace(/\/+$/, '')) < 0) return;
  if (document.querySelector('script[src*="ast-market-numeric-20261026.js"]')) return;
  var script = document.createElement('script');
  script.src = 'https://dmitryiudin-web.github.io/assets/ast-market-numeric-20261026.js';
  script.defer = true;
  document.head.appendChild(script);
})();


