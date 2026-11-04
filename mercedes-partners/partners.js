(function () {
  'use strict';
  // Reuse the site's existing counter; previews do not generate production hits.
  if (/^(avtonds\.ru|www\.avtonds\.ru|dmitryiudin-web\.github\.io)$/.test(location.hostname)) {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    if (!document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js"]')) {
      var counterScript = document.createElement('script');
      counterScript.async = true;
      counterScript.src = 'https://mc.yandex.ru/metrika/tag.js';
      document.head.appendChild(counterScript);
      window.ym(106049767, 'init', { trackLinks: true, accurateTrackBounce: true, webvisor: false });
    }
  }
  var consentText = 'Даю <a href="#data-consent">согласие на обработку персональных данных</a> для рассмотрения обращения.';
  var generalModel = 'Партнёрская поставка новых Mercedes';
  var generalOffer = 'mercedes-partners';
  var dialogWasOpen = false;
  function adaptForms() {
    document.querySelectorAll('.ast-quote-form').forEach(function (form) {
      if (!form.dataset.partnerAdapted) {
        form.dataset.partnerAdapted = '1';
        form.setAttribute('aria-label', 'Получить условия агентского сотрудничества с AST');
        var label = form.querySelector('.ast-quote-consent span');
        if (label) label.innerHTML = consentText;
      }
      var model = form.querySelector('[name="model"]');
      var offerId = form.querySelector('[name="offer_id"]');
      var offer = form.querySelector('[name="offer"]');
      // Keep the shared form's selected context; only fill missing values.
      if (model && !model.value.trim()) model.value = generalModel;
      if (offerId && !offerId.value.trim()) offerId.value = generalOffer;
      if (offer && !offer.value.trim()) offer.value = offerId ? offerId.value : generalOffer;

      var modelName = model ? model.value.trim() : '';
      var context = form.querySelector('[data-partner-context]');
      if (modelName && modelName !== generalModel) {
        if (!context) {
          context = document.createElement('p');
          context.className = 'partner-form-context';
          context.setAttribute('data-partner-context', '');
          context.setAttribute('aria-live', 'polite');
          form.insertBefore(context, form.firstChild);
        }
        var contextText = 'Вы предлагаете: ' + modelName;
        // Updating only changed text keeps the MutationObserver idempotent.
        if (context.textContent !== contextText) context.textContent = contextText;
      } else if (context) {
        context.remove();
      }
    });
    var title = document.getElementById('ast-quote-dialog-title');
    if (title && title.textContent !== 'Условия сотрудничества с AST') title.textContent = 'Условия сотрудничества с AST';
    var dialog = document.getElementById('ast-quote-dialog');
    var dialogIsOpen = !!(dialog && dialog.open);
    if (dialogIsOpen && !dialogWasOpen) trackGoal('ast_partner_cta', { page_path: location.pathname });
    dialogWasOpen = dialogIsOpen;
  }
  function trackGoal(name, data) {
    if (typeof window.ym === 'function') window.ym(106049767, 'reachGoal', name, data || {});
  }
  document.addEventListener('DOMContentLoaded', function () {
    // Use the existing AST receiver; never substitute a local success state.
    adaptForms();
    new MutationObserver(adaptForms).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    var source = document.querySelector('[data-partner-source]');
    if (source) source.addEventListener('submit', function (event) { event.preventDefault(); });
    document.addEventListener('click', function (event) {
      var consentLink = event.target.closest('a[href="#data-consent"]');
      if (consentLink) {
        var dialog = consentLink.closest('dialog');
        if (dialog && dialog.open) dialog.close();
        var details = document.getElementById('data-consent');
        if (details) details.open = true;
      }
      var link = event.target.closest('a');
      if (!link) return;
      if (/^(tel:|mailto:)/.test(link.getAttribute('href') || '')) trackGoal('ast_partner_contact', { type: link.protocol.replace(':', ''), page_path: location.pathname });
    });
  });
})();
