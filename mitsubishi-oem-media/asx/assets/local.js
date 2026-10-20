document.querySelectorAll('[data-slide-index]').forEach(a=>{a.addEventListener('click',e=>{e.preventDefault();const i=Number(a.dataset.slideIndex);document.querySelectorAll('.bxslider01>li').forEach((li,n)=>li.style.display=n===i?'block':'none');document.querySelectorAll('[data-slide-index]').forEach(x=>x.classList.toggle('active',x===a))})});document.querySelector('[data-slide-index="0"]')?.click();

document.querySelector('.video-poster')?.addEventListener('click',function(){const f=this.parentNode.querySelector('iframe');f.src=f.dataset.src+'&autoplay=1';f.hidden=false;this.remove()});
