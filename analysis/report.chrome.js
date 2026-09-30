/* ================= навигация по частям ================= */
const TABS=[...document.querySelectorAll('.tabs button')], TABBOX=document.querySelector('.tabs');
const calmMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function goTo(id){ const t=document.getElementById(id); if(!t) return;
  t.scrollIntoView({behavior:calmMotion()?'auto':'smooth',block:'start'});
  try{ history.replaceState(null,'','#'+id); }catch(e){} }
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('.tabs button'); if(b){ goTo(b.dataset.part); return; }
  const a=e.target.closest&&e.target.closest('a[href^="#"]'); if(a){ const id=a.getAttribute('href').slice(1); if(document.getElementById(id)){ e.preventDefault(); goTo(id); } } });
function markSpy(sec){
  document.querySelectorAll('.rail a').forEach(a=>a.classList.toggle('on',a.getAttribute('href')==='#'+sec.id));
  const part=sec.closest('.part')?sec.closest('.part').id:'part-obzor';
  TABS.forEach(b=>{ const on=b.dataset.part===part; b.setAttribute('aria-current',String(on));
    if(on&&TABBOX.scrollWidth>TABBOX.clientWidth) TABBOX.scrollTo({left:b.offsetLeft-TABBOX.clientWidth/2+b.offsetWidth/2,behavior:'auto'}); });
}
const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) markSpy(e.target); }),{rootMargin:'-20% 0px -70% 0px'});
document.querySelectorAll('.content section, header.hero').forEach(s=>io.observe(s));
