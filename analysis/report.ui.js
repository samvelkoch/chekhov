/* ================= report.ui.js: интерактив отчёта ================= */
/* Подключается после report.app.js (build_report.py). Использует его данные и функции: A, ST, LR, PS, ADR, LEX, hs, drawECG,
   selectStory, selectAdr, drawPlay, wsShow, wsChips, goTo и др. Все числа — из D (stats.json) и EX (explore.json). */

/* ---------- общие помощники ---------- */
const PER = EX.periods, NPER = PER.length;
const pshort = p => p.slice(2,4)+'–'+p.slice(-2);
const PSH = PER.map(pshort);
const PW_S = W.pw_s, PW_L = EX.per_tokens_letters;
const sum = a => a.reduce((x,y)=>x+y,0);
const mean = a => a.length ? sum(a)/a.length : 0;
const sgnPct = v => (v>0?'+':v<0?'−':'')+fmt(Math.abs(Math.round(100*v)))+'%';
const cap1 = s => s.charAt(0).toUpperCase()+s.slice(1);
const nearScroll = h => h.scrollIntoView({behavior:calmMotion()?'auto':'smooth',block:'nearest'});

function hasWord(k){ return !!(LEX[k]||LEXN[norm(k)]); }
function openWord(k, scroll=true){ const key=LEX[k]?k:LEXN[norm(k)]; if(!key) return false;
  $('#ws-input').value=key; wsChips(WS_EX); wsShow(key); if(scroll) goTo('poisk'); return true; }

/* поиск текста (рассказ в атласе или пьеса) по названию и году */
const PLAY_IX = new Map(PS.map((p,i)=>[norm(p.t)+'|'+p.y,i])), PLAY_TX = new Map(PS.map((p,i)=>[norm(p.t),i]));
const ST_IX = new Map(), ST_TX = new Map();
A.forEach((a,j)=>{ ST_IX.set(norm(a.t)+'|'+a.y,j); const k=norm(a.t); ST_TX.set(k, ST_TX.has(k)?-1:j); });
function findText(t,y){ const n=norm(t);
  if(PLAY_IX.has(n+'|'+y)) return {k:'play',i:PLAY_IX.get(n+'|'+y)};
  if(ST_IX.has(n+'|'+y)) return {k:'story',j:ST_IX.get(n+'|'+y)};
  if(ST_TX.get(n)>=0) return {k:'story',j:ST_TX.get(n)};
  if(PLAY_TX.has(n)) return {k:'play',i:PLAY_TX.get(n)};
  return null; }
function openText(t,y){ const f=findText(t,y); if(!f) return; if(f.k==='story') selectStory(f.j,true); else { drawPlay(f.i); goTo('kto'); } }
function textBtn(t,y,label){ const f=findText(t,y); const l=esc(label==null?TQ(t):label);
  return f?`<button type="button" class="lnk plain" data-tt="${esc(t)}" data-ty="${y}" data-tip="${f.k==='play'?'пьеса: открыть в разделе «Кто говорит»':'открыть в атласе рассказов'}">${l}</button>`:l; }
function bindLinks(host){
  host.querySelectorAll('button[data-tt]').forEach(b=>b.addEventListener('click',()=>openText(b.dataset.tt,+b.dataset.ty)));
  host.querySelectorAll('button[data-k]').forEach(b=>b.addEventListener('click',()=>openWord(b.dataset.k))); }

const STEM = w => { w=String(w).replace(/ё/g,'е').split('-')[0]; return w.length>=7?w.slice(0,-2):w.length>=5?w.slice(0,-1):w; };
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function hiWord(s,w){ const t=esc(s); try{ return t.replace(new RegExp('('+reEsc(STEM(w)).replace(/е/g,'[её]')+'[а-яё]*)','i'),'<b>$1</b>'); }catch(e){ return t; } }
function quotesHTML(ctx,word,kind){ if(!ctx||!ctx.length) return '<p class="hint">Цитат для показа нет.</p>';
  return ctx.map(c=>`<blockquote>${hiWord(c.s,word)}<cite>${kind==='letter'?`письмо: ${esc(c.to)}, ${c.y}`:`${textBtn(c.to,c.y)}, ${c.y}`}</cite></blockquote>`).join(''); }
function sparkSVG(vals,{h=58,color='var(--s1)',labels=PSH,tips=null,unit='',dec=1}={}){ const n=vals.length, w=n*46, mx=Math.max(...vals,1e-9);
  const fm=v=>Number(v).toLocaleString('ru-RU',{maximumFractionDigits:dec});
  const bars=vals.map((v,i)=>{ const bh=Math.max(v>0?2:0,(h-26)*v/mx); const tp=tips?tips[i]:`${labels[i]}: ${fm(v)}${unit}`;
    return `<rect x="${i*46+7}" y="${h-13-bh}" width="32" height="${bh}" rx="2" fill="${color}" data-tip="${esc(tp)}"/><text x="${i*46+23}" y="${h-16-bh}" text-anchor="middle" style="font-size:9.5px;fill:var(--ink-2)">${v>0?fm(v):''}</text><text x="${i*46+23}" y="${h-2}" text-anchor="middle" style="font-size:9.5px;fill:var(--muted)">${esc(labels[i])}</text>`; }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w*1.7}px;display:block" role="img">${bars}</svg>`; }
function entityCard(host,o){
  host.innerHTML=`<div class="eyebrow">${esc(o.eyebrow||'')}</div><div class="ttl">${esc(o.title)}</div><div class="meta">${o.meta||''}</div>
    <div class="tiles">${o.tiles.map(([b,l])=>`<div><b>${b}</b><span>${l}</span></div>`).join('')}</div>
    ${o.sparks||''}
    ${o.chips&&o.chips.length?`<h4>${esc(o.chipsTitle||'Рядом')}</h4><div class="chips">${o.chips.map((c,i)=>`<button type="button" class="chip" data-c="${i}">${esc(c.label)}</button>`).join('')}</div>`:''}
    ${o.body||''}`;
  host.querySelectorAll('button.chip[data-c]').forEach(b=>b.addEventListener('click',()=>o.chips[+b.dataset.c].fn()));
  bindLinks(host); }
const periodBtns = (host,cur,on)=>{ [[-1,'все годы'],...PER.map((p,i)=>[i,p])].forEach(([i,l])=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=l; b.setAttribute('aria-pressed',String(i===cur));
  b.addEventListener('click',()=>on(i)); host.appendChild(b); }); };

/* ================= VI.3 карта словаря ================= */
const WMD = EX.wmap, WMK = {}; WMD.forEach(m=>{ WMK[m.k]=m; });
const WM = {per:-1, group:-1, sel:null, hov:null, timer:null, n:null, edges:null};
const PWS_TOT = sum(PW_S);
const wmCount = (m,p) => p<0 ? sum(LEX[m.k][2]) : LEX[m.k][2][p];
const wmRate = (m,p) => wmCount(m,p)/(p<0?PWS_TOT:PW_S[p])*1000;
const RMAX_ALL = Math.max(...WMD.map(m=>wmRate(m,-1)));
const RMAX_PER = Math.max(...WMD.flatMap(m=>PER.map((_,p)=>wmRate(m,p))));
const wmGroupLabel = c => EX.wgroups[c].slice(0,2).join(' · ');
const wmRising = (m,p) => p>=0 && wmCount(m,p)>=6 && wmRate(m,p)/Math.max(wmRate(m,-1),1e-9)>=1.5;
const wmTop = (p,n=7) => WMD.filter(m=>wmRising(m,p)).sort((a,b)=>wmRate(b,p)/wmRate(b,-1)-wmRate(a,p)/wmRate(a,-1)).slice(0,n);
const wmTerrOp = () => lum(css('--surface'))<0.2?.2:.34;
$('#t-karta').textContent = `${WMD.length} самых частых слов рассказов и пьес разложены на карте так, что рядом оказываются слова, которые Чехов ставит в похожее окружение (расстановка — метод t-SNE по окружению слов). Цветные области — группы слов. Выберите период или нажмите «Играть»: слова, характерные для периода, вырастут и покраснеют. Нажмите на слово, чтобы увидеть его ближайших соседей, а «Открыть в словоискателе» — чтобы узнать о нём всё. Размеры и числа — по рассказам.`;
function drawWmap(){
  const box=$('#c-wmap'); const Wd=box.clientWidth||800; const h=Wd<600?Math.round(Wd*1.3):Math.round(Math.min(720,Math.max(460,Wd*0.66))); const [s,w]=svg(box,h);
  const M=WMD; const xs=M.map(m=>m.x), ys=M.map(m=>m.y); const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const padX=Wd<600?26:54, padY=34; const sx=x=>padX+(w-2*padX)*(x-x0)/(x1-x0), sy=y=>padY+(h-2*padY)*(y-y0)/(y1-y0);
  const pos={}; M.forEach(m=>{ pos[m.k]=[sx(m.x),sy(m.y)]; });
  const defs=el('defs',{},s); const f=el('filter',{id:'wm-blur',x:'-20%',y:'-20%',width:'140%',height:'140%'},defs); el('feGaussianBlur',{stdDeviation:Wd<600?11:17},f);
  const terr=el('g',{class:'wm-terr',filter:'url(#wm-blur)'},s); const R=Wd<600?24:34;
  M.forEach(m=>el('circle',{cx:pos[m.k][0],cy:pos[m.k][1],r:R,fill:css('--g'+(m.c+1)),opacity:wmTerrOp(),'data-g':m.c},terr));
  EX.wgroups.forEach((g,c)=>{ const mm=M.filter(m=>m.c===c); if(!mm.length) return;
    const cx=mm.reduce((a,m)=>a+pos[m.k][0],0)/mm.length, cy=mm.reduce((a,m)=>a+pos[m.k][1],0)/mm.length;
    const t=txt(s,cx,cy,wmGroupLabel(c),{'text-anchor':'middle',class:'wm-lab','data-lab':c,style:`font-size:${Wd<600?9:11}px;fill:${css('--ink-2')};opacity:0`}); t.setAttribute('paint-order','stroke'); t.setAttribute('stroke',css('--surface')); t.setAttribute('stroke-width','5'); });
  const edges=el('g',{class:'wm-terr'},s); WM.edges=edges;
  const nodes=[];
  M.forEach(m=>{ const [X,Y]=pos[m.k];
    const t=txt(s,X,Y,m.w,{'text-anchor':'middle',tabindex:0,role:'button','aria-label':m.w,style:'font-family:var(--f-body);cursor:pointer'});
    const c=el('circle',{cx:X,cy:Y-4,r:3.2,class:'dot clickable'},s);
    const pick=()=>{ WM.sel=(WM.sel===m.k)?null:m.k; wmApply(); };
    [t,c].forEach(n=>{ n.addEventListener('click',pick); n.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse'){ WM.hov=m.k; wmApply(); } });
      n.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse'){ WM.hov=null; wmApply(); } }); });
    t.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } });
    nodes.push({m,t,c,X,Y}); });
  WM.n={nodes,pos,w,h};
  wmApply();
}
function wmApply(){
  if(!WM.n) return; const {nodes,pos}=WM.n; const p=WM.per, focus=WM.hov||WM.sel;
  const nb=focus?new Set((EX.neighbors[focus]||[]).filter(k=>WMK[k])):new Set();
  const rmax=p<0?RMAX_ALL:RMAX_PER;
  const items=nodes.map(o=>{ const cnt=wmCount(o.m,p); const r=wmRate(o.m,p); const rise=wmRising(o.m,p); const fs=cnt>0?10.5+8.5*Math.sqrt(Math.min(1,r/rmax)):10.5; return {o,cnt,r,rise,fs}; });
  const order=items.slice().sort((a,b)=>((b.o.m.k===focus||nb.has(b.o.m.k))?1e9:0)+(b.rise?1e6:0)+b.r-(((a.o.m.k===focus||nb.has(a.o.m.k))?1e9:0)+(a.rise?1e6:0)+a.r));
  const placed=[]; const fits=b=>!placed.some(q=>b.x<q.x+q.w&&b.x+b.w>q.x&&b.y<q.y+q.h&&b.y+b.h>q.y);
  order.forEach(it=>{ const m=it.o.m, forced=(m.k===focus||nb.has(m.k)); const bw=m.w.length*it.fs*0.55+6, bh=it.fs+2;
    const bx={x:it.o.X-bw/2,y:it.o.Y-it.fs,w:bw,h:bh}; it.show=it.cnt>0&&(forced||fits(bx)); if(it.show) placed.push(bx); });
  const inGroup=m=>WM.group<0||m.c===WM.group;
  items.forEach(it=>{ const m=it.o.m; const dim=(WM.group>=0&&!inGroup(m))||(focus&&m.k!==focus&&!nb.has(m.k));
    const absent=it.cnt===0; const isF=m.k===focus; const isN=nb.has(m.k);
    const tip=`${esc(m.w)}<br>${fmt(it.cnt)} ${plural(it.cnt,'раз','раза','раз')} в рассказах${p>=0?', '+PER[p]:''}<br>нажмите, чтобы увидеть близкие слова`;
    const ink=isF||isN||it.rise?'--mark':(dim?'--muted':'--ink');
    it.o.t.setAttribute('data-tip',tip); it.o.c.setAttribute('data-tip',tip);
    const st=it.o.t.style; st.fontSize=it.fs.toFixed(1)+'px'; st.fill=css(ink); st.fontWeight=(isF||it.rise)?'700':'400';
    st.opacity=it.show?(dim?.22:1):0; st.pointerEvents=it.show?'auto':'none';
    it.o.c.setAttribute('fill',css(isF||isN?'--mark':(it.rise?'--mark':'--neutral-bar')));
    it.o.c.style.opacity=it.show?0:(dim?.12:(absent?.1:(it.rise?.9:.55))); it.o.c.style.pointerEvents=it.show?'none':'auto'; });
  document.querySelectorAll('#c-wmap circle[data-g]').forEach(c=>{ const g=+c.getAttribute('data-g'); c.style.opacity=(WM.group<0||g===WM.group)?wmTerrOp():.04; });
  document.querySelectorAll('#c-wmap .wm-lab').forEach(t=>{ const g=+t.getAttribute('data-lab'); t.style.opacity=(WM.group>=0&&g===WM.group)?.9:0; t.style.fontSize=(WM.group>=0&&g===WM.group)?'15px':''; });
  const E=WM.edges; while(E.firstChild) E.removeChild(E.firstChild);
  if(focus&&pos[focus]){ const [ax,ay]=pos[focus]; nb.forEach(k=>{ const [bx,by]=pos[k]; const dx=bx-ax, dy=by-ay; const cx=(ax+bx)/2-dy*0.16, cy=(ay+by)/2+dx*0.16;
    el('path',{d:`M${ax},${ay-4} Q${cx},${cy} ${bx},${by-4}`,fill:'none',stroke:css('--mark'),'stroke-width':1.5,'stroke-linecap':'round',opacity:.7},E); });
    el('circle',{cx:ax,cy:ay-4,r:14,fill:'none',stroke:css('--mark'),'stroke-width':1.5,opacity:.8},E); }
  document.querySelectorAll('#wm-groups button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j-1===WM.group)));
  document.querySelectorAll('#wm-per button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j-1===WM.per)));
  $('#wm-play').textContent=WM.timer?'❚❚ Пауза':'▶ Играть';
  wmReadout();
}
function wmReadout(){ const host=$('#wm-read'); const p=WM.per, k=WM.sel;
  const link=kk=>`<button type="button" class="chip" data-wk="${esc(kk)}">${esc(yo(kk))}</button>`;
  let html;
  if(k){ const m=WMK[k]; const nbs=(EX.neighbors[k]||[]).filter(x=>WMK[x]);
    html=`<b>${esc(m.w)}</b> — ${fmt(wmCount(m,-1))} ${plural(wmCount(m,-1),'раз','раза','раз')} в рассказах; по периодам: ${PER.map((pp,i)=>`${pp}: ${fmt(wmCount(m,i))}`).join(', ')}.<br>Близкие по употреблению (линии на карте): ${nbs.map(link).join(' ')||'—'} <button type="button" class="btn" data-open="${esc(k)}">Открыть в словоискателе →</button>`;
  } else if(p>=0){ const top=wmTop(p);
    html=`<b>${esc(PER[p])}.</b> Красным выделены слова, которых в эти годы заметно больше, чем в среднем по всем рассказам (не реже чем в 1,5 раза, не меньше 6 употреблений): ${top.map(m=>link(m.k)).join(' ')||'—'}`;
  } else html=`Размер слова — как часто оно встречается в рассказах; цветная область — группа слов, которые Чехов ставит в похожее окружение. Выберите период или нажмите «Играть», чтобы увидеть, как менялся словарь, и нажмите на слово, чтобы увидеть его ближайших соседей.`;
  host.innerHTML=html;
  host.querySelectorAll('[data-wk]').forEach(b=>b.addEventListener('click',()=>{ WM.sel=b.dataset.wk; wmApply(); }));
  host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openWord(b.dataset.open,true)));
}
function wmSetPer(p,userPick){ if(userPick&&WM.timer){ clearInterval(WM.timer); WM.timer=null; } WM.per=p; wmApply(); }
function wmPlay(){ if(WM.timer){ clearInterval(WM.timer); WM.timer=null; wmApply(); return; }
  if(WM.per<0||WM.per>=NPER-1) WM.per=0; wmApply();
  WM.timer=setInterval(()=>{ WM.per=(WM.per+1)%NPER; wmApply(); },2600); wmApply(); }
(function(){
  const g=$('#wm-groups'); const mk=(i,l,c)=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.setAttribute('aria-pressed',String(i===WM.group));
    b.innerHTML=(c?`<i style="background:var(--g${i+1})"></i>`:'')+esc(l); b.addEventListener('click',()=>{ WM.group=(WM.group===i&&i>=0)?-1:i; wmApply(); }); g.appendChild(b); };
  mk(-1,'все слова',false); EX.wgroups.forEach((gr,i)=>mk(i,wmGroupLabel(i),true));
  const pr=$('#wm-per'); [[-1,'все годы'],...PER.map((pp,i)=>[i,pp])].forEach(([i,l])=>{ const b=document.createElement('button'); b.type='button'; b.textContent=l; b.setAttribute('aria-pressed',String(i===WM.per));
    b.addEventListener('click',()=>wmSetPer(i,true)); pr.appendChild(b); });
  $('#wm-play').addEventListener('click',wmPlay);
  $('#wm-find').addEventListener('input',e=>{ const q=norm(e.target.value); if(!q) return; const hit=WMK[q]||WMD.find(m=>norm(m.w).startsWith(q)); if(hit){ WM.sel=hit.k; wmApply(); } });
  chart(drawWmap,$('#c-wmap')); })();

/* ================= VI.5 темы ================= */
const TH = EX.themes, THN = Object.keys(TH);
const TH_S = {kind:'works', sort:'ord', sel:THN[0]};
const thChg = (t,kind) => { const a=TH[t][kind]; const pr=mean(a.slice(0,NPER-1)); return pr>0 ? a[NPER-1]/pr-1 : null; };
const THK = {works:'рассказы и пьесы', letters:'письма'};
$('#t-temy').textContent = `${pn(THN.length,'тема','темы','тем')}: каждая — список слов, общих для рассказов, пьес и писем. В клетке — сколько раз слова темы встречаются на 1000 слов текстов периода. Цвет считается внутри строки: чем темнее, тем чаще для самой этой темы, поэтому цвета разных тем не сравниваются — сравнивайте цифры. Нажмите на тему, чтобы увидеть её слова и тексты, где она звучит громче всего.`;
function thVerdict(){ const k=TH_S.kind; const L=THN.map(t=>({t,c:thChg(t,k)})).filter(r=>r.c!=null);
  const up=L.filter(r=>r.c>0).sort((a,b)=>b.c-a.c).slice(0,3), dn=L.filter(r=>r.c<0).sort((a,b)=>a.c-b.c).slice(0,3);
  const f=r=>`«${r.t}» (${sgnPct(r.c)})`;
  $('#f-temy').textContent = `${k==='works'?'В рассказах и пьесах':'В письмах'} последний период (${PER[NPER-1]}), сравнённый со средним по трём прежним, звучит громче в темах ${up.map(f).join(', ')||'—'}; тише — ${dn.map(f).join(', ')||'—'}.`;
  $('#u-temy').textContent = `на 1000 слов; ${THK[k]}${k==='letters'?`. Письма ${PER[0]} — всего ${fmt(PW_L[0])} слов: цифры за этот период шаткие`:''}`; }
function drawThemes(){ thVerdict();
  const k=TH_S.kind; let ord=THN.slice(); if(TH_S.sort==='chg') ord.sort((a,b)=>(thChg(b,k)??-9)-(thChg(a,k)??-9));
  chart(()=>{ const box=$('#c-temy'); const cellH=30, topH=30; const h=topH+ord.length*cellH+4; const [s,w]=svg(box,h); const narrow=w<560; const lw=narrow?112:180, chW=narrow?64:92; const cw=(w-lw-chW)/NPER;
    const lo=css('--heat-lo'), hi=css('--heat-hi'); const dark=lum(css('--surface'))<0.2;
    PER.forEach((p,j)=>txt(s,lw+cw*j+cw/2,topH-10,narrow?pshort(p):p,{'text-anchor':'middle',style:'fill:var(--muted)'}));
    txt(s,lw+cw*NPER+chW/2,topH-10,narrow?'к прежним':'к прежним периодам',{'text-anchor':'middle',style:'fill:var(--muted)'});
    ord.forEach((t,i)=>{ const y=topH+i*cellH; const row=TH[t][k]; const mn=Math.min(...row), mx=Math.max(...row); const act=t===TH_S.sel;
      txt(s,lw-8,y+cellH/2+4,cut(t,narrow?15:26),{'text-anchor':'end',style:`font-family:var(--f-body);font-size:13.5px;fill:var(${act?'--accent':'--ink'});${act?'font-weight:700;':''}text-decoration:underline dotted`});
      const hit=el('rect',{class:'hit clickable',x:0,y,width:lw,height:cellH,tabindex:0,role:'button','aria-label':t},s); const pick=()=>thPick(t); hit.addEventListener('click',pick); hit.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } });
      row.forEach((v,j)=>{ const x=lw+cw*j; const tt=mx>mn?(v-mn)/(mx-mn):0; const fill=mixc(lo,hi,tt);
        const r=el('rect',{class:'clickable',x:x+1,y:y+1,width:cw-2,height:cellH-2,rx:2,fill,'data-tip':`<b>${esc(t)}</b> · ${PER[j]}<br>${fmt1(v)} на 1000 слов (${THK[k]})<br>нажмите — слова и тексты темы`},s); r.addEventListener('click',pick);
        const inkVar=dark?(lum(fill)>0.33?'--heat-ink-hi':'--heat-ink-lo'):(lum(fill)<0.33?'--heat-ink-hi':'--heat-ink-lo');
        txt(s,x+cw/2,y+cellH/2+4,fmt1(v),{'text-anchor':'middle',style:`pointer-events:none;font-size:11.5px;fill:var(${inkVar})`}); });
      const c=thChg(t,k); const x=lw+cw*NPER; const col=c==null?'--muted':c>0.05?'--mark':c<-0.05?'--accent':'--muted';
      txt(s,x+chW/2,y+cellH/2+4,c==null?'—':(c>0.05?'▲ ':c<-0.05?'▼ ':'')+sgnPct(c),{'text-anchor':'middle',style:`font-family:var(--f-mono);font-size:12px;fill:var(${col});font-weight:600`});
      el('rect',{class:'hit clickable',x:x,y,width:chW,height:cellH,'data-tip':`${esc(t)}: ${PER[NPER-1]} против среднего по трём прежним периодам`,tabindex:-1},s).addEventListener('click',pick); });
  }, $('#c-temy'));
}
function thPick(t){ TH_S.sel=t; drawThemes(); thCard(); }
function thCard(){ const t=TH_S.sel, d=TH[t]; const host=$('#th-card');
  const cw_=thChg(t,'works'), cl_=thChg(t,'letters');
  const sp=(arr,c,tok)=>sparkSVG(arr,{color:c,unit:' на 1000',tips:arr.map((v,i)=>`${PER[i]}: ${fmt1(v)} на 1000 слов`)});
  const wr=d.words.slice().sort((a,b)=>(b[1]+b[2])-(a[1]+a[2]));
  const body=`<h4>Слова темы: сколько раз в рассказах и пьесах / в письмах</h4><div class="mini3"><span class="h" style="text-align:left">слово</span><span class="h">проза</span><span class="h">письма</span>${
    wr.map(([w,a,b])=>`<span>${hasWord(w)?`<button type="button" data-k="${esc(w)}" data-tip="открыть в словоискателе">${esc(yo(w))}</button>`:esc(yo(w))}</span><span class="n">${fmt(a)}</span><span class="n">${fmt(b)}</span>`).join('')}</div>
    <h4>Где тема звучит громче всего</h4><div class="mini3"><span class="h" style="text-align:left">текст</span><span class="h">год</span><span class="h">на 1000 слов</span>${
    d.loud.map(([tt,y,v])=>`<span>${textBtn(tt,y)}</span><span class="n">${y}</span><span class="n">${fmt1(v)}</span>`).join('')}</div>`;
  entityCard(host,{eyebrow:'Тема',title:t,meta:`${pn(d.words.length,'слово','слова','слов')} в списке`,
    tiles:[[fmt1(d.works[NPER-1]),`на 1000 слов рассказов и пьес, ${PER[NPER-1]}`],[fmt1(d.letters[NPER-1]),`на 1000 слов писем, ${PER[NPER-1]}`],[cw_==null?'—':sgnPct(cw_),'рассказы и пьесы: последний период к среднему прежних']],
    sparks:`<h4>Рассказы и пьесы, на 1000 слов</h4>${sp(d.works,'var(--s1)')}<h4>Письма, на 1000 слов (в ${PER[0]} слов мало: ${fmt(PW_L[0])})</h4>${sp(d.letters,'var(--s2)')}`,body}); }
seg($('#sl-th'), Object.entries(THK), TH_S.kind, v=>{ TH_S.kind=v; drawThemes(); });
seg($('#sl-thsort'), [['ord','как в списке'],['chg','по изменению']], TH_S.sort, v=>{ TH_S.sort=v; drawThemes(); });
drawThemes(); thCard();

/* ================= VII.1 круг Чехова ================= */
const NETD = EX.net, NN = NETD.nodes, NE = NETD.edges, NC = NETD.clusters;
const NT = {per:-1, cl:-1, sel:null, hov:null, N:null};
const ntCount = n => NT.per>=0 ? n.per[NT.per] : n.n;
const clCol = c => c<0 ? css('--neutral-bar') : css('--g'+(c+1));
(function(){ const top=NN.slice().sort((a,b)=>b.n-a.n); const E=NE.slice().sort((a,b)=>b[2]-a[2])[0]; const big=NC.slice().sort((a,b)=>b.n-a.n)[0];
  $('#t-net').textContent = `Люди, которых Чехов называет в письмах по фамилии. В сеть входят ${pn(NN.length,'имя','имени','имён')}. Размер кружка — в скольких письмах назван человек; линия — два имени названы в одном абзаце письма; цвет — круг имён, которые чаще встречаются вместе. Выберите период или круг, найдите человека по имени — справа откроется карточка.`;
  $('#f-lyudi').textContent = `Чаще всех в письмах назван ${top[0].name} — в ${pn(top[0].n,'письме','письмах','письмах')}; за ним ${top.slice(1,6).map(r=>`${r.name} (${r.n})`).join(', ')}. Имена собираются в ${pn(NC.length,'круг','круга','кругов')}; самый большой — ${big.names.join(', ')} и ещё ${pn(big.n-big.names.length,'имя','имени','имён')}. Ближе всего друг к другу стоят ${NN[E[0]].name} и ${NN[E[1]].name}: они названы вместе в ${pn(E[2],'абзаце','абзацах','абзацах')}.`; })();
periodBtns($('#pp-per'),NT.per,i=>{ NT.per=i; ntApply(); });
(function(){ const g=$('#pp-clusters'); const mk=(i,l)=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.setAttribute('aria-pressed',String(i===NT.cl));
  b.innerHTML=(i>=0?`<i style="background:var(--g${i+1})"></i>`:'')+esc(l); b.addEventListener('click',()=>{ NT.cl=(NT.cl===i&&i>=0)?-1:i; ntApply(); }); g.appendChild(b); };
  mk(-1,'все круги'); NC.forEach((c,i)=>mk(i,c.names.join(' · ')+' ('+c.n+')')); })();
function drawNet(){
  const box=$('#c-net'); const Wd=box.clientWidth||800; const h=Math.round(Math.min(780,Math.max(480,Wd*0.76))); const [s,w]=svg(box,h);
  const padX=Wd<600?24:56, padY=36; const xs=NN.map(n=>n.x), ys=NN.map(n=>n.y); const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const X=x=>padX+(w-2*padX)*(x-x0)/(x1-x0), Y=y=>padY+(h-2*padY)*(y-y0)/(y1-y0);
  const gE=el('g',{},s), gN=el('g',{},s), gL=el('g',{},s);
  const edges=NE.map(([i,j,wt])=>({i,j,wt,l:el('line',{x1:X(NN[i].x),y1:Y(NN[i].y),x2:X(NN[j].x),y2:Y(NN[j].y),'stroke-linecap':'round'},gE)}));
  const nodes=NN.map((n,i)=>{ const c=el('circle',{cx:X(n.x),cy:Y(n.y),r:5,class:'clickable',tabindex:0,role:'button','aria-label':n.name},gN);
    const t=txt(gL,X(n.x),Y(n.y)-9,n.name,{'text-anchor':'middle',style:'font-family:var(--f-body);font-size:12px;pointer-events:none;paint-order:stroke;stroke:'+css('--surface')+';stroke-width:3px'});
    const pick=()=>{ NT.sel=(NT.sel===i)?null:i; ntApply(); if(NT.sel!=null&&matchMedia('(max-width:999px)').matches) nearScroll($('#pp-card')); };
    c.addEventListener('click',pick); c.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } });
    c.addEventListener('pointerenter',e=>{ if(e.pointerType==='mouse'){ NT.hov=i; ntApply(); } }); c.addEventListener('pointerleave',e=>{ if(e.pointerType==='mouse'){ NT.hov=null; ntApply(); } });
    return {n,c,t,X:X(n.x),Y:Y(n.y)}; });
  NT.N={edges,nodes,w,h}; ntApply();
}
function ntApply(){
  document.querySelectorAll('#pp-per button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j-1===NT.per)));
  document.querySelectorAll('#pp-clusters button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j-1===NT.cl)));
  if(NT.N){ const {edges,nodes}=NT.N; const foc=NT.hov!=null?NT.hov:NT.sel;
    const nb=new Set(); if(foc!=null){ nb.add(foc); NE.forEach(([i,j])=>{ if(i===foc) nb.add(j); if(j===foc) nb.add(i); }); }
    const cnt=nodes.map(o=>ntCount(o.n)), mx=Math.max(...cnt,1);
    const placed=[]; const fit=b=>!placed.some(q=>b.x<q.x+q.w&&b.x+b.w>q.x&&b.y<q.y+q.h&&b.y+b.h>q.y);
    const order=nodes.map((_,i)=>i).sort((a,b)=>((b===foc||nb.has(b))?1e6:0)+cnt[b]-(((a===foc||nb.has(a))?1e6:0)+cnt[a]));
    nodes.forEach((o,i)=>{ const on=cnt[i]>0&&(NT.cl<0||o.n.cl===NT.cl); const dim=!on||(foc!=null&&!nb.has(i));
      const r=on?3.5+10*Math.sqrt(cnt[i]/mx):3; o.r=r;
      o.c.setAttribute('r',r.toFixed(1)); o.c.setAttribute('fill',clCol(o.n.cl)); o.c.setAttribute('stroke-width',i===NT.sel?3:1.5);
      o.c.style.opacity=on?(dim?.18:.92):.1; o.c.style.stroke=i===foc?css('--ink'):css('--surface');
      o.c.setAttribute('data-tip',`<b>${esc(o.n.name)}</b><br>${NT.per>=0?PER[NT.per]+': ':''}в ${pn(cnt[i],'письме','письмах','письмах')}${NT.per>=0?'':', '+pn(o.n.np,'абзац','абзаца','абзацев')}<br>нажмите, чтобы открыть карточку`); });
    order.forEach(i=>{ const o=nodes[i]; const on=cnt[i]>0&&(NT.cl<0||o.n.cl===NT.cl); const forced=i===foc||nb.has(i);
      const fs=12, bw=o.n.name.length*fs*0.56+6, bx={x:o.X-bw/2,y:o.Y-o.r-fs-4,w:bw,h:fs+3}; const show=on&&(forced||(cnt[i]>=2&&fit(bx)));
      if(show) placed.push(bx); o.t.setAttribute('y',(o.Y-o.r-4).toFixed(1)); o.t.style.opacity=show?((foc!=null&&!forced)?.25:1):0; o.t.style.fontWeight=i===foc?'700':'400'; });
    edges.forEach(e=>{ const bothOn=cnt[e.i]>0&&cnt[e.j]>0&&(NT.cl<0||(NN[e.i].cl===NT.cl&&NN[e.j].cl===NT.cl)); const isF=foc!=null&&(e.i===foc||e.j===foc);
      e.l.setAttribute('stroke',isF?css('--mark'):css('--axis')); e.l.setAttribute('stroke-width',isF?(1.2+.5*Math.sqrt(e.wt)).toFixed(1):(.5+.35*Math.sqrt(e.wt)).toFixed(1));
      e.l.style.opacity=!bothOn?0:(foc!=null?(isF?.9:.05):.5); }); }
  ntCard();
}
function ntCard(){
  const host=$('#pp-card'); const n=NT.sel!=null?NN[NT.sel]:null;
  if(!n){ const top=NN.slice().sort((a,b)=>b.n-a.n).slice(0,8);
    host.innerHTML=`<div class="eyebrow">Карточка</div><div class="ttl">Выберите имя</div><p class="hint">Нажмите на кружок в сети или найдите человека по имени. Размер кружка — в скольких письмах он назван; цвет — круг имён, которые чаще встречаются вместе; линии — имена из одного абзаца. Например:</p><div class="chips">${top.map(x=>`<button type="button" class="chip" data-nm="${esc(x.name)}">${esc(x.name)}</button>`).join('')}</div>`;
    host.querySelectorAll('[data-nm]').forEach(b=>b.addEventListener('click',()=>ntSelectByName(b.dataset.nm))); return; }
  const nbs=(n.nb||[]).map(([j,w])=>({label:`${NN[j].name} · ${w}`,fn:()=>{ NT.sel=j; ntApply(); }}));
  const yrs=n.y0===n.y1?String(n.y0):`${n.y0}–${n.y1}`;
  const rates=n.per.map((v,i)=>PW_L[i]?1e4*v/PW_L[i]:0); const peak=rates.indexOf(Math.max(...rates));
  const tiles=[[fmt(n.n),plural(n.n,'письмо с упоминанием','письма с упоминанием','писем с упоминанием')],[fmt(n.np),plural(n.np,'абзац','абзаца','абзацев')],[yrs,'годы упоминаний']];
  tiles.push(n.wrote>0?[fmt(n.wrote),'писал ему/ей писем']:[fmt((n.nb||[]).length),'ближайших имён']);
  tiles.push([pshort(PER[peak]),'чаще всего — в этом периоде'],[n.adr?'есть':'нет','такая фамилия среди адресатов']);
  entityCard(host,{eyebrow:'Карточка',title:n.name,meta:`круг: ${esc(NC[n.cl].names.join(' · '))}`,tiles,
    sparks:`<h4>Писем с упоминанием на 10 000 слов писем</h4>${sparkSVG(rates,{tips:rates.map((v,i)=>`${PER[i]}: ${pn(n.per[i],'письмо','письма','писем')} (${fmt1(v)} на 10 000 слов писем)`)})}`,
    chips:nbs,chipsTitle:'Чаще всего рядом (общих абзацев)',body:`<h4>Из писем</h4>${quotesHTML(n.ctx,n.name,'letter')}`}); }
function ntSelectByName(name){ const i=NN.findIndex(n=>n.name===name); if(i>=0){ NT.sel=i; ntApply(); } }
(function(){ const inp=$('#pp-find'), sug=$('#pp-sug');
  const upd=()=>{ const q=norm(inp.value); sug.innerHTML=''; if(!q) return; const m=NN.filter(x=>norm(x.name).startsWith(q)).concat(NN.filter(x=>!norm(x.name).startsWith(q)&&norm(x.name).includes(q))).slice(0,8);
    m.forEach(x=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=x.name; b.addEventListener('click',()=>{ inp.value=x.name; sug.innerHTML=''; ntSelectByName(x.name); }); sug.appendChild(b); });
    if(m.length===1&&norm(m[0].name)===q) ntSelectByName(m[0].name); };
  inp.addEventListener('input',upd); inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ const q=norm(inp.value); const m=NN.find(x=>norm(x.name).startsWith(q)); if(m){ ntSelectByName(m.name); sug.innerHTML=''; } } }); })();
chart(drawNet,$('#c-net'));
legendTo($('#lg-lyudi'), [['фамилия есть среди адресатов','var(--s2)'],['среди адресатов нет','var(--neutral-bar)']]);
hbars($('#c-lyudi'), NN.slice().sort((a,b)=>b.n-a.n).slice(0,40).map(n=>({l:n.name,k:n.name,v:n.n,c:n.adr?'var(--s2)':'var(--neutral-bar)',tip:`${esc(n.name)}: в ${pn(n.n,'письме','письмах','письмах')}${n.adr?' · такая фамилия есть среди адресатов':''}<br>нажмите — карточка в сети`})),
  {labelW:170, fmtv:fmt, rowH:22, onClick:r=>{ ntSelectByName(r.k); goTo('net-wrap'); }});

/* ================= VII.2 имена героев ================= */
const HERO = EX.heroes;
const TXP = PERIODS.map(([l,a,b])=>A.filter(s=>s.y>=a&&s.y<=b).length+PS.filter(p=>p.y>=a&&p.y<=b).length);
function heroShow(name,scroll){ const h=HERO[name]; if(!h) return; const card=$('#hero-card');
  const rates=h.per.map((v,i)=>TXP[i]?100*v/TXP[i]:0); const peak=rates.indexOf(Math.max(...rates)); const top=h.texts[0];
  const rows=h.texts.map(([t,y,k])=>`<span>${textBtn(t,y)}</span><span class="n">${y}</span><span class="n">${fmt(k)}</span>`).join('');
  entityCard(card,{eyebrow:h.g==='f'?'Женское имя':'Мужское имя',title:name,meta:`${pn(h.n,'рассказ или пьеса','рассказа или пьесы','рассказов и пьес')} из ${fmt(NW.works)}`,
    tiles:[[fmt(h.n),plural(h.n,'текст','текста','текстов')],[top?fmt(top[2]):'—',top?`раз в ${TQ(top[0])}`:'раз'],[pshort(PER[peak]),'в этом периоде имя встречается чаще всего']],
    sparks:`<h4>В скольких текстах периода — % рассказов и пьес</h4>${sparkSVG(rates,{unit:'%',dec:0,tips:rates.map((v,i)=>`${PER[i]}: ${h.per[i]} из ${TXP[i]} текстов (${fmt1(v)}%)`)})}`,
    body:`<h4>В каких текстах${h.texts.length<h.n?` (${h.texts.length} с наибольшим числом упоминаний)`:''}</h4><div class="mini3"><span class="h" style="text-align:left">текст</span><span class="h">год</span><span class="h">раз</span>${rows}</div>
      <h4>Из текстов</h4>${quotesHTML(h.ctx,name,'work')}`});
  if(scroll) nearScroll(card); }
(function(){ const first=WR.names_works.m[0][0]; heroShow(first,false);
  const all=Object.keys(HERO).sort((a,b)=>HERO[b].n-HERO[a].n); $('#hero-all-n').textContent=fmt(all.length);
  $('#hero-all').addEventListener('toggle',function(){ if(!this.open||$('#hero-allchips').childElementCount) return; const h=$('#hero-allchips');
    all.forEach(k=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=`${k} · ${HERO[k].n}`; b.addEventListener('click',()=>heroShow(k,true)); h.appendChild(b); }); }); })();

/* ================= VII.7 палитра периодов ================= */
const PAL = EX.palette; let palKind='works';
const PALK = {works:'рассказах и пьесах', letters:'письмах'};
function paletteText(){ const P=PAL[palKind]; const tot=P.map(r=>sum(r.c.map(c=>c[2]))); const share=(r,name)=>{ const c=r.c.find(x=>x[0]===name); return c&&tot[P.indexOf(r)]?c[2]/tot[P.indexOf(r)]:0; };
  const top=r=>r.c.slice().sort((a,b)=>b[2]-a[2])[0]; const f=top(P[0]), l=top(P[NPER-1]);
  const names=[...new Set(P.flatMap(r=>r.c.map(c=>c[0])))]; const tots={}; names.forEach(nm=>{ tots[nm]=sum(P.map(r=>(r.c.find(c=>c[0]===nm)||[0,0,0])[2])); });
  const skip=nm=>norm(nm)==='вишневый'; const cand=names.filter(nm=>tots[nm]>=15&&!skip(nm)).map(nm=>({nm,last:share(P[NPER-1],nm),prev:mean(P.slice(0,NPER-1).map(r=>share(r,nm)))}));
  const up=cand.slice().sort((a,b)=>(b.last-b.prev)-(a.last-a.prev))[0], dn=cand.slice().sort((a,b)=>(a.last-a.prev)-(b.last-b.prev))[0];
  $('#t-palette').innerHTML = `В ${PALK[palKind]} ${PER[0]} годов главный цвет — «${esc(yo(f[0]))}» (${fmt(Math.round(100*f[2]/tot[0]))}% цветовых слов), в ${PER[NPER-1]} — «${esc(yo(l[0]))}» (${fmt(Math.round(100*l[2]/tot[NPER-1]))}%). Сильнее всего выросла доля цвета «${esc(yo(up.nm))}» (${fmt(Math.round(100*up.last))}% в последнем периоде против ${fmt(Math.round(100*up.prev))}% в среднем по прежним), сильнее всего упала — «${esc(yo(dn.nm))}» (${fmt(Math.round(100*dn.last))}% против ${fmt(Math.round(100*dn.prev))}%).${names.some(skip)?' Слово «вишнёвый» в этот расчёт не входит: в основном это название пьесы «Вишнёвый сад».':''}`; }
function drawPalette(){ chart(()=>{ const box=$('#c-palette'); const P=PAL[palKind]; const rowH=44; const h=P.length*rowH+8; const [s,w]=svg(box,h); const ring=css('--ring'); const lw=w<560?78:96;
    P.forEach((r,i)=>{ const y=i*rowH+4; const tot=sum(r.c.map(c=>c[2]))||1; let x=lw; const Wd=w-lw-4;
      txt(s,lw-10,y+17,r.p,{'text-anchor':'end',style:'fill:var(--ink);font-size:12px'}); txt(s,lw-10,y+31,`${fmt(tot)} ${plural(tot,'слово','слова','слов')}`,{'text-anchor':'end',style:'fill:var(--muted);font-size:10.5px'});
      r.c.forEach(([name,hex,n])=>{ const ww=Wd*n/tot; if(ww<0.5) return; const k=hasWord(name);
        const rc=el('rect',{x:x+.5,y,width:Math.max(.5,ww-1),height:rowH-10,fill:hex,stroke:ring,'stroke-width':.8,class:k?'clickable':'','data-tip':`${PER[i]} · ${esc(yo(name))}: ${n} (${fmt1(100*n/tot)}%)${k?'<br>нажмите — слово в словоискателе':''}`},s);
        if(k) rc.addEventListener('click',()=>openWord(name));
        if(ww>=60) txt(s,x+ww/2,y+(rowH-10)/2+4,cut(yo(name),Math.floor(ww/7.2)),{'text-anchor':'middle',style:`pointer-events:none;font-size:11.5px;fill:${lum(hex)>0.42?'#1d1a17':'#f4f1ea'}`});
        x+=ww; }); }); }, $('#c-palette')); paletteText(); }
seg($('#sl-pal'), [['works','рассказы и пьесы'],['letters','письма']], palKind, v=>{ palKind=v; drawPalette(); });
drawPalette();

/* ================= I.3 хронология: карточка года ================= */
const YR = {y:null};
function setYearMark(y){ hs.yr=y; drawECG(); const n=$('#yr-note');
  n.innerHTML = y==null?'':`· подсвечен ${y} год <button type="button" class="lnk plain" id="yr-clear" style="color:var(--hmark)">сбросить</button>`;
  const b=$('#yr-clear'); if(b) b.addEventListener('click',()=>setYearMark(null)); }
function yearCard(y,manual){ YR.y=y; const host=$('#yr-card'); if(manual) chronoDraw();
  const st=ST.filter(a=>a.y===y).sort((a,b)=>b.w-a.w), pl=PS.filter(p=>p.y===y), lt=LR.filter(r=>r.y===y);
  const byTo={}; lt.forEach(r=>{ byTo[r.to]=(byTo[r.to]||0)+1; }); const toTop=Object.entries(byTo).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const py=P.by_year.find(r=>r.y===y); const words=sum(st.map(a=>a.w)), lw=sum(lt.map(r=>r.w));
  const LIM=30; const chip=a=>`<button type="button" class="chip" data-j="${a.j}" data-tip="${esc(a.t)}: ${fmt(a.w)} слов">${esc(cut(a.t,30))}</button>`;
  entityCard(host,{eyebrow:'Год',title:String(y),meta:'рассказы и повести — по году первой публикации; письма и пьесы — по дате',
    tiles:[[fmt(st.length),plural(st.length,'рассказ и повесть','рассказа и повести','рассказов и повестей')],[py?fmt(Math.round(py.w_med)):'—','слов в типичном рассказе (медиана)'],[fmt(pl.length),plural(pl.length,'пьеса','пьесы','пьес')],[fmt(lt.length),plural(lt.length,'письмо','письма','писем')],[fmt(words),'слов в рассказах'],[fmt(lw),'слов в письмах']],
    body:(st.length?`<h4>Рассказы и повести — нажмите, чтобы открыть в атласе</h4><div class="yr-list" id="yr-st">${st.slice(0,LIM).map(chip).join('')}${st.length>LIM?`<button type="button" class="chip" id="yr-more">ещё ${st.length-LIM}</button>`:''}</div>`:'')
      +(pl.length?`<h4>Пьесы</h4><div class="yr-list">${pl.map(p=>`<button type="button" class="chip" data-tt="${esc(p.t)}" data-ty="${p.y}">${esc(p.t)}</button>`).join('')}</div>`:'')
      +(toTop.length?`<h4>Кому писал чаще всего</h4><div class="yr-list">${toTop.map(([nm,n])=>{ const i=ADR.findIndex(a=>a.nom===nm); return i>=0?`<button type="button" class="chip" data-adr="${i}">${esc(nm)} · ${n}</button>`:`<span class="chip static">${esc(nm)} · ${n}</span>`; }).join('')}</div>`:'')
      +`<p style="margin:14px 0 0"><button type="button" class="btn" id="yr-hl">Подсветить ${y} год в шапке ↑</button></p>`});
  host.querySelectorAll('button[data-j]').forEach(b=>b.addEventListener('click',()=>selectStory(+b.dataset.j,true)));
  host.querySelectorAll('button[data-adr]').forEach(b=>b.addEventListener('click',()=>selectAdr(+b.dataset.adr,true)));
  const more=$('#yr-more'); if(more) more.addEventListener('click',()=>{ $('#yr-st').innerHTML=st.map(chip).join(''); $('#yr-st').querySelectorAll('button[data-j]').forEach(b=>b.addEventListener('click',()=>selectStory(+b.dataset.j,true))); });
  $('#yr-hl').addEventListener('click',()=>{ setYearMark(y); goTo('top'); });
  if(hs.yr!=null&&hs.yr!==y) setYearMark(y);
  if(manual) nearScroll(host); }
yearCard(bestStY.y,false);

/* ================= IV.1 календарь писем ================= */
const CAL = {}; let calUnk = 0;
LT.strip.rows.forEach(r=>{ const y=Math.floor(r[0]/10000), m=Math.floor(r[0]/100)%100, d=r[0]%100; if(!m){ calUnk++; return; }
  const c=CAL[y*100+m]||(CAL[y*100+m]={y,m,n:0,w:0,names:{},days:{}}); c.n++; c.w+=r[1]; const nm=LT.strip.names[r[3]]; c.names[nm]=(c.names[nm]||0)+1; if(d) c.days[d]=(c.days[d]||0)+1; });
const CAL_V = Object.values(CAL); const CAL_Y0 = Math.min(...CAL_V.map(c=>c.y)), CAL_Y1 = Math.max(...CAL_V.map(c=>c.y));
const CAL_S = {y:bestM[0], m:bestM[1]};
$('#u-cal').textContent = `писем в месяц по дате письма; ${pn(calUnk,'письмо','письма','писем')} без точного месяца не показаны; нажмите на клетку`;
function drawCal(){ chart(()=>{ const box=$('#c-cal'); const nY=CAL_Y1-CAL_Y0+1; const cellH=21, topH=22; const h=topH+12*cellH+4; const [s,w]=svg(box,h); const narrow=w<560; const lw=narrow?34:86; const cw=(w-lw)/nY;
    const mx=Math.max(...CAL_V.map(c=>c.n)); const lo=css('--heat-lo'), hi=css('--heat-hi'); const dark=lum(css('--surface'))<0.2;
    for(let y=CAL_Y0;y<=CAL_Y1;y++){ if(y%5===0) txt(s,lw+cw*(y-CAL_Y0)+cw/2,topH-8,narrow?String(y).slice(2):y,{'text-anchor':'middle',style:'fill:var(--muted);font-size:10.5px'}); }
    for(let m=1;m<=12;m++){ const yy=topH+(m-1)*cellH; txt(s,lw-6,yy+cellH/2+4,narrow?MONN[m-1].slice(0,3):cap1(MONN[m-1]),{'text-anchor':'end',style:'font-family:var(--f-body);font-size:12.5px;fill:var(--ink)'});
      for(let y=CAL_Y0;y<=CAL_Y1;y++){ const c=CAL[y*100+m]; const x=lw+cw*(y-CAL_Y0); const n=c?c.n:0;
        const fill=n?mixc(lo,hi,Math.sqrt(n/mx)):css('--grid');
        const r=el('rect',{class:n?'clickable':'',x:x+.5,y:yy+.5,width:Math.max(1,cw-1),height:cellH-1,rx:1.5,fill,opacity:n?1:.45,'data-tip':`${MONN[m-1]} ${y}: ${n?pn(n,'письмо','письма','писем')+'<br>нажмите — кому писал':'писем нет'}`},s);
        if(n) r.addEventListener('click',()=>calPick(y,m));
        if(n&&cw>=21){ const inkVar=dark?(lum(fill)>0.33?'--heat-ink-hi':'--heat-ink-lo'):(lum(fill)<0.33?'--heat-ink-hi':'--heat-ink-lo'); txt(s,x+cw/2,yy+cellH/2+4,n,{'text-anchor':'middle',style:`pointer-events:none;font-size:9.5px;fill:var(${inkVar})`}); } } }
    const sc=CAL[CAL_S.y*100+CAL_S.m]; if(sc) el('rect',{x:lw+cw*(CAL_S.y-CAL_Y0)-.5,y:topH+(CAL_S.m-1)*cellH-.5,width:cw+1,height:cellH+1,fill:'none',stroke:css('--ink'),'stroke-width':2,'pointer-events':'none'},s);
  }, $('#c-cal')); }
function calCard(){ const c=CAL[CAL_S.y*100+CAL_S.m]; const host=$('#cal-card'); if(!c) return;
  const names=Object.entries(c.names).sort((a,b)=>b[1]-a[1]); const day=Object.entries(c.days).sort((a,b)=>b[1]-a[1])[0];
  entityCard(host,{eyebrow:'Месяц',title:`${cap1(MONN[c.m-1])} ${c.y}`,meta:'кому писал в этом месяце; нажмите на адресата — его карточка',
    tiles:[[fmt(c.n),plural(c.n,'письмо','письма','писем')],[fmt(names.length),plural(names.length,'адресат','адресата','адресатов')],[fmt(c.w),'слов в письмах']],
    body:`<h4>Адресаты</h4><div class="yr-list">${names.slice(0,30).map(([nm,n])=>{ const i=ADR.findIndex(a=>a.nom===nm); return i>=0?`<button type="button" class="chip" data-adr="${i}">${esc(nm)} · ${n}</button>`:`<span class="chip static">${esc(nm)} · ${n}</span>`; }).join('')}${names.length>30?`<span class="chip static">ещё ${names.length-30}</span>`:''}</div>
      ${day&&day[1]>1?`<p class="hint" style="margin-top:12px">Больше всего писем за один день этого месяца — ${day[0]}-го: ${pn(day[1],'письмо','письма','писем')}.</p>`:''}`});
  host.querySelectorAll('button[data-adr]').forEach(b=>b.addEventListener('click',()=>selectAdr(+b.dataset.adr,true))); }
function calPick(y,m){ CAL_S.y=y; CAL_S.m=m; drawCal(); calCard(); }
drawCal(); calCard();

/* ================= IV.2 когда он писал адресату ================= */
const AT = {a:0,b:-1};
(function(){ const sa=$('#adr-sel'), sb=$('#adr-cmp');
  sb.innerHTML='<option value="-1">— без сравнения —</option>';
  ADR.forEach((a,i)=>{ const t=`${a.nom} (${a.n})`; sa.insertAdjacentHTML('beforeend',`<option value="${i}">${esc(t)}</option>`); sb.insertAdjacentHTML('beforeend',`<option value="${i}">${esc(t)}</option>`); });
  sa.addEventListener('change',()=>selectAdr(+sa.value,false)); sb.addEventListener('change',()=>{ AT.b=+sb.value; adrTL(AT.a); }); })();
function adrTL(i){ AT.a=i; const A_=ADR[i], B_=AT.b>=0?ADR[AT.b]:null; $('#adr-sel').value=i;
  legendTo($('#lg-adrtl'), [[`${A_.nom}: ${A_.n}`,'var(--s1)']].concat(B_?[[`${B_.nom}: ${B_.n}`,'var(--s2)']]:[]));
  chart(()=>{ const box=$('#c-adrtl'); const A2=ADR[AT.a], B2=AT.b>=0?ADR[AT.b]:null; const two=!!B2; const h=two?270:190; const [s,w]=svg(box,h); const L=36,R=8,T=14,B=24;
    const mid=two?Math.round((T+h-B)/2):h-B; const mx=niceMax(Math.max(...AY.map(y=>Math.max(A2.ys[y]||0,B2?B2.ys[y]||0:0)),1));
    const up=mid-T, dn=h-B-mid; const sy=v=>mid-up*v/mx, sy2=v=>mid+dn*v/mx; const bw=(w-L-R)/AY.length; const ax=el('g',{class:'ax'},s);
    ticks(mx,3).forEach(t=>{ el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt(t),{'text-anchor':'end'});
      if(two&&t>0){ el('line',{x1:L,x2:w-R,y1:sy2(t),y2:sy2(t),stroke:css('--grid')},ax); txt(ax,L-6,sy2(t)+4,fmt(t),{'text-anchor':'end'}); } });
    AY.forEach((y,k)=>{ const x=L+bw*k+1; const a=A2.ys[y]||0, b=B2?B2.ys[y]||0:0;
      if(a>0) el('rect',{x,y:sy(a),width:Math.max(1,bw-2),height:mid-sy(a),rx:Math.min(2,bw/3),fill:css('--s1')},s);
      if(b>0) el('rect',{x,y:mid,width:Math.max(1,bw-2),height:sy2(b)-mid,rx:Math.min(2,bw/3),fill:css('--s2')},s);
      if(y%5===0) txt(ax,x+bw/2-1,h-7,y,{'text-anchor':'middle'});
      el('rect',{class:'hit',x:x-1,y:T,width:bw,height:h-B-T,'data-tip':`<b>${y}</b><br>${esc(A2.nom)}: ${a}${B2?`<br>${esc(B2.nom)}: ${b}`:''}`},s); });
    el('line',{x1:L,x2:w-R,y1:mid,y2:mid,stroke:css('--axis')},s); }, $('#c-adrtl')); }

/* ================= II.5 строение рассказов рядом ================= */
const CMP = [];
(function(){ const sel=$('#cmp-sel'); SA.slice().sort((a,b)=>a.y-b.y||a.j-b.j).forEach(a=>{ const o=document.createElement('option'); o.value=a.j; o.textContent=`${a.y} · ${cut(a.t,48)}`; sel.appendChild(o); });
  $('#cmp-add').addEventListener('click',()=>cmpAdd(+sel.value,false));
  $('#cmp-clear').addEventListener('click',()=>{ CMP.length=0; cmpRender(); }); })();
function cmpAdd(j,fromCard){ const i=CMP.indexOf(j); if(i>=0) CMP.splice(i,1); if(CMP.length>=4) CMP.shift(); CMP.push(j); cmpRender();
  if(fromCard){ const b=$('#at-cmp'); if(b){ b.textContent='✓ добавлено — смотрите «Строение рядом» ниже'; } } }
function cmpCanvas(host,a,wpx,mxs){ const cv=document.createElement('canvas'); host.appendChild(cv); const H=54, dpr=Math.min(2,devicePixelRatio||1);
  cv.width=wpx*dpr; cv.height=H*dpr; cv.style.width=wpx+'px'; cv.style.height=H+'px'; const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const n=a.seq.length, bw=wpx/n; a.seq.forEach((v,i)=>{ const h=Math.max(1.5,(H-4)*Math.sqrt(v/mxs)); c.fillStyle=css(a.seqk[i]==='1'?'--mark':'--neutral-bar'); c.fillRect(i*bw,H-h,Math.max(.8,bw-.6),h); }); }
function cmpRender(){ const host=$('#cmp-list'); host.innerHTML='';
  if(!CMP.length){ host.innerHTML='<p class="note">Добавьте рассказы из списка или кнопкой «+ в сравнение строения» в атласе.</p>'; return; }
  const cw=host.clientWidth||600; const mxs=Math.max(...CMP.flatMap(j=>A[j].seq));
  CMP.slice().sort((x,y)=>A[x].y-A[y].y||x-y).forEach(j=>{ const a=A[j]; const row=document.createElement('div'); row.className='cmp-row';
    row.innerHTML=`<div class="h"><b><button type="button" data-j="${j}" data-tip="открыть в атласе">${esc(a.t)}</button></b><span>${a.y} · ${fmt(a.w)} слов · ${fmt(a.np)} абзацев · диалог ${fmt1(a.dlg)}% · фраза ${fmt1(a.sm||0)} слов</span><button type="button" class="x" data-x="${j}" aria-label="убрать из сравнения" data-tip="убрать">✕</button></div>`;
    host.appendChild(row); cmpCanvas(row,a,cw,mxs);
    row.querySelector('[data-j]').addEventListener('click',()=>selectStory(j,true)); row.querySelector('[data-x]').addEventListener('click',()=>{ CMP.splice(CMP.indexOf(j),1); cmpRender(); }); }); }
(function(){ const d=A.findIndex(a=>a.t==='Дама с собачкой'); const base=d>=0?A[d]:SA.filter(a=>a.y>=PERIODS[NPER-1][1]).sort((x,y)=>y.w-x.w)[Math.floor(SA.filter(a=>a.y>=PERIODS[NPER-1][1]).length/2)];
  PERIODS.forEach(([l,a0,b0])=>{ if(base.y>=a0&&base.y<=b0){ CMP.push(base.j); return; }
    const c=SA.filter(s=>s.y>=a0&&s.y<=b0&&!s.unf&&s.np>=20).sort((x,y)=>Math.abs(x.w-base.w)-Math.abs(y.w-base.w))[0]; if(c) CMP.push(c.j); });
  chart(cmpRender,$('#cmp-list')); })();

/* ================= методика: новые разделы ================= */
$('#metod-list').insertAdjacentHTML('beforeend',[
  `<b>Карта словаря</b> — ${WMD.length} самых частых слов рассказов и пьес; расстановка по окружению слов (t-SNE), группы посчитаны заранее (${EX.wgroups.length}). Размеры слов и красные слова периода считаются по рассказам: число употреблений в периоде делится на число слов рассказов этого периода; «заметно больше» — не реже чем в 1,5 раза, чем в среднем по всем годам, и не меньше 6 раз.`,
  `<b>Круг Чехова</b> — люди, названные по фамилии в письмах (${NN.length} имён). Связь между двумя именами — они названы в одном абзаце письма; раскладка сети и круги имён посчитаны заранее. Фамилия считается «среди адресатов», если она совпала с фамилией адресата; однофамильцы не различаются.`,
  `<b>Темы</b> — ${THN.length} тем, у каждой свой список слов; величина — число употреблений слов темы на 1000 слов текстов периода. Цвет в таблице считается внутри строки. «Рост» — последний период, сравнённый со средним по трём прежним. Письма 1880–1886 годов — всего ${fmt(PW_L[0])} слов, поэтому их цифры шаткие.`,
  `<b>Палитра периодов</b> — цветовые слова, найденные по словарю; ширина отрезка — доля слова среди цветовых слов периода. <b>Имена героев</b> — доля текстов периода, где имя встречается (рассказов и пьес в периоде: ${TXP.map((n,i)=>PER[i]+' — '+n).join('; ')}).`
].map(x=>`<li>${x}</li>`).join(''));

UI_READY = true; adrTL(0);
