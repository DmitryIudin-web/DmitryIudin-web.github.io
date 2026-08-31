/*
 * AST Этап 1 «Измерение + конверсия» — глобальный рантайм avtonds.ru.
 *
 * Блок A: единая схема событий Метрики (A1), составная цель ast_contact с
 * дедупликацией на визит (A2), передача источника в CRM-формы (A6).
 * Блок B: липкая панель мессенджеров (B1), предзаполненные мессенджер-ссылки (B2),
 * квиз «Рассчитать стоимость» (B3).
 * Блок C: CTA-шаблон статей /news/* (C6).
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
    whatsapp: '79872831255',
    phone: '+79872831255',
    phoneDisplay: '+7 987 283-12-55',
    privacyUrl: '/privacy',
    // Страницы без липкой панели (B1)
    stickyExcluded: ['/privacy', '/referal'],
    // Подпись под кнопками — словарь п. 5
    ctaHint: 'Ответим в течение часа в рабочее время · Без предоплаты за расчёт'
  };

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
    '/porsche-911': { model: 'Porsche 911' },
    '/porsche-cayenne-import': { offer: 'porsche-cayenne', model: 'Porsche Cayenne' },
    '/porsche-panamera-import': { offer: 'porsche-panamera', model: 'Porsche Panamera' },
    '/porsche-import': { offer: 'porsche', model: 'Porsche' },
    '/range-rover': { model: 'Range Rover' },
    '/rolls-royce-cullinan': { model: 'Rolls-Royce Cullinan' },
    '/toyota-land-cruiser-300': { offer: 'toyota-lc300', model: 'Toyota Land Cruiser 300' },
    '/toyota-prado-250': { model: 'Toyota Prado 250' },
    '/zeekr-8x': { model: 'Zeekr 8X' }
  };

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
        if (seen.indexOf(box) > -1) return;
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
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var found = false;
    keys.forEach(function (key) { if (params.get(key)) found = true; });
    if (found) {
      keys.forEach(function (key) { sessionSet('ast_' + key, params.get(key) || ''); });
    }
    if (!sessionGet('ast_landing_page')) sessionSet('ast_landing_page', path());
    if (!sessionGet('ast_referrer')) sessionSet('ast_referrer', document.referrer || '');
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
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
        var stored = sessionGet('ast_' + key);
        var input = ensureHidden(form, key);
        if (stored && !input.value) input.value = stored;
      });
      var pageInput = ensureHidden(form, 'page');
      if (!pageInput.value) pageInput.value = path();
      var offerInput = ensureHidden(form, 'offer');
      if (!offerInput.value) offerInput.value = pageOffer();
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
      '<a class="ast-sticky-cta__btn ast-sticky-cta__btn--telegram" href="' + telegramLink() + '" rel="noopener">' +
        ICONS.telegram + '<span>Написать в Telegram</span></a>' +
      '<a class="ast-sticky-cta__btn ast-sticky-cta__btn--whatsapp" href="' + whatsappLink() + '" rel="noopener">' +
        ICONS.whatsapp + '<span>WhatsApp</span></a>';

    var desktop = document.createElement('div');
    desktop.className = 'ast-sticky-cta ast-sticky-cta--desktop';
    desktop.setAttribute('aria-label', 'Быстрая связь');
    desktop.innerHTML =
      '<div class="ast-sticky-cta__menu">' +
        '<a class="ast-sticky-cta__item ast-sticky-cta__item--telegram" href="' + telegramLink() + '" rel="noopener">' +
          ICONS.telegram + '<span>Написать в Telegram</span></a>' +
        '<a class="ast-sticky-cta__item ast-sticky-cta__item--whatsapp" href="' + whatsappLink() + '" rel="noopener">' +
          ICONS.whatsapp + '<span>Написать в WhatsApp</span></a>' +
        '<a class="ast-sticky-cta__item ast-sticky-cta__item--phone" href="tel:' + CONFIG.phone + '">' +
          ICONS.phone + '<span>Позвонить: ' + CONFIG.phoneDisplay + '</span></a>' +
      '</div>' +
      '<button class="ast-sticky-cta__fab" type="button" aria-label="Связаться с нами">' + ICONS.telegram + '</button>';

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
        String(preset).replace(/"/g, '&quot;') + '">' +
        '<button class="ast-quiz__btn" type="button" data-ast-quiz-next>Дальше</button>';
    } else if (s.step === 2) {
      html += '<p class="ast-quiz__step-label">Шаг 2 из 3</p>' +
        '<h3 class="ast-quiz__title">Как оформляем?</h3>' +
        '<div class="ast-quiz__options">' +
        ['На физлицо', 'На юрлицо (с НДС)', 'Пока не знаю'].map(function (v) {
          return '<button class="ast-quiz__option" type="button" data-ast-quiz-client="' + v + '">' + v + '</button>';
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
      quiz_model: s.model || '',
      quiz_client_type: s.clientType || '',
      quiz_timeline: s.timeline || '',
      quiz_contact: 'phone'
    };
    track('ast_quiz_submit', payload);
    trackContact('quiz', { position: payload.position });

    // Передача в CRM: используем скрытую Tilda-форму страницы, как это уже
    // делает мини-форма (см. critical mini form bridge в инлайн-скриптах).
    var form = document.querySelector('[data-ast-lead-form], #ast-lead-form, form.t-form.js-form-proccess, form.t-form');
    if (form) {
      var set = function (name, value) {
        var inp = ensureHidden(form, name);
        inp.value = value || '';
        try {
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      };
      set('Name', 'Квиз: расчёт стоимости');
      set('Phone', phoneValue);
      set('phone', phoneValue);
      set('contact', phoneValue);
      set('model', s.model || '');
      set('scenario', 'quiz');
      set('client_type', s.clientType || '');
      set('timeline', s.timeline || '');
      set('source_detail', 'ast_quiz');
      set('comment', 'Квиз avtonds.ru\nАвтомобиль: ' + (s.model || '—') +
        '\nОформление: ' + (s.clientType || '—') +
        '\nСрок: ' + (s.timeline || '—') +
        '\nТелефон: ' + phoneValue);
      fillFormSources();
      try {
        var submit = form.querySelector('button[type="submit"],input[type="submit"],.t-submit');
        if (submit) submit.click();
        else if (form.requestSubmit) form.requestSubmit();
      } catch (e) {}
    }
  }

  function openQuiz(options) {
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
          quizSubmitPhone(value);
          quizState.step = 5;
          quizRender();
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
      position: options.position || 'inline'
    };
    // C5: для лизинговых страниц шаг 2 предустановлен «На юрлицо (с НДС)».
    if (!quizState.clientType && quizState.offer === 'leasing') {
      quizState.clientType = 'На юрлицо (с НДС)';
    }
    quizRender();
    overlay.classList.add('ast-quiz-overlay--open');
  }

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

  // C2. /bezopasnaya-sdelka: primary — «Обсудить мою сделку» в Telegram,
  // повтор после этапов оплаты, квиз внизу. FAQ и FAQPage уже есть на странице.
  function enhanceSafeDeal() {
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
                '<p class="ast-model-extra__note">Точный расчёт по вашей комплектации — за 24 часа.</p>' +
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
  bridgeDataLayer();
  watchTildaSuccess();
  fetchClientId();

  onReady(function () {
    enhancePages();
    decorateMessengerLinks();
    fillFormSources();
    buildSticky();
    buildArticleCta();
  });
  // Контент Tilda дорисовывается асинхронно — повторяем прогон, как принято на сайте.
  [1500, 4000, 8000].forEach(function (delay) {
    setTimeout(function () {
      enhancePages();
      decorateMessengerLinks();
      fillFormSources();
      buildArticleCta();
    }, delay);
  });

  window.ASTConversion = {
    config: CONFIG,
    track: track,
    openQuiz: openQuiz,
    telegramLink: telegramLink,
    whatsappLink: whatsappLink
  };
})();
