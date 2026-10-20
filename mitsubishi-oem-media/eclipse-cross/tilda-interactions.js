(function(){const root=document.getElementById('ast-mitsubishi-oem');if(!root||root.dataset.ready)return;root.dataset.ready='1';function show(key,scroll){if(!root.querySelector('[data-oem-panel="'+key+'"]'))key='index';root.querySelectorAll('[data-oem-panel]').forEach(p=>{p.hidden=p.dataset.oemPanel!==key;p.querySelectorAll('video').forEach(v=>{if(p.hidden)v.pause();else v.play().catch(()=>{})})});root.querySelectorAll('.cars-top-bar [data-oem-tab]').forEach(a=>a.classList.toggle('current',a.dataset.oemTab===key));if(scroll)root.scrollIntoView({behavior:'smooth',block:'start'})}root.addEventListener('click',e=>{let a=e.target.closest('[data-oem-tab]');if(!a)return;e.preventDefault();history.replaceState(null,'','#'+a.dataset.oemTab);show(a.dataset.oemTab,true)});if(location.hash!=='#ast-request')show(location.hash.slice(1)||'index',false);root.querySelectorAll('[data-slide-index]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const i=+a.dataset.slideIndex;root.querySelectorAll('.bxslider01>li').forEach((li,n)=>li.style.display=n===i?'block':'none');root.querySelectorAll('[data-slide-index]').forEach(x=>x.classList.toggle('active',x===a));const color=a.getAttribute('title')||a.getAttribute('aria-label')||a.textContent.trim();if(color){root.querySelector('[name="exterior_color"]').value=color;prepare()}}));root.querySelector('.video-poster')?.addEventListener('click',function(){const f=this.parentNode.querySelector('iframe');f.src=f.dataset.src+'&autoplay=1';f.hidden=false;this.remove()});root.querySelectorAll('video').forEach(v=>{v.muted=true;v.play().catch(()=>{});new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&!v.closest('[data-oem-panel]').hidden?v.play().catch(()=>{}):v.pause()),{threshold:.15}).observe(v)});const f=root.querySelector('form');const params=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_campaign_id','utm_group_id','utm_source_type','utm_position_type','utm_device','utm_retargeting','yclid'].forEach(k=>{if(params.has(k))f.elements[k].value=params.get(k)});function prepare(){f.elements.comment.value=['Модель: '+f.elements.model.value,'model_id: '+f.elements.model_id.value,'Рынок: UAE GCC','Комплектация: '+(f.elements.trim.value||'подбор'),'Цвет: '+(f.elements.exterior_color.value||'подбор'),'Город: '+(f.elements.city.value||'не указан'),'Формат: '+f.elements.deal_format.value,'Пожелания: '+f.elements.oem_wishes.value,'Страница: '+location.href.split('#')[0]].join('\n')}f.addEventListener('input',prepare);f.addEventListener('change',prepare);prepare();})();
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
