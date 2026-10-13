/* хордовая диаграмма связей: имена по кругу (сгруппированы по кругам имён), ленты — общие абзацы/строфы.
   chordNet(box, nodes, edges, {pick(i|null), hover(i|null)}) → {apply({foc, sel, on(i), tip(i)})} */
function chordNet(box, NOD, EDG, o){
  const Wd=box.clientWidth||800, mob=innerWidth<600, h=mob?Wd+60:Math.round(Math.min(Wd,760)); const [s,w]=svg(box,h);
  const fs=mob?10.5:11.5, th=mob?8:11, cx=w/2, cy=h/2, R=Math.min(w,h-(mob?60:0))/2-(mob?54:92), N=NOD.length, TAU=2*Math.PI;
  const P=(a,r)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)], f1=v=>v.toFixed(1);
  // связи сети + у каждого имени его ближайшие соседи (nb): иначе у редких имён остаётся одна лента
  const EM=new Map(), key=(i,j)=>i<j?i+'_'+j:j+'_'+i; EDG.forEach(([i,j,wt])=>EM.set(key(i,j),[Math.min(i,j),Math.max(i,j),wt]));
  NOD.forEach((n,i)=>(n.nb||[]).forEach(([j,wt])=>{ if(j!==i&&!EM.has(key(i,j))) EM.set(key(i,j),[Math.min(i,j),Math.max(i,j),wt]); }));
  const E2=[...EM.values()];
  const adj=NOD.map(()=>[]); E2.forEach(([i,j,wt])=>{ adj[i].push([j,wt]); adj[j].push([i,wt]); });
  const str=adj.map(a=>a.reduce((t,[,wt])=>t+wt,0)), wOf=i=>Math.max(str[i],1);
  const cls=[...new Set(NOD.map(n=>n.cl))].sort((a,b)=>(a<0)-(b<0)||a-b);
  const order=[]; cls.forEach(c=>NOD.map((_,i)=>i).filter(i=>NOD[i].cl===c).sort((a,b)=>wOf(b)-wOf(a)||NOD[b].n-NOD[a].n).forEach(i=>order.push(i)));
  const gap=cls.length>1?0.03:0, span=TAU-gap*cls.length, tot=order.reduce((t,i)=>t+wOf(i),0);
  const a0=[], a1=[], ang=[]; let a=-Math.PI/2, prev=null;
  order.forEach(i=>{ if(prev!==null&&NOD[i].cl!==prev) a+=gap; prev=NOD[i].cl; const d=span*wOf(i)/tot; a0[i]=a; a1[i]=a+d; ang[i]=a+d/2; a+=d; });
  const dA=(x,y)=>Math.atan2(Math.sin(x-y),Math.cos(x-y));
  const gR=el('g',{},s), gA=el('g',{},s), gL=el('g',{},s);
  // ленты: у каждого имени свой отрезок дуги на каждую связь, по порядку соседей вокруг круга
  const slot={}; NOD.forEach((_,i)=>{ let c=a0[i]; const k=(a1[i]-a0[i])/wOf(i);
    adj[i].slice().sort((p,q)=>dA(ang[q[0]],ang[i])-dA(ang[p[0]],ang[i])).forEach(([j,wt])=>{ slot[i+'_'+j]=[c,c+wt*k]; c+=wt*k; }); });
  const Ri=R-1, arcTo=(x,y)=>`A${f1(Ri)},${f1(Ri)} 0 0 1 ${f1(x)},${f1(y)}`;
  const ribs=E2.map(([i,j,wt])=>{ const [p0,p1]=slot[i+'_'+j], [q0,q1]=slot[j+'_'+i];
    const A0=P(p0,Ri),A1=P(p1,Ri),B0=P(q0,Ri),B1=P(q1,Ri);
    const d=`M${f1(A0[0])},${f1(A0[1])}${arcTo(...A1)}Q${f1(cx)},${f1(cy)} ${f1(B0[0])},${f1(B0[1])}${arcTo(...B1)}Q${f1(cx)},${f1(cy)} ${f1(A0[0])},${f1(A0[1])}Z`;
    return {i,j,wt,p:el('path',{d},gR)}; });
  const arcs=NOD.map((n,i)=>{ const b=Math.max(a1[i]-.0025,a0[i]+.002), big=b-a0[i]>Math.PI?1:0;
    const [x0,y0]=P(a0[i],R),[x1,y1]=P(b,R),[x2,y2]=P(b,R+th),[x3,y3]=P(a0[i],R+th);
    const p=el('path',{d:`M${f1(x0)},${f1(y0)}A${f1(R)},${f1(R)} 0 ${big} 1 ${f1(x1)},${f1(y1)}L${f1(x2)},${f1(y2)}A${f1(R+th)},${f1(R+th)} 0 ${big} 0 ${f1(x3)},${f1(y3)}Z`,
      class:'clickable',tabindex:0,role:'button','aria-label':n.name},gA);
    p.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); o.pick(i); } });
    p.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse') o.hover(i); }); p.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse') o.hover(null); });
    return p; });
  // нажатие: по дуге или рядом с кругом — ближайшее имя по углу; в середине круга — снять выбор
  s.addEventListener('click',e=>{ const bb=s.getBoundingClientRect(), k=w/bb.width, x=(e.clientX-bb.left)*k-cx, y=(e.clientY-bb.top)*k-cy, r=Math.hypot(x,y);
    if(r<R*.72){ o.pick(null); return; } const t=Math.atan2(y,x); let best=null, bd=9;
    order.forEach(i=>{ const d=Math.max(0,Math.abs(dA(t,ang[i]))-(a1[i]-a0[i])/2); if(d<bd){ bd=d; best=i; } });
    o.pick(best); });
  const col=c=>c<0?css('--neutral-bar'):css('--g'+(c+1));
  const LBL='font-family:var(--f-body);pointer-events:none;paint-order:stroke;stroke-width:3px;stroke:'+css('--surface')+`;font-size:${fs}px`;
  function apply({foc,sel,on,tip}){
    const nb=new Set(); if(foc!=null){ nb.add(foc); adj[foc].forEach(([j])=>nb.add(j)); }
    ribs.forEach(r=>{ const both=on(r.i)&&on(r.j), isF=foc!=null&&(r.i===foc||r.j===foc);
      const c=isF?NOD[r.i===foc?r.j:r.i].cl:(NOD[r.i].n>=NOD[r.j].n?NOD[r.i].cl:NOD[r.j].cl);
      r.p.setAttribute('fill',col(c)); r.p.style.opacity=!both?.03:(foc==null?.42:(isF?.85:.04)); if(isF) gR.appendChild(r.p); });
    arcs.forEach((p,i)=>{ p.setAttribute('fill',col(NOD[i].cl)); p.style.opacity=!on(i)?.15:(foc!=null&&!nb.has(i)?.3:1);
      p.setAttribute('stroke',i===sel?css('--ink'):'none'); p.setAttribute('stroke-width',1.5); p.setAttribute('data-tip',tip(i)); });
    // подписи: сначала выбранное имя и его соседи, потом самые связанные; на телефоне при выборе — только соседи
    gL.innerHTML=''; const shown=[], minGap=(fs+1)/(R+th);
    const pri=i=>(i===foc?2e9:0)+(nb.has(i)?1e9:0)+wOf(i);
    order.slice().sort((x,y)=>pri(y)-pri(x)).forEach(i=>{ if(!on(i)&&i!==foc) return; if(foc!=null&&mob&&!nb.has(i)) return;
      if(shown.some(t=>Math.abs(dA(t,ang[i]))<minGap)) return; shown.push(ang[i]);
      const t=ang[i], left=Math.cos(t)<0, [x,y]=P(t,R+th+5);
      const dx=Math.cos(t), dy=Math.sin(t), room=Math.min(dx>.01?(w-x)/dx:dx<-.01?x/-dx:1e9, dy>.01?(h-y)/dy:dy<-.01?y/-dy:1e9)-4;
      let nm=NOD[i].name; const maxc=Math.floor(room/(fs*.56)); if(nm.length>maxc) nm=maxc>3?nm.slice(0,maxc-1)+'…':'';
      if(!nm) return; const deg=t*180/Math.PI;
      const tx=txt(gL,f1(x),f1(y),nm,{'text-anchor':left?'end':'start','dominant-baseline':'middle',transform:`rotate(${f1(left?deg+180:deg)} ${f1(x)} ${f1(y)})`,style:LBL});
      tx.style.fill=css('--ink'); tx.style.fontWeight=i===foc?'700':'400'; tx.style.opacity=foc!=null&&!nb.has(i)?.35:1; });
  }
  return {apply};
}
