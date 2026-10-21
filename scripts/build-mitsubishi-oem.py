#!/usr/bin/env python3
"""Prepare the two approved OEM pages and their isolated Tilda fragments."""
from pathlib import Path
from lxml import html, etree
from urllib.parse import urlsplit
import re, json

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / 'mitsubishi-oem-media'
HOST = 'https://dmitryiudin-web.github.io/mitsubishi-oem-media'
MODELS = {
    'asx': ('ASX', [('index','Обзор'),('design','Дизайн'),('performance','Динамика'),('safety','Безопасность'),('utility','Практичность')]),
    'eclipse-cross': ('Eclipse Cross', [('index','Обзор'),('drive','Динамика'),('exterior','Экстерьер'),('interior','Интерьер'),('safety','Безопасность'),('specifications','Характеристики')]),
}

# Persist the CDN migration without restoring removed elements on later builds.
cdn_manifest_path = ROOT / 'scripts/mitsubishi-tilda-media.json'
CDN_MANIFEST = json.loads(cdn_manifest_path.read_text()) if cdn_manifest_path.is_file() else {}
CDN_URLS = {entry['original_url']: entry['cdn_url'] for entry in CDN_MANIFEST.get('assets', [])}

def on_tilda_cdn(text):
    for original, replacement in CDN_URLS.items():
        text = text.replace(original, replacement)
    return text

def absolute_url(value, path, slug):
    if not value or value.startswith(('data:', 'http:', 'https:', '//', '#')):
        return value
    target = (path.parent / value.split('?')[0].split('#')[0]).resolve()
    try: rel = target.relative_to(MEDIA / slug)
    except ValueError: return value
    return f'{HOST}/{slug}/{rel.as_posix()}'

def css_source(path, slug, seen):
    if path in seen: return ''
    seen.add(path)
    text = path.read_text()
    def imp(m):
        value = m.group(1).strip(' \"\'')
        if value.startswith(('http:', 'https:', '//')): return ''
        candidate = path.parent / value
        return css_source(candidate, slug, seen) if candidate.is_file() else ''
    text = re.sub(r'@import\s+(?:url\()?([^;\)]+)\)?\s*;', imp, text)
    return re.sub(r'url\(([^)]+)\)', lambda m: 'url("'+absolute_url(m.group(1).strip(' \"\''),path,slug)+'")', text)

def scope_css(text):
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    out=[];pos=0
    while pos<len(text):
        start=text.find('{',pos)
        if start<0: break
        pre=text[pos:start].strip();depth=1;i=start+1;quote=None
        while i<len(text) and depth:
            ch=text[i]
            if quote:
                if ch==quote and text[i-1]!='\\':quote=None
            elif ch in '\"\'':quote=ch
            elif ch=='{':depth+=1
            elif ch=='}':depth-=1
            i+=1
        body=text[start+1:i-1]
        if pre.startswith(('@media','@supports','@layer')):body=scope_css(body)
        elif not pre.startswith('@'):
            selectors=[]
            for sel in pre.split(','):
                sel=sel.strip()
                if not sel:continue
                sel=re.sub(r'^(?:html|body|:root)(?=[\s\.#:\[]|$)', '#ast-mitsubishi-oem',sel)
                if not sel.startswith('#ast-mitsubishi-oem'):sel='#ast-mitsubishi-oem '+sel
                selectors.append(sel)
            pre=','.join(selectors)
        out.append(pre+'{'+body+'}');pos=i
    return ''.join(out)

ASX_ANNOTATION_CSS='''#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-native-form .t-checkbox__control,#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-native-form .t-checkbox__control span,#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-native-form .t-checkbox__control a{font:400 13px/1.55 Arial,Helvetica,sans-serif!important;color:#555!important;letter-spacing:normal!important}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-native-form .t-checkbox__control{display:flex!important;align-items:flex-start;gap:10px}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-native-form .t-checkbox__indicator{flex-shrink:0;margin:2px 0 0!important}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-native-form .t-checkbox__control a{text-decoration:underline!important}#ast-mitsubishi-oem #bx-pager01 a:focus:not(:focus-visible){outline:none!important;box-shadow:none!important}#ast-mitsubishi-oem #bx-pager01 a:focus-visible{outline:2px solid #333!important;outline-offset:3px}'''

# Mobile OEM floats must stay inside their panel so the following form cannot cover media.
MOBILE_LAYOUT_CSS = '#ast-mitsubishi-oem{display:flow-root}#ast-mitsubishi-oem>[data-oem-panel]:not([hidden]){display:flow-root;clear:both}#ast-mitsubishi-oem>.cars-top-bar{float:none;clear:both;width:100%}#ast-mitsubishi-oem>.ast-oem-request,#ast-mitsubishi-oem>.ast-oem-contacts{clear:both}@media(max-width:991px){#ast-mitsubishi-oem>[data-oem-panel]:not([hidden]){display:block!important;float:none!important;clear:both;width:100%}#ast-mitsubishi-oem [data-oem-panel]>.all-cars-home,#ast-mitsubishi-oem [data-oem-panel]>.cars-first-div{float:none!important;clear:both;width:100%}#ast-mitsubishi-oem [data-oem-panel]::after{content:"";display:table;clear:both}#ast-mitsubishi-oem .cars-first-div>img{float:none!important}#ast-mitsubishi-oem>.ast-oem-request{float:none!important;clear:both!important;display:flow-root}}'

ASX_MOBILE_POLISH_CSS = '@media(max-width:700px){#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .cars-top-bar{min-height:0!important}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .cars-top-bar ul{gap:0!important;min-height:48px;padding:4px!important;scrollbar-width:none}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .cars-top-bar ul::-webkit-scrollbar{display:none}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .cars-top-bar ul li a{padding:11px 10px!important;font-size:11px!important;letter-spacing:.4px;border:0}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] [data-oem-panel="index"] .cars-first-div>p.heading-cars{position:static!important;float:none!important;display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:none;width:100%;padding:16px 5%;margin:0!important;background:#fff!important;color:#151515!important;border-bottom:1px solid #e8e8e8}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] [data-oem-panel="index"] p.heading-cars>.red{font:400 clamp(16px,5vw,19px)/1.25 Arial,Helvetica,sans-serif;margin:0!important}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] [data-oem-panel="index"] p.heading-cars>.learn-more-transparent{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-height:44px;margin:0!important;padding:11px 13px;background:#e60012!important;color:#fff!important;border:0;font:400 12px/1.2 Arial,Helvetica,sans-serif}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] [data-oem-panel="index"] .learn-more-transparent .glyphicon{display:inline-block;margin-left:5px;font-size:11px}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-mobile-cta{padding:8px 4%;padding-bottom:max(8px,env(safe-area-inset-bottom))}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] .ast-oem-mobile-cta a{min-height:44px;padding:12px 8px;font-size:14px;line-height:20px}}'

ASX_FIRST_DIVIDER_CSS = '@media(max-width:700px){#ast-mitsubishi-oem[data-model="mitsubishi_asx"] [data-oem-panel="index"]>.all-cars-home:first-child{overflow:visible;margin-bottom:24px}#ast-mitsubishi-oem[data-model="mitsubishi_asx"] [data-oem-panel="index"]>.all-cars-home:first-child::after{content:"";position:absolute;display:block;clear:none;left:20px;right:20px;bottom:-13px;height:2px;width:auto;background:linear-gradient(to right,#e60012 0 48px,#252525 48px 100%);pointer-events:none;z-index:1}}'

FORM_CSS='''
body:has(#ast-mitsubishi-oem) [aria-label="Быстрая связь"]{display:none!important}
#ast-mitsubishi-oem{font-family:Arial,Helvetica,sans-serif;color:#151515;overflow-x:clip;background:#fff}
#ast-mitsubishi-oem .ast-oem-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:22px 5%;background:#fff;border-bottom:1px solid #ddd}
#ast-mitsubishi-oem .ast-oem-head a{color:#111;text-decoration:none}#ast-mitsubishi-oem .ast-oem-head .ast-logo{font-size:28px;color:#e60012;font-weight:800}
#ast-mitsubishi-oem .ast-oem-head strong{font-size:15px;letter-spacing:2px}#ast-mitsubishi-oem .ast-oem-head .ast-oem-cta{background:#e60012;color:#fff;padding:13px 18px;font-size:14px}
#ast-mitsubishi-oem .cars-top-bar{position:sticky;top:0;z-index:15;background:#f3f3f3!important;height:auto!important;min-height:60px}
#ast-mitsubishi-oem .cars-top-bar ul{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;padding:12px!important;margin:0!important;gap:0;min-height:60px;list-style:none}
#ast-mitsubishi-oem .cars-top-bar li{margin:0!important}#ast-mitsubishi-oem .cars-top-bar ul li a{display:block;color:#252525!important;padding:12px 16px!important;font-size:13px;line-height:1.35;text-decoration:none}
#ast-mitsubishi-oem .cars-top-bar ul li a.current{background:#e60012!important;color:#fff!important}#ast-mitsubishi-oem [data-oem-panel][hidden]{display:none!important}
#ast-mitsubishi-oem .ast-oem-request{padding:70px max(5%,calc((100vw - 1120px)/2));background:#f4f4f4;scroll-margin-top:80px}
#ast-mitsubishi-oem .ast-oem-request h2{font-size:clamp(28px,3vw,42px);line-height:1.14;margin:0 0 16px;font-weight:600}
#ast-mitsubishi-oem .ast-oem-request>p{font-size:17px;line-height:1.6;max-width:760px;color:#555;margin:0 0 25px}
#ast-mitsubishi-oem .ast-oem-form{max-width:760px}#ast-mitsubishi-oem .ast-oem-form label{font-size:14px;display:block;margin:14px 0 7px}
#ast-mitsubishi-oem .ast-oem-form input:not([type=checkbox]),#ast-mitsubishi-oem .ast-oem-form select,#ast-mitsubishi-oem .ast-oem-form textarea{width:100%;box-sizing:border-box;background:#fff;border:1px solid #ccc;padding:14px;font:16px Arial;min-height:48px;border-radius:0}
#ast-mitsubishi-oem .ast-oem-form details{margin-top:20px}#ast-mitsubishi-oem .ast-oem-form summary{cursor:pointer;color:#333;font-size:15px}#ast-mitsubishi-oem .ast-oem-options{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}
#ast-mitsubishi-oem .ast-oem-form .ast-oem-consent{display:flex;gap:10px;align-items:flex-start;line-height:1.55;font-size:13px;margin:23px 0}#ast-mitsubishi-oem .ast-oem-consent input{width:18px;height:18px;flex-shrink:0;margin-top:1px}#ast-mitsubishi-oem .ast-oem-consent a{color:inherit;text-decoration:underline}
#ast-mitsubishi-oem .ast-oem-form button[type=submit]{background:#e60012;color:#fff;border:0;padding:17px 28px;font-size:16px;cursor:pointer;width:100%;max-width:340px}#ast-mitsubishi-oem button:disabled{opacity:.55;cursor:wait}
#ast-mitsubishi-oem [data-ast-unified-status]{font-size:15px;margin-top:16px;line-height:1.5}#ast-mitsubishi-oem .ast-oem-contacts{padding:30px 5%;background:#111;color:#eee;display:flex;flex-wrap:wrap;justify-content:space-between;gap:20px;font-size:14px;line-height:1.7}
#ast-mitsubishi-oem .ast-oem-contacts a{color:#fff;text-decoration:none}#ast-mitsubishi-oem .ast-oem-contacts small{display:block;color:#aaa;font-size:12px}#ast-mitsubishi-oem .ast-oem-mobile-cta{display:none}
@media(max-width:700px){#ast-mitsubishi-oem .ast-oem-head{padding:16px 4%;gap:10px;flex-wrap:wrap}#ast-mitsubishi-oem .ast-oem-head strong{font-size:12px;letter-spacing:1px}#ast-mitsubishi-oem .ast-oem-head .ast-oem-phone{font-size:13px}#ast-mitsubishi-oem .ast-oem-head .ast-oem-cta{display:none}#ast-mitsubishi-oem .cars-top-bar ul{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;min-height:52px;padding:5px!important}#ast-mitsubishi-oem .cars-top-bar li{flex-shrink:0}#ast-mitsubishi-oem .cars-top-bar ul li a{font-size:11px;padding:12px!important;white-space:nowrap}#ast-mitsubishi-oem .ast-oem-request{padding:42px 5%}#ast-mitsubishi-oem .ast-oem-options{grid-template-columns:1fr}#ast-mitsubishi-oem .ast-oem-contacts{padding-bottom:90px}#ast-mitsubishi-oem .ast-oem-mobile-cta{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:50;background:#fff;padding:10px 4%;gap:10px;box-shadow:0 -2px 10px #0001}#ast-mitsubishi-oem .ast-oem-mobile-cta a{padding:13px;text-align:center;text-decoration:none;color:#fff;background:#e60012;flex:1;font-size:14px}#ast-mitsubishi-oem .ast-oem-mobile-cta a:first-child{background:#242424}}
'''

for slug,(model,pages) in MODELS.items():
    directory=MEDIA/slug
    nav='';panels=[];css=[];seen=set()
    for stem,label in pages:
        f=directory/(stem+'.html');doc=html.fromstring(f.read_text())
        for link in doc.xpath('//head/link[@rel="stylesheet"]'):
            p=(directory/link.get('href')).resolve()
            if p.is_file():css.append(css_source(p,slug,seen))
        main=doc.xpath('//main')[0]
        bars=main.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," cars-top-bar ")]')
        for bar in bars:
            if stem=='index' and not nav:nav=etree.tostring(bar,encoding='unicode',method='html')
            bar.getparent().remove(bar)
        for node in main.xpath('.//*[@src] | .//*[@href] | .//*[@poster] | .//*[@style] | .//*[@data-src]'):
            for attr in ['src','poster','data-src']:
                if node.get(attr):node.set(attr,absolute_url(node.get(attr),f,slug))
            href=node.get('href')
            if href:
                name=Path(urlsplit(href).path).stem
                if name in dict(pages):node.set('href','#'+name);node.set('data-oem-tab',name)
                elif href.startswith('assets/'):node.set('href',absolute_url(href,f,slug))
            if node.get('style'):
                node.set('style',re.sub(r'url\(([^)]+)\)',lambda m:'url('+absolute_url(m.group(1).strip('\"\''),f,slug)+')',node.get('style')))
        for notice in main.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," vat-notice ")]'):notice.getparent().remove(notice)
        # User annotation 2026-10-20: remove the first ASX video hero, preserve its photo hero.
        if slug == 'asx' and stem == 'index':
            for hero in main.xpath('.//*[contains(concat(" ", normalize-space(@class), " "), " video_bg ")]'):
                hero.getparent().remove(hero)
        for h1 in main.xpath('.//h1'):h1.tag='h2'
        if stem=='index':
            headings=main.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," attrage_video_lay ")]') or main.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," heading-cars ")]')
            if headings:headings[0].tag='h1'
            else:main.insert(0,html.fromstring('<h1 style="position:absolute;width:1px;height:1px;overflow:hidden">Mitsubishi '+model+'</h1>'))
        content=(main.text or '')+''.join(etree.tostring(c,encoding='unicode',method='html') for c in main)
        panels.append(f'<section data-oem-panel="{stem}"'+(' hidden' if stem!='index' else '')+'>'+content+'</section>')
    # Use hash navigation within the complete model document.
    nav_doc=html.fromstring(nav)
    for a in nav_doc.xpath('.//a[@href]'):
        href=a.get('href');stem=Path(urlsplit(href).path).stem
        if stem in dict(pages):a.set('href','#'+stem);a.set('data-oem-tab',stem)
        elif href.startswith('assets/'):a.set('href',absolute_url(href,directory/'index.html',slug))
    nav=etree.tostring(nav_doc,encoding='unicode',method='html')
    stylesheet=scope_css('\n'.join(css))+FORM_CSS+'\n'+(ROOT/'scripts/mitsubishi-native-form.css').read_text()
    stylesheet = on_tilda_cdn(stylesheet) + MOBILE_LAYOUT_CSS + (ASX_MOBILE_POLISH_CSS + ASX_FIRST_DIVIDER_CSS if slug == 'asx' else '')
    (directory/'tilda-scoped.css').write_text(stylesheet)
    fields={'model':'Mitsubishi '+model,'model_id':'mitsubishi_'+slug.replace('-','_'),'brand':'Mitsubishi','market':'UAE GCC','landing_variant':'oem','source':'avtonds_site','site_source':'avtonds.ru','source_detail':'mitsubishi_'+slug.replace('-','_')+'_oem','policy_url':'https://avtonds.ru/privacy','consent_version':'privacy-2026-05-12','comment':''}
    fields.update({k:'' for k in ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_campaign_id','utm_group_id','utm_source_type','utm_position_type','utm_device','utm_retargeting','yclid']})
    hidden=''.join('<input type="hidden" name="'+k+'" value="'+v+'">' for k,v in fields.items())
    form=f'''<section class="ast-oem-request" id="ast-request"><h2>Рассчитать под мою комплектацию</h2><p>Оставьте контакт. Подготовим расчёт Mitsubishi {model} с доставкой в ваш город и проверим доступные комплектации.</p><form class="ast-oem-form" data-ast-lead-form data-model-id="{fields['model_id']}" aria-label="Расчёт Mitsubishi {model}">{hidden}<label for="ast-contact">Телефон или Telegram</label><input id="ast-contact" name="contact" placeholder="+7… или @username" autocomplete="tel" required><details><summary>Указать комплектацию и пожелания</summary><div class="ast-oem-options"><div><label for="ast-trim">Комплектация</label><input id="ast-trim" name="trim" placeholder="Нужная версия или помогите выбрать"></div><div><label for="ast-color">Цвет кузова</label><input id="ast-color" name="exterior_color" placeholder="Желаемый цвет"></div><div><label for="ast-city">Город доставки</label><input id="ast-city" name="city" autocomplete="address-level2" placeholder="Ваш город"></div><div><label for="ast-deal">Формат покупки</label><select id="ast-deal" name="deal_format"><option>Частная покупка</option><option>Юрлицо с НДС</option><option>Лизинг</option></select></div></div><label for="ast-wishes">Дополнительные пожелания</label><textarea id="ast-wishes" name="oem_wishes" rows="2" placeholder="Цвет салона, бюджет, срок покупки"></textarea></details><label class="ast-oem-consent"><input type="checkbox" name="consent" value="yes" required><span>Согласен на обработку персональных данных по <a href="https://avtonds.ru/privacy" target="_blank" rel="noopener">политике конфиденциальности</a>. ООО «АСТ», ИНН 6313553773.</span></label><button type="submit">Получить расчёт</button><p data-ast-unified-status role="status" aria-live="polite"></p></form></section>'''
    header=f'<header class="ast-oem-head"><a class="ast-logo" href="https://avtonds.ru/">AST</a><strong>MITSUBISHI {model.upper()}</strong><a class="ast-oem-phone" href="tel:+79991583458">+7 999 158-34-58</a><a class="ast-oem-cta" href="#ast-request">Получить расчёт</a></header>'
    footer='<footer class="ast-oem-contacts"><div><strong>AST · Поставка автомобилей</strong><small>ООО «АСТ» · ИНН 6313553773 · ОГРН 1176313080239</small></div><div><a href="tel:+79991583458">+7 999 158-34-58</a><br><a href="mailto:zakaz@avtonds.ru">zakaz@avtonds.ru</a></div><div><a href="https://t.me/ASTavtomoto" target="_blank" rel="noopener">Telegram AST</a><br><a href="https://avtonds.ru/contacts">Все контакты</a> · <a href="https://avtonds.ru/privacy">Политика</a></div></footer><div class="ast-oem-mobile-cta"><a href="tel:+79991583458">Позвонить</a><a href="#ast-request">Получить расчёт</a></div>'
    script=r'''(function(){const root=document.getElementById('ast-mitsubishi-oem');if(!root||root.dataset.ready)return;root.dataset.ready='1';function show(key,scroll){if(!root.querySelector('[data-oem-panel="'+key+'"]'))key='index';root.querySelectorAll('[data-oem-panel]').forEach(p=>{p.hidden=p.dataset.oemPanel!==key;p.querySelectorAll('video').forEach(v=>{if(p.hidden)v.pause();else v.play().catch(()=>{})})});root.querySelectorAll('.cars-top-bar [data-oem-tab]').forEach(a=>a.classList.toggle('current',a.dataset.oemTab===key));if(scroll)root.scrollIntoView({behavior:'smooth',block:'start'})}root.addEventListener('click',e=>{let a=e.target.closest('[data-oem-tab]');if(!a)return;e.preventDefault();history.replaceState(null,'','#'+a.dataset.oemTab);show(a.dataset.oemTab,true)});if(location.hash!=='#ast-request')show(location.hash.slice(1)||'index',false);root.querySelectorAll('[data-slide-index]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();const i=+a.dataset.slideIndex;root.querySelectorAll('.bxslider01>li').forEach((li,n)=>li.style.display=n===i?'block':'none');root.querySelectorAll('[data-slide-index]').forEach(x=>x.classList.toggle('active',x===a));const color=root.querySelectorAll('.bxslider01>li')[i]?.querySelector('figcaption')?.textContent.trim()||'';if(color){root.querySelector('[name="exterior_color"]').value=color;prepare()}}));root.querySelectorAll('[data-slide-index]').forEach((a,i)=>a.classList.toggle('active',i===0));root.querySelector('.video-poster')?.addEventListener('click',function(){const f=this.parentNode.querySelector('iframe');f.src=f.dataset.src+'&autoplay=1';f.hidden=false;this.remove()});root.querySelectorAll('video').forEach(v=>{v.muted=true;v.play().catch(()=>{});new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting&&!v.closest('[data-oem-panel]').hidden?v.play().catch(()=>{}):v.pause()),{threshold:.15}).observe(v)});const f=root.querySelector('form');const params=new URLSearchParams(location.search);['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_campaign_id','utm_group_id','utm_source_type','utm_position_type','utm_device','utm_retargeting','yclid'].forEach(k=>{if(params.has(k))f.elements[k].value=params.get(k)});function prepare(){f.elements.comment.value=['Модель: '+f.elements.model.value,'model_id: '+f.elements.model_id.value,'Рынок: UAE GCC','Комплектация: '+(f.elements.trim.value||'подбор'),'Цвет: '+(f.elements.exterior_color.value||'подбор'),'Город: '+(f.elements.city.value||'не указан'),'Формат: '+f.elements.deal_format.value,'Пожелания: '+f.elements.oem_wishes.value,'Страница: '+location.href.split('#')[0]].join('\n')}f.addEventListener('input',prepare);f.addEventListener('change',prepare);prepare();})();'''
    script+='\n'+(ROOT/'scripts/mitsubishi-native-form-adapter.js').read_text()
    (directory/'tilda-interactions.js').write_text(script)
    fragment=f'<link rel="stylesheet" href="{HOST}/{slug}/tilda-scoped.css?v=20261020-4"><div id="ast-mitsubishi-oem" data-model="{fields["model_id"]}">'+header+nav+''.join(panels)+form+footer+'</div>'+f'<script src="{HOST}/{slug}/tilda-interactions.js?v=20261020-4"></script>'
    if slug == 'asx':
        fragment = '<style data-ast-asx-annotation="20261020">'+ASX_ANNOTATION_CSS+'</style>'+fragment
    fragment = '<style data-ast-mobile-layout="20261021b">'+MOBILE_LAYOUT_CSS+'</style>'+fragment
    if slug == 'asx':
        fragment = '<style data-ast-asx-mobile-polish="20261021">'+ASX_MOBILE_POLISH_CSS+'</style>'+fragment
    if slug == 'asx':
        fragment = '<style data-ast-asx-first-divider="20261022">'+ASX_FIRST_DIVIDER_CSS+'</style>'+fragment
    fragment = on_tilda_cdn(fragment)
    storage = CDN_MANIFEST.get('storage_records', {}).get(slug, [])
    if storage:
        fragment = '<style>'+','.join('#'+record for record in storage)+'{display:none!important}</style>'+fragment
    if CDN_URLS:
        fragment = fragment.replace('v=20261020-4', 'v=20261021-asx3' if slug == 'asx' else 'v=20261021-mobile2')
    (directory/'tilda-fragment.txt').write_text(fragment)
    out=ROOT/('mitsubishi-'+slug);out.mkdir(exist_ok=True)
    canonical='https://avtonds.ru/mitsubishi-'+slug
    (out/'index.html').write_text('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mitsubishi '+model+' — комплектации и поставка | AST</title><link rel="canonical" href="'+canonical+'"><meta name="description" content="Mitsubishi '+model+': дизайн, оснащение и комплектации. Расчёт поставки в Россию от AST для частного клиента или компании."></head><body>'+fragment+'</body></html>')
    print(slug,'fragment_bytes',len(fragment.encode()),'css_bytes',len(stylesheet.encode()))
