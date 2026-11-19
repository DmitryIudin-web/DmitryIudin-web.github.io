const root=document.querySelector('#app');
const content=await fetch('./content.json').then(r=>{if(!r.ok)throw Error('Missing content');return r.json();});
const setScale=()=>{document.documentElement.style.fontSize=document.documentElement.clientWidth/10+'px';};
setScale();addEventListener('resize',setScale);
const q=(s,e=root)=>e.querySelector(s),qa=(s,e=root)=>[...e.querySelectorAll(s)];
function actionable(element,handler,label){if(!element)return;element.tabIndex=0;element.setAttribute('role','button');if(label)element.setAttribute('aria-label',label);element.addEventListener('click',handler);element.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();handler(e);}});}
function rich(el,value){if(!el)return;el.innerHTML=value||'';}
let specsDialog, specificationsReady;
function specificationText(element,value){
 const template=document.createElement('template');template.innerHTML=String(value??'');
 const clean=node=>{if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent);const allowed=['BR','SUP','STRONG','B','EM'];const result=node.nodeType===Node.ELEMENT_NODE&&allowed.includes(node.tagName)?document.createElement(node.tagName.toLowerCase()):document.createDocumentFragment();for(const child of node.childNodes)result.append(clean(child));return result;};
 element.replaceChildren(clean(template.content));
}
function renderSpecifications(dialog,data){
 const destination=q('.specification-groups',dialog);destination.replaceChildren();let rowIndex=0;
 const node=(name,classes,parent,scope='71289960')=>{const element=document.createElement(name);element.className=classes;element.setAttribute('data-v-'+scope,'');parent.append(element);return element;};
 const heading=(parent,classes,value,tooltip)=>{const element=node('div',classes,parent);specificationText(element,value);if(tooltip){element.title=tooltip;element.tabIndex=0;}return element;};
 const renderRows=(parent,rows=[])=>{if(!rows.length)return;const list=node('div','parameterList',parent);list.setAttribute('data-v-dbb489d0','');for(const source of rows){if(source.productList.length!==data.modelList.length)throw Error('Incomplete specification row');const row=node('div','parameterList-item',list,'dbb489d0');row.dataset.sourceRow=String(rowIndex++);const name=node('div','name',row,'dbb489d0');heading(name,'el-tooltip',source.productName,source.tooltip);heading(name,'desc',source.productDesc);const values=node('div','value',row,'dbb489d0');for(const value of source.productList){const cell=node('div','value-item',values,'dbb489d0');specificationText(node('div','',cell,'dbb489d0'),value);}}};
 const renderImages=(parent,images=[])=>{if(!images.length)return;const gallery=node('div','spec-option-images',parent);for(const source of images){const figure=node('figure','',gallery);if(source.imageUrl?.startsWith('./media/')){const image=node('img','',figure);image.src=source.imageUrl;image.alt=source.imageName||'ZEEKR 9X';image.loading='lazy';}else heading(figure,'source-gap-media','source_gap: изображение опции недоступно');heading(figure,'spec-image-name',source.imageName);heading(figure,'spec-image-description',source.imageSubName);}};
 const renderChildren=(parent,children=[],depth=2)=>{for(const child of children){const level=node('div',depth===2?'second-level':'third-level',parent);const title=child.secondLevelTitle||child.thirdLevelTitle;if(title)heading(level,depth===2?'second-level-title':'third-level-title',title,child.tooltip);renderImages(level,child.imageList);renderRows(level,child.parameterList);renderChildren(level,child.children,depth+1);}};
 data.configList.forEach((source,index)=>{const section=node('div','first-level first-level-'+index,destination);section.id='spec-group-'+index;const title=node('div','first-level-title',section);heading(title,'el-tooltip',source.firstLevelTitle||source.name,source.tooltip);for(const [index,label] of ['Свернуть раздел','Развернуть раздел'].entries()){const button=node('button','icon_collapse_expand',title);button.type='button';button.textContent=index?'＋':'−';button.setAttribute('aria-label',label);if(index)button.style.display='none';}const body=node('div','config-item',section);renderImages(body,source.imageList);renderRows(body,source.parameterList);renderChildren(body,source.children);});
 const footnotes=node('div','spec-footnotes',destination);for(const tip of data.tipsList||[])heading(footnotes,'spec-footnote',tip);
 dialog.dataset.specificationRows=String(rowIndex);dialog.dataset.specificationGroups=String(data.configList.length);
}
async function prepareSpecifications(){
 if(!specsDialog){
  const read=url=>fetch(url).then(r=>{if(!r.ok)throw Error('Missing specification resource: '+url);return r;});
  const [markup,data]=await Promise.all([read('./specifications.html').then(r=>r.text()),read('./specification-data.json').then(r=>r.json())]);
  specsDialog=document.createElement('dialog');specsDialog.className='specs-dialog';
  specsDialog.innerHTML='<button class="dialog-close" type="button">Закрыть характеристики</button><h2>Характеристики ZEEKR 9X</h2><p>Рынок Китая · данные производителя на 3 октября 2026 года. Для сравнения версий прокрутите таблицу по горизонтали.</p><div class="spec-scroll">'+markup+'</div>';
  document.body.append(specsDialog);q('.dialog-close',specsDialog).addEventListener('click',()=>specsDialog.close());
  renderSpecifications(specsDialog,data);
  const rows=qa('.parameterList-item',specsDialog),filters=qa('.screenner-item',specsDialog);let filter=0;
  rows.forEach(row=>{const values=qa('.value-item',row);row.dataset.same=String(values.every(v=>v.innerHTML===values[0].innerHTML));});
  const applyFilter=n=>{filter=filter===n?0:n;filters.forEach((f,i)=>{f.setAttribute('aria-pressed',String(filter===i+1));f.classList.toggle('selected',filter===i+1);});
   rows.forEach(row=>{const values=qa('.value-item',row),same=row.dataset.same==='true';row.hidden=filter===1&&same;
    values.forEach(v=>{const highlight=filter===2&&!same||filter===3&&v.textContent.trim().startsWith('○');const child=v.firstElementChild;if(child){child.classList.toggle('high-light',highlight);child.style.opacity=filter>1&&!highlight?'.4':'1';}});
   });
  };filters.forEach((f,i)=>actionable(f,()=>applyFilter(i+1)));
  qa('.point-item',specsDialog).forEach((el,i)=>actionable(el,()=>{q('#spec-group-'+i,specsDialog).scrollIntoView({block:'start',behavior:reduced.matches?'instant':'smooth'});qa('.point-item',specsDialog).forEach((e,j)=>e.classList.toggle('point-item-active',i===j));}));
  qa('.first-level',specsDialog).forEach(section=>qa('.icon_collapse_expand',section).forEach(icon=>actionable(icon,()=>{const area=q('.config-item',section),hidden=!area.classList.contains('config-hide');area.classList.toggle('config-hide',hidden);qa('.icon_collapse_expand',section).forEach((e,i)=>e.style.display=(hidden?i===1:i===0)?'':'none');})));
 }
}
async function openSpecifications(){
 if(!specificationsReady)specificationsReady=prepareSpecifications().catch(error=>{specsDialog?.remove();specsDialog=undefined;specificationsReady=undefined;throw error;});
 await specificationsReady;if(!specsDialog.open)specsDialog.showModal();
}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const expandedPlayer=document.createElement('dialog');
expandedPlayer.className='expanded-player';
const closePlayer=document.createElement('button');closePlayer.type='button';closePlayer.textContent='Закрыть видео';
expandedPlayer.append(closePlayer);document.body.append(expandedPlayer);
closePlayer.addEventListener('click',()=>expandedPlayer.close());
expandedPlayer.addEventListener('close',()=>{const player=expandedPlayer.querySelector('video');player?.pause();player?.remove();});
function expandVideo(v){
 v.dataset.fullscreenAttempt='requested';
 v.requestFullscreen?.().then(()=>{v.dataset.fullscreenAttempt=document.fullscreenElement?'native':'fallback';if(!document.fullscreenElement)openLargePlayer(v);}).catch(()=>{v.dataset.fullscreenAttempt='fallback';openLargePlayer(v);});
 if(!v.requestFullscreen)openLargePlayer(v);
}
function openLargePlayer(v){
 if(expandedPlayer.open)return;v.pause();const player=v.cloneNode(true);player.controls=true;player.muted=v.muted;
 expandedPlayer.append(player);expandedPlayer.showModal();player.play().catch(()=>{});
}
const actions = {
 quote: () => window.ast9xQuote(),
 specs: openSpecifications
};
qa('[data-action]').forEach(el=>actionable(el,actions[el.dataset.action]));
qa('[data-anchor]').forEach(el=>actionable(el,()=>q('#section-'+el.dataset.anchor)?.scrollIntoView({behavior:reduced.matches?'instant':'smooth'})));
const nav=q('.navigation');
let scheduled=false;
const updateNav=()=>{scheduled=false;nav.classList.toggle('scrolled',scrollY>innerWidth/192);for(const el of qa('[data-anchor]')){const box=q('#section-'+el.dataset.anchor)?.getBoundingClientRect();el.classList.toggle('active',box&&box.top<innerHeight*.4&&box.bottom>0);}};
addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateNav);}}, {passive:true});updateNav();
function activePanel(section,index){
 const panels=qa('.container > .bg',section);panels.forEach((p,i)=>{p.classList.toggle('active',i===index);p.setAttribute('aria-hidden',String(i!==index));});
}
for(const section of qa('[data-section]')){
 if(!q('.bg.active',section)&&q('.bg',section))q('.bg',section).classList.add('active');
 const source=content.sections[Number(section.dataset.section)]?.source||{};
 let list=source.list?.length>1?source.list:source.list2?.length?source.list2:source.list4?.length?source.list4:source.list5;
 const tabs=qa('.tabs-item,.c-tabs-item',section).filter(el=>!el.closest('.sequence-frames'));
 if(tabs.length&&list?.length){
  const select=i=>{tabs.forEach((t,j)=>{t.classList.toggle('active',j===i);t.setAttribute('aria-pressed',String(j===i));});activePanel(section,i);const item=list[i];
    const target=q('.tabs-content',section)||q('.tabs-4',section);
    if(target){rich(q('.sub-title',target),item.name||item.subTitle);rich(q('.sub-desc',target),item.desc||item.subDesc);let tips=q('.sub-tips',target);if(!tips&&(item.tips||item.subTips)){tips=document.createElement('div');tips.className='sub-tips';target.append(tips);}rich(tips,item.tips||item.subTips);}
    const fg=q('.content-bg',section);if(fg&&item.contentImgUrl){let image=q('img',fg);if(!image){image=document.createElement('img');fg.append(image);}image.src=item.contentImgUrl;image.alt=item.subTitle||'ZEEKR 9X';}
  };
  tabs.forEach((t,i)=>actionable(t,()=>select(i),list[i]?.name||list[i]?.subTitle));select(0);
 }
 const swiper=q('.swiper-a',section);
 if(swiper){const container=q('.swiper',swiper),wrapper=q('.swiper-wrapper',swiper),slides=qa('.swiper-slide',swiper);let index=0;
  const move=(direction)=>{index=Math.max(0,Math.min(slides.length-1,index+direction));const offset=index===0?0:slides[index].offsetLeft-slides[0].offsetLeft;wrapper.style.transform=`translate3d(${-offset}px,0,0)`;slides.forEach((s,i)=>{s.classList.toggle('swiper-slide-active',i===index);s.setAttribute('aria-current',String(i===index));});};
  let left=q('.icon-left',swiper),right=q('.icon-right',swiper);
  if(!right){right=document.createElement('button');right.className='gallery-next';right.textContent='›';q('.container',swiper).append(right);}
  actionable(left,()=>move(-1),'Предыдущий кадр');actionable(right,()=>move(1),'Следующий кадр');container.tabIndex=0;container.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}});
  let x;container.addEventListener('pointerdown',e=>{x=e.clientX;});container.addEventListener('pointerup',e=>{if(x!==undefined&&Math.abs(e.clientX-x)>35)move(e.clientX<x?1:-1);x=undefined;});move(0);
 }
}
const sequence=q('.sequence-frames');
if(sequence){const canvas=q('canvas',sequence),ctx=canvas.getContext('2d'),area=q('.hover_area_top',sequence);let color=0,frame=content.sequence.frameIndex||0,request=0;const cache=new Map();
 const draw=()=>{const key=content.sequence.imgData[color].color+'_'+frame,src=content.frames[key];const id=++request;if(!src){canvas.dataset.sourceGap='OEM frame unavailable';ctx.clearRect(0,0,canvas.width,canvas.height);return;}let image=cache.get(key);if(!image){image=new Image();image.src=src;cache.set(key,image);}const paint=()=>{if(id!==request)return;delete canvas.dataset.sourceGap;canvas.width=Math.round(canvas.clientWidth*devicePixelRatio);canvas.height=Math.round(canvas.clientHeight*devicePixelRatio);const ratio=Math.max(canvas.width/image.width,canvas.height/image.height);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,(canvas.width-image.width*ratio)/2,(canvas.height-image.height*ratio)/2,image.width*ratio,image.height*ratio);canvas.dataset.color=content.sequence.imgData[color].color;canvas.dataset.frame=String(frame);};if(image.complete&&image.naturalWidth)paint();else image.onload=paint;};
 qa('.tabs-item',sequence).forEach((el,i)=>actionable(el,()=>{color=i;qa('.tabs-item',sequence).forEach((e,j)=>e.classList.toggle('active',i===j));rich(q('.sub-title',sequence),content.sequence.imgData[i].name);rich(q('.sub-desc',sequence),content.sequence.imgData[i].desc);draw();},content.sequence.imgData[i].name));
 let dragX;area.style.touchAction='pan-y';area.addEventListener('pointerdown',e=>{dragX=e.clientX;area.setPointerCapture(e.pointerId);});area.addEventListener('pointermove',e=>{if(dragX===undefined)return;const delta=e.clientX-dragX;if(Math.abs(delta)>=20){const count=content.sequence.imgData[color].imgNumber;frame=(frame+(delta>0?-1:1)+count)%count;dragX=e.clientX;draw();}});area.addEventListener('pointerup',()=>dragX=undefined);area.addEventListener('pointercancel',()=>dragX=undefined);area.tabIndex=0;area.setAttribute('role','slider');area.setAttribute('aria-label','360° кузова: стрелки влево и вправо');area.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();frame=(frame+(e.key==='ArrowRight'?1:-1)+36)%36;draw();}});addEventListener('resize',draw);draw();
}
const videos=qa('video').filter(v=>v.querySelector('source[src]'));
const inView=new Set(),manualPaused=new WeakSet();
videos.forEach(v=>{v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='none';if(!v.poster&&content.videoPosters[v.querySelector('source')?.getAttribute('src')])v.poster=content.videoPosters[v.querySelector('source')?.getAttribute('src')];
 const controls=document.createElement('div');controls.className='media-controls';for(const [label,fn] of [['Воспроизвести / пауза',()=>{if(v.paused){manualPaused.delete(v);v.play().catch(()=>{controls.dataset.error='Видео не удалось запустить';});}else{manualPaused.add(v);v.pause();}}],['Звук',()=>v.muted=!v.muted],['На весь экран',()=>expandVideo(v)]]){const b=document.createElement('button');b.type='button';b.textContent=label;actionable(b,fn);controls.append(b);}v.parentElement.append(controls);v.addEventListener('error',()=>{controls.dataset.error='source_gap: ошибка воспроизведения OEM-видео';});
});
const videoObserver=new IntersectionObserver(entries=>{for(const entry of entries){const v=entry.target;if(entry.isIntersecting)inView.add(v);else inView.delete(v);const panel=v.closest('.bg');const visible=entry.isIntersecting&&(!panel||panel.classList.contains('active'))&&!document.hidden;if(visible&&!reduced.matches&&!manualPaused.has(v))v.play().catch(()=>{});else v.pause();}},{threshold:.25});videos.forEach(v=>videoObserver.observe(v));
const stateObserver=new MutationObserver(()=>{videos.forEach(v=>{const p=v.closest('.bg');if(p&&!p.classList.contains('active'))v.pause();else if(inView.has(v)&&!manualPaused.has(v)&&!reduced.matches&&!document.hidden)v.play().catch(()=>{});});});stateObserver.observe(root,{attributes:true,subtree:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)videos.forEach(v=>v.pause());});
document.querySelector('#mobile-menu').addEventListener('click', event => {
 const menu = q('.navigation-car');
 const open = menu.classList.toggle('mobile-open');
 event.currentTarget.setAttribute('aria-expanded', String(open));
});
qa('[data-anchor]').forEach(el => el.addEventListener('click', () => {
 q('.navigation-car').classList.remove('mobile-open');
 document.querySelector('#mobile-menu').setAttribute('aria-expanded', 'false');
}));
qa('img').forEach(img=>{if(!img.alt)img.alt=img.closest('[data-section]')?.querySelector('.title,.top-desc')?.textContent.trim()||'ZEEKR 9X';});
