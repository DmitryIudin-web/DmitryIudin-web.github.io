/* Show the existing native Tilda form in the compact OEM request section. */
(function () {
  function setup() {
    var root=document.getElementById('ast-mitsubishi-oem');
    if(!root||root.dataset.nativeFormReady)return;
    var custom=root.querySelector('.ast-oem-form'),service=document.querySelector('input[name="formservices[]"]'),native=service&&service.closest('form');
    if(!custom||!native)return;
    var record=native.closest('.t-rec'),target=root.querySelector('.ast-oem-request');if(!record||!target)return;
    var metadata={};new FormData(custom).forEach(function(v,k){if(custom.elements[k]?.type==='hidden')metadata[k]=String(v);});
    function put(name,value){var field=native.elements[name];if(!field||!field.tagName){field=document.createElement('input');field.type='hidden';field.name=name;native.appendChild(field);}field.value=value;}
    var modelGroup=native.elements.model_version?.closest('.t-input-group');if(modelGroup)modelGroup.remove();
    Object.keys(metadata).forEach(function(k){put(k,metadata[k]);});put('model_version',metadata.model);put('brand','Mitsubishi');put('market','UAE GCC');
    var color=native.elements.color_variant;
    if(color){var group=color.closest('.t-input-group'),input=document.createElement('input');input.type='text';input.name='color_variant';input.id=color.id;input.className='t-input';input.placeholder='Желаемый цвет';color.replaceWith(input);if(group){group.classList.add('ast-native-color');var title=group.querySelector('.t-input-title');if(title)title.textContent='Цвет кузова';}}
    var inputs=native.querySelector('.t-form__inputsbox');
    if(inputs){var details=document.createElement('details');details.className='ast-native-details';details.innerHTML='<summary>Указать комплектацию и пожелания</summary>';var extra=document.createElement('div');extra.className='ast-native-extra';extra.innerHTML='<label>Комплектация<input class="t-input" name="trim" placeholder="Нужная версия или помогите выбрать"></label><label>Дополнительные пожелания<textarea class="t-input" name="oem_wishes" rows="2" placeholder="Цвет салона, бюджет, срок покупки"></textarea></label>';details.appendChild(extra);var groups=Array.from(inputs.querySelectorAll('.t-input-group')),contactGroup=native.elements.contact?.closest('.t-input-group');if(contactGroup)contactGroup.after(details);else inputs.prepend(details);groups.forEach(function(g){if(!g.contains(native.elements.contact)&&!g.contains(native.elements.consent))details.appendChild(g);});}
    custom.remove();target.appendChild(record);record.classList.remove('ast-oem-native-receiver');record.removeAttribute('aria-hidden');record.classList.add('ast-oem-native-form');record.style.display='';record.style.paddingTop='0';record.style.paddingBottom='0';native.setAttribute('aria-label','Расчёт '+metadata.model);
    function enrich(){Object.keys(metadata).forEach(function(k){if(k!=='comment')put(k,metadata[k]);});put('model_version',metadata.model);var trim=native.elements.trim?.value||'подбор',color=native.elements.color_variant?.value||native.elements.exterior_color?.value||'подбор';put('trim',trim);put('exterior_color',color);put('comment',['Модель: '+metadata.model,'model_id: '+metadata.model_id,'Рынок: UAE GCC','Комплектация: '+trim,'Цвет: '+color,'Город: '+(native.elements.city?.value||'не указан'),'Пожелания: '+(native.elements.oem_wishes?.value||''),'Страница: '+location.href.split('#')[0]].join('\n'));put('page_url',location.href.split('#')[0]);put('landing_variant','oem');}
    native.addEventListener('input',enrich);native.addEventListener('change',enrich);native.addEventListener('submit',enrich,true);native.querySelector('button[type="submit"]')?.addEventListener('click',enrich,true);
    root.querySelectorAll('[data-slide-index]').forEach(function(a){a.addEventListener('click',function(){var label=root.querySelectorAll('.bxslider01>li')[+a.dataset.slideIndex]?.querySelector('figcaption')?.textContent.trim();if(label&&native.elements.color_variant)native.elements.color_variant.value=label;enrich();});});enrich();root.dataset.nativeFormReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();window.addEventListener('load',setup,{once:true});
})();
