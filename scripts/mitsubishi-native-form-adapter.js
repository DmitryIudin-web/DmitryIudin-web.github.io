/* One visible OEM form -> the existing configured native Tilda receiver. */
(function () {
  var root = document.getElementById('ast-mitsubishi-oem');
  var form = root && root.querySelector('.ast-oem-form');
  if (!form || form.dataset.nativeProxyBound) return;
  form.dataset.nativeProxyBound = '1';
  form.removeAttribute('data-ast-lead-form');
  var busy = false;
  function receiver() {
    var input = document.querySelector('input[name="formservices[]"]');
    return input && input.closest('form');
  }
  function hideReceiver() {
    var native = receiver();
    if (native) {
      var record = native.closest('.t-rec');
      if (record) {
        record.classList.add('ast-oem-native-receiver');
        record.style.display = 'none';
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideReceiver, {once: true});
  else hideReceiver();
  window.addEventListener('load', hideReceiver, {once: true});
  function status(text) { form.querySelector('[data-ast-unified-status]').textContent = text; }
  function put(target, name, value) {
    var field = target.elements[name];
    if (!field || !field.tagName) {
      field = document.createElement('input');
      field.type = 'hidden'; field.name = name; target.appendChild(field);
    }
    if (field.tagName === 'SELECT' && !Array.from(field.options).some(function (o) {return o.value === value;})) {
      field.add(new Option(value, value));
    }
    field.value = value;
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy) return;
    if (!form.reportValidity()) return;
    var data = new FormData(form), contact = String(data.get('contact') || '').trim();
    if (!(/^@[a-z0-9_]{4,}$/i.test(contact) || contact.replace(/\D/g, '').length >= 7)) {
      status('Укажите телефон или Telegram.'); return;
    }
    var native = receiver(), button = native && native.querySelector('button[type="submit"],input[type="submit"]');
    if (!native || !button || !window.tildaForm) {
      status('Форма ещё загружается. Повторите отправку через несколько секунд.'); return;
    }
    hideReceiver(); busy = true;
    var submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
    status('Передаём заявку...');
    data.forEach(function (value, key) { if (key !== 'consent') put(native, key, String(value)); });
    put(native, 'contact', contact); put(native, 'Phone', contact);
    put(native, 'model_version', String(data.get('model')));
    put(native, 'color_variant', String(data.get('exterior_color') || ''));
    put(native, 'Name', 'Заявка ' + String(data.get('model')));
    put(native, 'request_id', 'ast_mitsubishi_' + Date.now() + '_' + Math.random().toString(36).slice(2,8));
    native.querySelectorAll('input[type="checkbox"][data-tilda-req="1"]').forEach(function (el) {el.checked = true;});
    var error = native.querySelector('.js-errorbox-all');
    if (error) error.style.display = 'none';
    var finished = false, poll, timeout;
    function finish(ok, message) {
      if (finished) return; finished = true;
      clearInterval(poll); clearTimeout(timeout);
      native.removeEventListener('tildaform:aftersuccess', success);
      busy = false; submit.disabled = false;
      status(message);
      if (ok) {
        form.reset();
        form.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }
    function success() { finish(true, 'Заявка отправлена. Менеджер AST свяжется с вами.'); }
    native.addEventListener('tildaform:aftersuccess', success);
    poll = setInterval(function () {
      var box = native.querySelector('.js-errorbox-all');
      if (box && getComputedStyle(box).display !== 'none' && box.textContent.trim()) {
        finish(false, 'Не удалось отправить заявку. Проверьте контакт и повторите попытку или позвоните AST.');
      }
    }, 250);
    timeout = setTimeout(function () {
      finish(false, 'Не получили подтверждение отправки. Повторите попытку или позвоните AST.');
    }, 25000);
    button.click();
  });
})();
