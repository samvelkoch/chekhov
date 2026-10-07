/* ---------- живой портрет: ролик на первом экране ----------
   В покое на листе лежит постер (картинка). Ролик не зациклен: он играет один раз, когда портрет впервые
   попал в зону видимости, и потом снова — при наведении мыши, при тапе и при прокрутке, пока портрет на экране.
   Ролик, который уже играет, не перезапускается. После конца прокрутка может запустить его снова только
   через GAP мс. Первый кадр ролика — постер, последний почти совпадает с ним (отличается шумом сжатия), поэтому по концу ролик за ~0,2 с растворяется над постером.
   При prefers-reduced-motion ролик не создаётся (он лежит в <template>) и не загружается. */
(function(){
  var fig=document.getElementById('lp'), tpl=document.getElementById('lp-video');
  if(!fig||!tpl||!tpl.content||!window.IntersectionObserver) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduce.matches) return;

  var GAP=2000, SEEN=0.35;                 // пауза после конца и доля портрета в кадре, с которой он «в зоне видимости»
  var art=fig.querySelector('.lp-art');
  var v=document.importNode(tpl.content,true).firstElementChild;
  v.muted=true; v.defaultMuted=true; v.playsInline=true;
  art.appendChild(v);

  var inView=false, playing=false, firstDone=false, endedAt=-1e9;
  function now(){ return performance.now(); }

  function play(){
    if(playing||document.hidden||reduce.matches) return;
    playing=true;
    try{ if(v.ended||v.currentTime>0.001) v.currentTime=0; }catch(e){}
    var p=v.play();
    if(p&&p.catch) p.catch(function(){ playing=false; });
  }
  function stop(){                         // портрет ушёл с экрана: назад на первый кадр, он же постер
    if(!playing&&!v.currentTime) return;
    playing=false; endedAt=now();
    v.classList.remove('on');
    try{ v.pause(); v.currentTime=0; }catch(e){}
  }

  // видео показывается над постером только пока играет; по окончании плавно уходит в прозрачность над постером
  v.addEventListener('playing',function(){ v.classList.add('on'); });
  v.addEventListener('ended',function(){ playing=false; endedAt=now(); v.classList.remove('on'); });
  v.addEventListener('pause',function(){ if(!v.ended) playing=false; });

  // следить за портретом начинаем, когда страница дособрана (тексты первого экрана уже вставлены и не сдвинут портрет вниз);
  // ролик при этом начинает грузиться сразу
  var io=new IntersectionObserver(function(es){
    var e=es[es.length-1]; inView=e.isIntersecting&&e.intersectionRatio>=SEEN;
    if(inView&&!firstDone&&!document.hidden){ firstDone=true; play(); }
    if(!inView) stop();
  },{threshold:[0,SEEN,0.6,1]});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ io.observe(fig); });
  else io.observe(fig);

  var tick=false;
  addEventListener('scroll',function(){
    if(tick) return; tick=true;
    requestAnimationFrame(function(){ tick=false;
      if(inView&&!playing&&now()-endedAt>=GAP) play(); });
  },{passive:true});

  fig.addEventListener('pointerenter',function(e){ if(e.pointerType==='mouse') play(); });
  fig.addEventListener('click',play);

  var onReduce=function(){ if(reduce.matches) stop(); };
  if(reduce.addEventListener) reduce.addEventListener('change',onReduce); else if(reduce.addListener) reduce.addListener(onReduce);
})();
