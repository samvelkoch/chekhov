/* ================= утилиты ================= */
const $ = s => document.querySelector(s);
const fmt = n => Number(n).toLocaleString('ru-RU');
const fmt1 = n => Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});
const fmt2 = n => Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
/* Склонение по числу. plural(n,['письмо','письма','писем']): 1, 21… (кроме 11) — первая форма; 2–4, 22–24… (кроме 12–14) — вторая; остальные и 11–14 — третья.
   Две формы ['ед.','мн.'] — для косвенных падежей («из 21 стихотворения», «в 22 стихотворениях», «длиннее 42 слов»).
   Четвёртая форма (необязательно) — для дробных чисел, по умолчанию вторая («2,7 слова»). dec — сколько знаков после запятой видно на странице.
   Старая запись plural(n,'письмо','письма','писем') тоже работает (число округляется). */
const plural=(n,a,b,c)=>{ let f=a,dec=b; if(!Array.isArray(a)){ f=[a,b,c]; dec=0; } let x=Math.abs(+n); if(dec!=null){ const k=10**dec; x=Math.round(x*k)/k; }
  if(!Number.isInteger(x)) return f.length===2?f[0]:(f[3]||f[1]);
  const d=x%10, h=x%100; if(d===1&&h!==11) return f[0];
  return f.length===2?f[1]:(d>=2&&d<=4&&(h<12||h>14)?f[1]:f[2]); };
const pn=(n,a,b,c)=>`${(Array.isArray(a)&&b===1?fmt1:fmt)(n)} ${plural(n,a,b,c)}`;
const pnr=(n,f)=>`${n} ${plural(n,f)}`;
const NS = 'http://www.w3.org/2000/svg';
let TK={}; const css = v => (v in TK) ? TK[v] : (TK[v]=getComputedStyle(document.documentElement).getPropertyValue(v).trim());
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s).toLowerCase().replace(/ё/g,'е').trim();
function el(tag, attrs={}, parent){ const e=document.createElementNS(NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
function txt(parent, x, y, s, attrs={}){ const t=el('text',{x,y,...attrs},parent); t.textContent=s; return t; }
function svg(box, h){ box.innerHTML=''; const w=Math.max(260, box.clientWidth); const s=el('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img'}); box.appendChild(s); return [s,w]; }
function niceMax(v){ if(v<=0) return 1; const p=Math.pow(10,Math.floor(Math.log10(v))); const m=v/p; return (m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10)*p; }
function ticks(max,n=4){ const step=niceMax(max/n); const out=[]; for(let v=0; v<=max+1e-9; v+=step) out.push(+v.toFixed(6)); return out; }
function hexRGB(c){ c=c.trim(); if(c.startsWith('rgb')) return c.match(/\d+/g).slice(0,3).map(Number); c=c.replace('#',''); if(c.length===3) c=c.split('').map(x=>x+x).join(''); return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16)); }
function mixc(a,b,t){ const A=hexRGB(a), B=hexRGB(b); return `rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`; }
function lum(c){ const [r,g,b]=hexRGB(c).map(v=>{v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)}); return .2126*r+.7152*g+.0722*b; }
function table(box, head, rows){
  const old=box.nextElementSibling; if(old && old.classList && old.classList.contains('data')) old.remove();
  const d=document.createElement('details'); d.className='data'; d.innerHTML='<summary>Таблица данных</summary>';
  const t=document.createElement('div'); t.className='tbl';
  t.innerHTML='<table><thead><tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+r.map(c=>`<td>${typeof c==='number'?fmt1(c):esc(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  d.appendChild(t); box.after(d);
}
const RB=new Map(), RA=[]; const Q=[]; let pumping=false, booted=false;
function pump(){ const t=performance.now(); while(Q.length && performance.now()-t<12){ const f=Q.shift(); try{ f(); }catch(err){ console.error(err); } }
  if(Q.length) setTimeout(pump,0); else { pumping=false; booted=true; } }
function enqueue(fn){ if(Q.indexOf(fn)<0) Q.push(fn); if(!pumping){ pumping=true; setTimeout(pump,0); } }
function chart(fn, box){ if(box) RB.set(box,fn); else RA.push(fn); if(booted){ try{ fn(); }catch(err){ console.error(err); } } else enqueue(fn); return fn; }
function rerenderAll(){ TK={}; for(const [b,f] of RB){ if(!b.isConnected){ RB.delete(b); continue; } enqueue(f); } RA.forEach(enqueue); }
function seg(host, opts, val, on){
  host.innerHTML=''; host.className='seg'; host.setAttribute('role','group');
  opts.forEach(([v,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.setAttribute('aria-pressed', String(v===val));
    b.addEventListener('click',()=>{ host.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', String(x===b))); on(v); }); host.appendChild(b); });
}

/* ================= подсказка ================= */
const tip=$('#tip');
function placeTip(x,y){ const r=tip.getBoundingClientRect(); let X=x+14, Y=y+14;
  if(X+r.width>innerWidth-8) X=x-r.width-14; if(Y+r.height>innerHeight-8) Y=y-r.height-14; tip.style.left=Math.max(4,X)+'px'; tip.style.top=Math.max(4,Y)+'px'; }
function showTipHTML(html,x,y){ tip.innerHTML=html; tip.hidden=false; placeTip(x,y); }
document.addEventListener('pointermove',e=>{ const t=e.target.closest && e.target.closest('[data-tip]'); if(t){ showTipHTML(t.getAttribute('data-tip'),e.clientX,e.clientY); } else if(!e.target.closest || !e.target.closest('canvas')) tip.hidden=true; });
document.addEventListener('pointerdown',e=>{ const t=e.target.closest && e.target.closest('[data-tip]'); if(t) showTipHTML(t.getAttribute('data-tip'),e.clientX,e.clientY); });
document.addEventListener('scroll',()=>{ tip.hidden=true; },{passive:true});

/* ================= примитивы графиков ================= */
function hbars(box, rows, {color='var(--s1)', unit='', labelW=150, swatch=false, rowH=24, onClick=null, fmtv=fmt1, minW=260}={}){
  return chart(()=>{ if(!rows.length){ box.innerHTML=''; return; }
    const h=rows.length*rowH+24; const [s,w]=svg(box,h); const max=niceMax(Math.max(...rows.map(r=>r.v),1e-9));
    const x0=labelW+(swatch?18:0), x1=w-50; const sc=v=>x0+(x1-x0)*v/max;
    const ax=el('g',{class:'ax'},s);
    ticks(max,4).forEach(t=>{ el('line',{x1:sc(t),x2:sc(t),y1:0,y2:h-20,stroke:css('--grid')},ax); txt(ax,sc(t),h-6,fmt(t),{'text-anchor':'middle'}); });
    rows.forEach((r,i)=>{ const y=i*rowH+4, bh=rowH-9;
      const clk=onClick&&r.click!==false;
      txt(s,labelW-8,y+bh-1,r.l,{'text-anchor':'end',style:`font-family:var(--f-body);font-size:13.5px;fill:var(--ink)${clk?';text-decoration:underline dotted':''}`});
      if(swatch) el('rect',{x:labelW+2,y:y+1,width:11,height:11,rx:2,fill:r.hex,stroke:css('--ring'),'stroke-width':1},s);
      el('rect',{x:x0,y,width:Math.max(1,sc(r.v)-x0),height:bh,rx:3,fill:r.c||color},s);
      txt(s,sc(r.v)+6,y+bh-2,fmtv(r.v)+unit);
      const hit=el('rect',{class:'hit'+(clk?' clickable':''),x:0,y:y-3,width:w,height:rowH,'data-tip':r.tip||`${esc(r.l)}: ${fmtv(r.v)}${unit}`},s);
      if(clk){ hit.setAttribute('tabindex','0'); hit.setAttribute('role','button'); hit.setAttribute('aria-label',r.l);
        hit.addEventListener('click',()=>onClick(r)); hit.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onClick(r);} }); }
    });
    el('line',{x1:x0,x2:x0,y1:0,y2:h-20,stroke:css('--axis')},s);
  }, box);
}
function vbars(box, rows, {h=220, color='var(--s1)', every=1, notes=[], fmtv=fmt1}={}){
  return chart(()=>{
    const [s,w]=svg(box,h); const L=40,R=8,T=24,B=26; const max=niceMax(Math.max(...rows.map(r=>r.v),1e-9));
    const bw=(w-L-R)/rows.length; const sy=v=>h-B-(h-B-T)*v/max;
    const ax=el('g',{class:'ax'},s);
    ticks(max,4).forEach(t=>{ el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmtv(t),{'text-anchor':'end'}); });
    notes.forEach(n=>{ const i=rows.findIndex(r=>r.l==n.at); if(i<0) return; const x=L+bw*i+bw/2;
      el('line',{x1:x,x2:x,y1:T-8,y2:h-B,stroke:css('--muted'),'stroke-dasharray':'2 3'},s);
      txt(s,x+4,T-12+(n.dy||0),n.t,{style:'fill:var(--ink-2);font-size:11px'}); });
    rows.forEach((r,i)=>{ const x=L+bw*i+1, bh=h-B-sy(r.v);
      if(r.v>0) el('rect',{x,y:sy(r.v),width:Math.max(1,bw-2),height:bh,rx:Math.min(3,bw/3),fill:r.c||color},s);
      if(r.lab) txt(s,x+bw/2-1,sy(r.v)-5,r.lab,{'text-anchor':'middle',style:'font-size:10.5px;fill:var(--ink)'});
      if(i%every===0) txt(ax,x+bw/2-1,h-8,r.l,{'text-anchor':'middle'});
      el('rect',{class:'hit',x:x-1,y:T,width:bw,height:h-B-T,'data-tip':r.tip||`${esc(r.l)}: ${fmtv(r.v)}`},s); });
    el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s);
  }, box);
}
function dots(box, rows, {h=200, min=null, max=null, ref=null, refLabel='', fmtv=fmt1, range=false, color='var(--s1)', unit='', steps=4, refLeft=false, labels=null}={}){
  return chart(()=>{
    const [s,w]=svg(box,h); const L=44,R=14,T=16,B=28;
    const vals=rows.flatMap(r=>range?[r.q1,r.q3,r.v]:[r.v]).concat(ref!=null?[ref]:[]);
    const lo=min!=null?min:Math.min(...vals)*0.9, hi=max!=null?max:(min===0?niceMax(Math.max(...vals)*1.04):Math.max(...vals)*1.06);
    const sy=v=>h-B-(h-B-T)*(v-lo)/(hi-lo); const bw=(w-L-R)/rows.length;
    const ax=el('g',{class:'ax'},s);
    for(let k=0;k<=steps;k++){ const v=lo+(hi-lo)*k/steps; el('line',{x1:L,x2:w-R,y1:sy(v),y2:sy(v),stroke:css('--grid')},ax); txt(ax,L-6,sy(v)+4,fmtv(v),{'text-anchor':'end'}); }
    if(ref!=null){ el('line',{x1:L,x2:w-R,y1:sy(ref),y2:sy(ref),stroke:css('--s2'),'stroke-width':2,'stroke-dasharray':'5 4'},s);
      txt(s,refLeft?L+4:w-R,sy(ref)-6,refLabel,{'text-anchor':refLeft?'start':'end',style:'fill:var(--ink-2)'}); }
    const pts=[];
    rows.forEach((r,i)=>{ const x=L+bw*i+bw/2; pts.push([x,sy(r.v)]);
      if(range) el('line',{x1:x,x2:x,y1:sy(r.q1),y2:sy(r.q3),stroke:css('--s1'),'stroke-width':3,'stroke-linecap':'round',opacity:.45},s);
      txt(ax,x,h-8,r.l,{'text-anchor':'middle'}); });
    if(!range) el('polyline',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':2},s);
    rows.forEach((r,i)=>{ const [x,y]=pts[i];
      el('circle',{cx:x,cy:y,r:5,fill:color,stroke:css('--surface'),'stroke-width':2},s);
      if(labels===true || (labels===null && rows.length<=14)) txt(s,x+9,y-7,fmtv(r.v)+unit,{style:'fill:var(--ink)'});
      el('rect',{class:'hit',x:x-bw/2,y:T,width:bw,height:h-B-T,'data-tip':r.tip||`${esc(r.l)}: ${fmtv(r.v)}${unit}`},s); });
  }, box);
}
function heatTable(box, rowLabels, colLabels, M, {fmtv=fmt1, cellH=28, labelW=150, tipf=null, onRow=null, active=null, colorf=null, colTint=null}={}){
  return chart(()=>{
    const topH=30; const h=topH+rowLabels.length*cellH+4; const [s,w]=svg(box,h); const cw=(w-labelW)/colLabels.length;
    const flat=M.flat().filter(v=>v!=null); const mx=Math.max(...flat,1e-9); const darkTheme=lum(css('--surface'))<0.2;
    const lo=css('--heat-lo'), hi=css('--heat-hi');
    colLabels.forEach((c,j)=>txt(s,labelW+cw*j+cw/2,topH-10,c,{'text-anchor':'middle',style:`fill:var(${colTint&&colTint(j)||'--muted'})`}));
    rowLabels.forEach((r,i)=>{ const y=topH+i*cellH;
      const lab=txt(s,labelW-8,y+cellH/2+4,r,{'text-anchor':'end',style:`font-family:var(--f-body);font-size:13.5px;fill:var(${active===i?'--accent':'--ink'});${active===i?'font-weight:600;':''}${onRow?'text-decoration:underline dotted;':''}`});
      if(onRow){ const hit=el('rect',{class:'hit clickable',x:0,y,width:labelW,height:cellH,tabindex:0,role:'button','aria-label':r},s);
        hit.addEventListener('click',()=>onRow(i)); hit.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onRow(i);} }); }
      colLabels.forEach((c,j)=>{ const v=M[i][j]; const x=labelW+cw*j;
        const fill=colorf?colorf(v,i,j):mixc(lo,hi,Math.sqrt((v||0)/mx));
        el('rect',{x:x+1,y:y+1,width:cw-2,height:cellH-2,rx:2,fill,'data-tip':tipf?tipf(i,j):`${esc(r)} · ${esc(c)}: ${fmtv(v)}`},s);
        const ink=lum(fill)<0.33?'--heat-ink-hi':'--heat-ink-lo';
        const inkVar = darkTheme ? (lum(fill)>0.33?'--heat-ink-hi':'--heat-ink-lo') : ink;
        txt(s,x+cw/2,y+cellH/2+4,fmtv(v),{'text-anchor':'middle',style:`pointer-events:none;font-size:11px;fill:var(${inkVar})`}); }); });
  }, box);
}

