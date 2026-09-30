/* ================= данные и общие помощники ================= */
const O = D.overview, P = D.prose, A = P.atlas, PL = D.plays, LT = D.letters, SW = D.swear, MD = D.medicine, W = D.words, LEX = D.lex;
const plural = (n, one, few, many) => { n=Math.abs(Math.round(n)); const m10=n%10, m100=n%100; return m10===1&&m100!==11?one:(m10>=2&&m10<=4&&(m100<12||m100>14)?few:many); };
const pn = (n, one, few, many) => `${fmt(n)} ${plural(n,one,few,many)}`;
const pct = v => fmt1(v)+'%';
function verdictHTML(v){ const m={yes:['v-yes','✓ подтверждается'],no:['v-no','✗ не подтверждается'],part:['v-part','≈ отчасти'],none:['v-part','цифрами не решается']}[v]||['v-part','—'];
  return `<span class="verdict ${m[0]}">${m[1]}</span>`; }
function legendTo(host, items){ host.innerHTML=items.map(([l,c])=>`<span><i style="background:${c}"></i>${esc(l)}</span>`).join(''); }
const SIGC = {'Чехонте':'--s1','Человек без селезёнки':'--c3','Брат моего брата':'--c4','Чехов':'--s2','А. Ч.':'--g5'};
const sigc = f => `var(${SIGC[f]||'--neutral-bar'})`;
const OTC = {'юмористические журналы':'--s1','газеты':'--s2','толстые журналы и книжки':'--c3','посмертно или нет данных':'--neutral-bar'};
const otc = o => `var(${OTC[o]||'--neutral-bar'})`;
const OT_ITEMS = Object.entries(OTC).map(([k,v])=>[k,`var(${v})`]);
const GRP = LT.strip.groups, GRPC = ['--s1','--s2','--c3','--c4','--neutral-bar'];
const PERIODS = [['1880–1886',1880,1886,'юмористические журналы'],['1887–1892',1887,1892,'«Степь», Сахалин'],['1893–1898',1893,1898,'Мелихово'],['1899–1904',1899,1904,'Ялта, МХТ']];
const TQ = t => `«${t}»`;
const cut = (s,n) => s.length>n ? s.slice(0,n-1)+'…' : s;
const MY = Object.fromEntries(D.myths.map(m=>[m.id,m]));
const ADR = LT.addressees;
const byYear = (arr,y) => arr.find(r=>r.y===y);

/* ================= шапка: кардиограмма ================= */
const ST = A.map((a,j)=>({...a,j})).filter(a=>a.y);
(function(){ const cnt={}, k={}; ST.forEach(a=>{ cnt[a.y]=(cnt[a.y]||0)+1; });
  ST.forEach(a=>{ k[a.y]=(k[a.y]||0)+1; a.t0 = a.y + (k[a.y]-0.5)/cnt[a.y]; }); })();
const LR = LT.strip.rows.map(r=>{ const y=Math.floor(r[0]/10000), m=Math.floor(r[0]/100)%100, d=r[0]%100; return {y,m,d,t0:y+((m||7)-1)/12+((d||15)-1)/372,w:r[1],g:r[2],to:LT.strip.names[r[3]]}; });
const MONN=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const hs = {hl:null, sel:null, yr:null}; let EC=null; let UI_READY=false;
function lexStories(k){ const L=LEX[k]; if(!L||!L[4].length) return null; const m=new Map(); for(let i=0;i<L[4].length;i+=2) m.set(L[4][i],L[4][i+1]); return m; }
function drawECG(){
  const box=$('#ecg'), cv=$('#ecg-cv'); const Wd=box.clientWidth; const dpr=Math.min(2,devicePixelRatio||1);
  const H = Wd<560?250:320; cv.width=Wd*dpr; cv.height=H*dpr; cv.style.height=H+'px';
  const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,Wd,H);
  const L=8,R=8,top=26,bot=22, mid=Math.round(top+(H-top-bot)*0.58); const t0=1875, t1=1905;
  const sx=t=>L+(Wd-L-R)*(t-t0)/(t1-t0);
  // миллиметровка
  const ring=css('--hring'); c.strokeStyle=ring; for(let x=L,i=0;x<=Wd-R;x+=6,i++){ c.globalAlpha=i%5?0.07:0.16; c.beginPath(); c.moveTo(x+.5,top-8); c.lineTo(x+.5,H-bot); c.stroke(); }
  for(let y=mid,i=0;y>=top-8;y-=6,i++){ c.globalAlpha=i%5?0.07:0.16; c.beginPath(); c.moveTo(L,y+.5); c.lineTo(Wd-R,y+.5); c.stroke(); }
  for(let y=mid,i=0;y<=H-bot;y+=6,i++){ c.globalAlpha=i%5?0.07:0.16; c.beginPath(); c.moveTo(L,y+.5); c.lineTo(Wd-R,y+.5); c.stroke(); }
  c.globalAlpha=1;
  // периоды
  c.font='11px "IBM Plex Mono", monospace'; c.fillStyle=css('--hlabel');
  PERIODS.forEach(([lab,a,b,name],i)=>{ const x=sx(a); c.globalAlpha=.35; c.fillRect(x,top-10,1,H-bot-top+10); c.globalAlpha=1;
    if(Wd>=560 || i%2===0) c.fillText(name,x+4,top-12); });
  const hi = hs.hl?lexStories(hs.hl):null; const upH=mid-top-4, dnH=H-bot-mid-4; const yr=hs.yr;
  if(yr!=null){ c.globalAlpha=.13; c.fillStyle=css('--hsel'); c.fillRect(sx(yr),top-10,sx(yr+1)-sx(yr),H-bot-top+10); c.globalAlpha=1; }
  const maxW=Math.log10(Math.max(...ST.map(a=>a.w))), maxL=Math.log10(Math.max(...LR.map(r=>r.w))+1);
  // письма вниз
  LR.forEach(r=>{ const h=Math.max(1,dnH*Math.log10(r.w+1)/maxL); c.fillStyle=css(GRPC[r.g]); c.globalAlpha=hi?.12:(yr!=null?(r.y===yr?.95:.12):.55); c.fillRect(sx(r.t0),mid+1,1,h); });
  // рассказы вверх
  const hiMax = hi&&hi.size ? Math.max(...[...hi.entries()].map(([j,n])=>n/A[j].w)) : 1;
  ST.forEach(a=>{ const h=Math.max(2,upH*Math.log10(a.w)/maxW); const on=hi?hi.has(a.j):(yr!=null?a.y===yr:true);
    c.globalAlpha=on?1:.14; c.fillStyle= (hi||yr!=null)&&on ? css('--hsel') : css(OTC[a.ot]||'--neutral-bar');
    const wbar = hi&&on ? 1.5+2*Math.min(1,(hi.get(a.j)/a.w)/hiMax) : (yr!=null&&on?3:1.6);
    c.fillRect(sx(a.t0)-wbar/2,mid-h,wbar,h);
    if(hs.sel===a.j){ c.globalAlpha=1; c.strokeStyle=css('--hsel'); c.lineWidth=1.5; c.strokeRect(sx(a.t0)-4,mid-h-4,8,h+4); } });
  c.globalAlpha=1; c.fillStyle=css('--hmark'); c.fillRect(L,mid,Wd-L-R,1);
  c.fillStyle=css('--hlabel'); c.font='10.5px "IBM Plex Mono", monospace'; c.textAlign='center';
  for(let y=1880;y<=1905;y+=5) c.fillText(y,sx(y),H-6); c.textAlign='left';
  c.fillText('рассказы ↑',L+2,mid-6); c.fillText('письма ↓',L+2,mid+14);
  EC={sx,mid,upH,dnH,maxW,maxL,W:Wd};
}
function ecgAt(e){ if(!EC) return null; const r=$('#ecg-cv').getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
  if(my<=EC.mid){ let best=null,bd=4; ST.forEach(a=>{ const d=Math.abs(EC.sx(a.t0)-mx); if(d<bd){bd=d;best=a;} }); return best?{k:'s',a:best}:null; }
  let best=null,bd=2; LR.forEach(l=>{ const d=Math.abs(EC.sx(l.t0)-mx); if(d<bd){bd=d;best=l;} }); return best?{k:'l',a:best}:null; }
const MON=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
$('#ecg-cv').addEventListener('pointermove',e=>{ const h=ecgAt(e); if(!h){ tip.hidden=true; return; }
  if(h.k==='s'){ const a=h.a; const n=hs.hl?(lexStories(hs.hl)||new Map()).get(a.j):null;
    showTipHTML(`<b>${esc(a.t)}</b><br>${a.y}${a.out?` · «${esc(a.out)}»`:''}<br>${fmt(a.w)} слов${n?`<br>«${esc(hs.hl)}»: ${n} раз`:''}`,e.clientX,e.clientY); }
  else { const l=h.a; showTipHTML(`<b>Письмо: ${esc(l.to)}</b><br>${l.d&&l.m?l.d+' '+MON[l.m-1]+' ':''}${l.y} · ${fmt(l.w)} слов`,e.clientX,e.clientY); } });
$('#ecg-cv').addEventListener('pointerleave',()=>{ tip.hidden=true; });
$('#ecg-cv').addEventListener('click',e=>{ const h=ecgAt(e); if(h&&h.k==='s') selectStory(h.a.j,true); });
legendTo($('#ecg-legend'), OT_ITEMS.map(([l,c])=>[l+' ↑',c]).concat(GRP.map((g,i)=>['письма: '+g,`var(${GRPC[i]})`])));
chart(drawECG, $('#ecg'));
function setHL(k){ hs.hl = k&&LEX[k]?k:null; drawECG();
  const m=hs.hl?lexStories(hs.hl):null;
  $('#hl-count').textContent = hs.hl ? (m?`«${hs.hl}»: ${fmt(LEX[hs.hl][1][0])} раз в ${pn(m.size,'рассказе','рассказах','рассказах')}`:`«${hs.hl}» есть больше чем в 120 рассказах — подсветка не показывается`) : ''; }
const LEXN={}; Object.keys(LEX).forEach(k=>{ LEXN[norm(k)]=k; }); const LEXK=Object.keys(LEXN);
function sugg(q,n=8){ const k=norm(q); if(!k) return []; const out=[]; for(const key of LEXK){ if(key.startsWith(k)){ out.push(LEXN[key]); if(out.length>=n) break; } } return out; }
const HL_EX=['скука','самовар','фельдшер','чахотка','шампанское','генерал','сад','ружье','дуэль','архиерей'].filter(k=>LEX[k]&&LEX[k][4].length);
function hlChips(list){ const h=$('#hl-chips'); h.innerHTML=''; list.forEach(k=>{ if(!LEX[k]) return; const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=k; b.addEventListener('click',()=>{ $('#hl-input').value=k; setHL(k); }); h.appendChild(b); }); }
hlChips(HL_EX);
$('#hl-input').addEventListener('input',e=>{ const q=e.target.value; const exact=LEXN[norm(q)]; if(exact) setHL(exact); else if(!q.trim()){ setHL(null); hlChips(HL_EX); } else hlChips(sugg(q)); });

const K = ADR[0], G2 = SW.groups;
$('#lede').innerHTML = `Тридцать томов академического собрания: ${pn(O.stories,'рассказ','рассказа','рассказов')} и повестей, ${pn(O.plays,'пьеса','пьесы','пьес')}, `+
  `${pn(O.letters,'письмо','письма','писем')} ${pn(LT.n_addr,'адресату','адресатам','адресатам')} — ${fmt1(O.total_words/1e6)} млн слов. `+
  `<strong>Письма по объёму — ${Math.round(100*O.letter_words/O.story_words)}% прозы</strong>: ${fmt(Math.round(O.letter_words/1000))} тыс. слов против ${fmt(Math.round(O.story_words/1000))} тыс. в рассказах. `+
  `Чем позже, тем длиннее рассказ и фраза и тем меньше разговора; врач в прозе появляется всё чаще, а сам он всё чаще пишет о своей болезни.`;
const FIG=[[fmt(O.stories),'рассказов и повестей'],[fmt(O.letters),plural(O.letters,'письмо','письма','писем')],[fmt(LT.n_addr),'адресатов'],
  [fmt(O.plays),plural(O.plays,'пьеса','пьесы','пьес')],[fmt1(O.total_words/1e6)+' млн','слов во всех текстах']];
$('#figures').innerHTML=FIG.map(([n,l])=>`<div class="fig"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

/* ================= I. обзор ================= */
const shortK = (()=>{ const m=MY.short.num.match(/в ([\d.]+) раза/); return m?m[1].replace('.',','):''; })();
const dp = MD.doctor_period;
const FIND=[
  [`×${shortK}`, 'во столько раз поздний рассказ (1888–1903) длиннее раннего (1880–1886) — по медиане слов'],
  [fmt(K.n), `${plural(K.n,'письмо','письма','писем')} О. Л. Книппер за ${K.y1-K.y0+1} лет (${LT.knipper_split['после (Книппер-Чеховой)']} — уже жене): больше, чем кому-либо; сестре — ${ADR[1].n} за ${ADR[1].y1-ADR[1].y0+1} год`],
  [`${fmt1(G2.letters.k23)} против ${fmt1(G2.speech.k23)}`, `бранных слов на 10 000: в письмах Чехова и в речи его персонажей; в письмах семье — ${fmt1((SW.by_to.find(r=>r[0]==='семье Чеховых')||[0,0,0,0])[3])}. Нижняя оценка: ${LT.cuts.n} мест вырезано`],
  [`${Math.round(100*dp[0][1]/dp[0][2])}% → ${Math.round(100*dp[3][1]/dp[3][2])}%`, `рассказов, где действует врач: в 1880–1886 (${dp[0][1]} из ${dp[0][2]}) и в 1899–1904 (${dp[3][1]} из ${dp[3][2]})`],
  [fmt(LT.titles.length), 'подписей с самоименованием: «Иеромонах Антоний», «Шиллер Шекспирович Гёте», «муж под башмаком»…'],
  [fmt(LT.cuts.n), `мест в письмах издатель заменил знаком «<…>»; больше всего — в письмах брату Александру (${LT.cuts.by_to[0][1]})`]];
$('#findings').innerHTML=FIND.map(([b,s])=>`<div><b>${b}</b><span>${s}</span></div>`).join('');
const MKEY={short:/[Кк]раткост/,gun:/ружь/,beauty:/должно быть вс[её] прекрасно/,slave:/раб/,wife:/законная жена/};
function around(t,rx,n=240){ const m=t.search(rx); if(m<0) return cut(t,n); let a=Math.max(0,m-90); if(a>0){ const sp=t.indexOf(' ',a); a=sp>0&&sp<m?sp+1:a; } let s=t.slice(a,a+n); if(a+n<t.length) s=s.slice(0,s.lastIndexOf(' '))+'…'; return (a>0?'…':'')+s; }
$('#myths').innerHTML=D.myths.map(m=>{ const s=(m.src||[])[0]; const q = s ? `<p class="num" style="font-style:italic">«${esc(around(s.text,MKEY[m.id]||/./))}»<br><span class="muted" style="font-style:normal;font-family:var(--f-mono);font-size:11.5px">${s.kind==='letter'?'письмо':s.kind==='play'?'пьеса, говорит '+esc(s.spk||''):''} · ${esc(s.title)}</span></p>` : '';
  return `<article><p class="q">${esc(m.q)}</p>${verdictHTML(m.v)}<p class="num">${esc(m.num).replace(/(\d)\.(\d)/g,'$1,$2')}</p>${q}</article>`; }).join('');

/* хронология */
function stackYears(box, years, series, {h=240, unit='', fmtv=fmt, notes=[], onYear=null, mark=null}={}){
  return chart(()=>{ const [s,w]=svg(box,h); const L=40,R=8,T=22,B=24; const tot=years.map((_,i)=>series.reduce((a,sr)=>a+(sr.v[i]||0),0));
    const max=niceMax(Math.max(...tot,1)); const bw=(w-L-R)/years.length; const sy=v=>h-B-(h-B-T)*v/max; const ax=el('g',{class:'ax'},s);
    ticks(max,4).forEach(t=>{ el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmtv(t),{'text-anchor':'end'}); });
    const every = w<560?5:(years.length>26?2:1);
    years.forEach((y,i)=>{ let acc=0; const x=L+bw*i+1;
      series.forEach(sr=>{ const v=sr.v[i]||0; if(v<=0) return; el('rect',{x,y:sy(acc+v),width:Math.max(1,bw-2),height:Math.max(.5,sy(acc)-sy(acc+v)),fill:sr.c},s); acc+=v; });
      if(y%every===0) txt(ax,x+bw/2-1,h-7,w<560?String(y).slice(2):y,{'text-anchor':'middle'});
      const hit=el('rect',{class:'hit'+(onYear?' clickable':''),x:x-1,y:T,width:bw,height:h-B-T,'data-tip':`<b>${y}</b>`+series.map(sr=>`<br>${esc(sr.k)}: ${fmtv(sr.v[i]||0)}${unit}`).join('')+(onYear?'<br>нажмите — что написано в этом году':'')},s);
      if(onYear) hit.addEventListener('click',()=>onYear(y)); });
    if(mark){ const my=mark(); const mi=years.indexOf(my); if(mi>=0){ el('rect',{x:L+bw*mi-.5,y:T-2,width:bw+1,height:h-B-T+2,fill:'none',stroke:css('--mark'),'stroke-width':1.5,'pointer-events':'none'},s); } }
    notes.forEach(n=>{ const i=years.indexOf(n.y); if(i<0) return; const x=L+bw*i+bw/2; el('line',{x1:x,x2:x,y1:T-6,y2:h-B,stroke:css('--muted'),'stroke-dasharray':'2 3'},s);
      txt(s,x+3,T-8,n.t,{style:'fill:var(--ink-2);font-size:10.5px'}); });
    el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s);
  }, box);
}
function firstTop(p){ const ys=Object.keys(LT.place_year).map(Number).sort((a,b)=>a-b); for(const y of ys){ const e=Object.entries(LT.place_year[y]).filter(([k])=>k!=='в пути и прочие').sort((a,b)=>b[1]-a[1])[0]; if(e&&e[0]===p&&e[1]>=10) return y; } return null; }
const YS = O.by_year.filter(r=>r.y>=1877).map(r=>r.y);
const by = y=>O.by_year.find(r=>r.y===y);
legendTo($('#lg-chrono'), [['рассказы и повести','var(--s1)'],['пьесы','var(--c3)'],['письма','var(--s2)']]);
const chronoDraw = stackYears($('#c-chrono'), YS, [{k:'рассказы',c:'var(--s1)',v:YS.map(y=>by(y).story_w/1000)},{k:'пьесы',c:'var(--c3)',v:YS.map(y=>by(y).play_w/1000)},{k:'письма',c:'var(--s2)',v:YS.map(y=>by(y).letter_w/1000)}],
  {fmtv:v=>fmt(Math.round(v)), unit:' тыс. слов', notes:['Мелихово','Ялта'].map(p=>({y:firstTop(p),t:p})).filter(n=>n.y), onYear:y=>yearCard(y,true), mark:()=>YR.y});
const bestStY = O.by_year.reduce((a,r)=>r.story_n>a.story_n?r:a);
const bestLY = LT.by_year.reduce((a,r)=>r.n>a.n?r:a);
const lastStories = O.by_year.filter(r=>r.y>=1893).reduce((a,r)=>a+r.story_n,0);
$('#f-chrono').textContent = `Больше всего рассказов вышло в ${bestStY.y} году — ${bestStY.story_n}. За последние двенадцать лет (1893–1904) их ${lastStories}, зато писем в ${bestLY.y}-м — ${bestLY.n}, больше, чем в любой другой год.`;
function heatYears(box, rows, years, M, {cellH=22, labelW=150, onRow=null, tipf=null, color='--heat-hi'}={}){
  return chart(()=>{ const narrow=box.clientWidth<560; const lw=narrow?Math.min(110,labelW):labelW; const topH=20; const h=topH+rows.length*cellH+4;
    const [s,w]=svg(box,h); const cw=(w-lw)/years.length; const mx=Math.max(...M.flat(),1); const lo=css('--heat-lo'), hi=css(color);
    years.forEach((y,j)=>{ if(y%(narrow?5:(cw<16?5:2))===0) txt(s,lw+cw*j+cw/2,topH-7,narrow?String(y).slice(2):y,{'text-anchor':'middle',style:'fill:var(--muted);font-size:10.5px'}); });
    rows.forEach((r,i)=>{ const y=topH+i*cellH;
      const lab=txt(s,lw-6,y+cellH/2+4,cut(r,Math.floor(lw/7.4)),{'text-anchor':'end',style:`font-family:var(--f-body);font-size:13px;fill:var(--ink)${onRow?';text-decoration:underline dotted':''}`});
      if(onRow){ const hit=el('rect',{class:'hit clickable',x:0,y,width:lw,height:cellH,tabindex:0,role:'button','aria-label':r},s);
        hit.addEventListener('click',()=>onRow(i)); hit.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onRow(i);} }); }
      years.forEach((yy,j)=>{ const v=M[i][j]; if(!v) return; el('rect',{x:lw+cw*j+.5,y:y+1,width:Math.max(1,cw-1),height:cellH-2,rx:1.5,fill:mixc(lo,hi,Math.sqrt(v/mx)),'data-tip':tipf?tipf(i,j):`${esc(r)} · ${yy}: ${v}`},s);
        if(cw>=20){ const f=mixc(lo,hi,Math.sqrt(v/mx)); txt(s,lw+cw*j+cw/2,y+cellH/2+4,v,{'text-anchor':'middle',style:`pointer-events:none;font-size:10px;fill:var(${lum(f)<0.33?'--heat-ink-hi':'--heat-ink-lo'})`}); } }); });
  }, box);
}
const PY = []; for(let y=1875;y<=1904;y++) PY.push(y);
const PR = LT.place_rows;
heatYears($('#c-places'), PR.map(r=>`${r.name} (${r.n})`), PY, PR.map(r=>PY.map(y=>r.ys[y]||0)), {labelW:250, cellH:21,
  tipf:(i,j)=>{ const r=PR[i], y=PY[j]; return `<b>${esc(r.name)}</b> · ${y}: ${pn(r.ys[y]||0,'письмо','письма','писем')}`+(r.members.length?`<br>${r.members.slice(0,8).map(([p,n])=>esc(p)+' '+n).join(', ')}`:''); }});
$('#t-places').innerHTML = PR.filter(r=>r.group&&r.members.length).map(r=>`<b>${esc(r.name)}</b>: ${r.members.map(([p,n])=>esc(p)+(n>1?' '+n:'')).join(', ')}.`.replace('<b>в дороге</b>:','<b>в дороге</b> (поезд, пароход, станции):')).join('<br>');

/* ================= II. проза ================= */
const SA = A.filter(a=>a.y);
const jit = i => (((i*2654435761)>>>0)%1000/1000-.5)*.8;
legendTo($('#lg-sig'), OT_ITEMS);
chart(()=>{ const box=$('#c-len'); const h=300; const [s,w]=svg(box,h); const L=48,R=12,T=12,B=26; const x0=1879.5,x1=1904;
  const lmin=Math.log10(50), lmax=Math.log10(Math.max(...SA.map(a=>a.w)));
  const sx=x=>L+(w-L-R)*(x-x0)/(x1-x0), sy=v=>h-B-(h-B-T)*(Math.log10(Math.max(50,v))-lmin)/(lmax-lmin); const ax=el('g',{class:'ax'},s);
  [100,300,1000,3000,10000,30000].forEach(t=>{ if(Math.log10(t)>lmax) return; el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt(t),{'text-anchor':'end'}); });
  for(let y=1880;y<=1904;y+=w<560?8:4) txt(ax,sx(y),h-8,y,{'text-anchor':'middle'});
  SA.forEach((a,k)=>{ const c=el('circle',{cx:sx(a.y+jit(k)),cy:sy(a.w),r:a.w>=10000?5:3.2,fill:otc(a.ot),opacity:.85,class:'clickable','data-tip':`<b>${esc(a.t)}</b>, ${a.y}<br>${fmt(a.w)} слов${a.out?' · «'+esc(a.out)+'»':''}`},s);
    c.addEventListener('click',()=>selectStory(a.j!=null?a.j:A.indexOf(a),true)); });
  const pr=P.by_year.filter(r=>r.n>=2); el('polyline',{points:pr.map(r=>`${sx(r.y)},${sy(r.w_med)}`).join(' '),fill:'none',stroke:css('--ink'),'stroke-width':1.5,'stroke-dasharray':'4 3'},s);
  txt(s,w-R-2,T+10,'пунктир — медиана года',{'text-anchor':'end',style:'fill:var(--ink-2);font-size:11px'});
  el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-len'));
A.forEach((a,j)=>{ a.j=j; });
const e86 = P.by_year.filter(r=>r.y<=1886), l88 = P.by_year.filter(r=>r.y>=1888);
const smE = Math.round(e86.reduce((a,r)=>a+r.s_med,0)/e86.length), smL = Math.round(l88.reduce((a,r)=>a+r.s_med,0)/l88.length);
$('#f-dlina').textContent = `«Краткость — сестра таланта» — это совет брату, а не путь самого Чехова: его рассказы со временем стали длиннее в ${shortK} раза, а типичная фраза — с ${smE} слов в 1880–1886 годах до ${smL} в 1888–1903.`;
dots($('#c-fraza'), P.by_year.map(r=>({l:w560(r.y), v:r.s_med, q1:r.s_q1, q3:r.s_q3, tip:`<b>${r.y}</b><br>типичная фраза: ${fmt1(r.s_med)} слов (${fmt1(r.s_q1)}–${fmt1(r.s_q3)})<br>рассказов: ${r.n}`})), {h:230, min:0, range:true, fmtv:v=>fmt(Math.round(v))});
function w560(y){ return String(y).slice(2); }
dots($('#c-dlg'), P.by_year.filter(r=>r.n>=2).map(r=>({l:w560(r.y), v:r.dlg, tip:`<b>${r.y}</b>: диалог ${fmt1(r.dlg)}% слов (${r.n} ${plural(r.n,'рассказ','рассказа','рассказов')})`})), {h:210, min:0, unit:'%'});
dots($('#c-ya'), P.by_year.filter(r=>r.n>=2).map(r=>({l:w560(r.y), v:r.ya, tip:`<b>${r.y}</b>: «я» ${fmt1(r.ya)} на 1000 слов повествования`})), {h:210, min:0});
const dE = P.by_year.filter(r=>r.y<=1886), dL = P.by_year.filter(r=>r.y>=1893);
const avg=(R,f)=>R.reduce((a,r)=>a+f(r)*r.n,0)/R.reduce((a,r)=>a+r.n,0);
$('#f-dialog').textContent = `В рассказах 1880–1886 годов разговор занимает ${Math.round(avg(dE,r=>r.dlg))}% слов, в 1893–1903 — ${Math.round(avg(dL,r=>r.dlg))}%: сценка уступает повествованию.`;
const ZN=[['!','восклицательный'],['?','вопросительный'],['…','многоточие'],['—','тире внутри фразы'],[';','точка с запятой'],['()','скобки']];
let zn='…';
function drawZn(){ const R=SA.filter(a=>a.w>=300); $('#u-znaki').textContent=`рассказы от 300 слов; точка — рассказ, пунктир — среднее по году`;
  chart(()=>{ const box=$('#c-znaki'); const h=270; const [s,w]=svg(box,h); const L=44,R_=12,T=12,B=26; const x0=1879.5,x1=1904;
    const vals=R.map(a=>a.pu[zn]); const vmax=niceMax(Math.max(...vals)*1.02); const sx=x=>L+(w-L-R_)*(x-x0)/(x1-x0), sy=v=>h-B-(h-B-T)*v/vmax; const ax=el('g',{class:'ax'},s);
    ticks(vmax,4).forEach(t=>{ el('line',{x1:L,x2:w-R_,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt1(t),{'text-anchor':'end'}); });
    for(let y=1880;y<=1904;y+=w<560?8:4) txt(ax,sx(y),h-8,y,{'text-anchor':'middle'});
    R.forEach((a,k)=>{ const c=el('circle',{cx:sx(a.y+jit(k)),cy:sy(a.pu[zn]),r:3,fill:otc(a.ot),opacity:.75,class:'clickable','data-tip':`<b>${esc(a.t)}</b>, ${a.y}<br>«${zn}»: ${fmt1(a.pu[zn])} на 1000 слов`},s); c.addEventListener('click',()=>selectStory(a.j,true)); });
    const ys=[...new Set(R.map(a=>a.y))].sort((a,b)=>a-b).filter(y=>R.filter(a=>a.y===y).length>=2);
    el('polyline',{points:ys.map(y=>{ const L2=R.filter(a=>a.y===y); return `${sx(y)},${sy(L2.reduce((q,a)=>q+a.pu[zn],0)/L2.length)}`; }).join(' '),fill:'none',stroke:css('--ink'),'stroke-width':1.5,'stroke-dasharray':'4 3'},s);
    el('line',{x1:L,x2:w-R_,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-znaki')); }
seg($('#sl-znak'), ZN.map(([k,l])=>[k,`${k} ${l}`]), zn, v=>{ zn=v; drawZn(); }); drawZn();
const pAvg=(R,k)=>R.reduce((a,r)=>a+r.pu[k]*r.w,0)/R.reduce((a,r)=>a+r.w,0);
const SE=SA.filter(a=>a.y<=1886), SL=SA.filter(a=>a.y>=1893);
$('#f-znaki').textContent = `Восклицательных знаков в 1880–1886 годах — ${fmt1(pAvg(SE,'!'))} на 1000 слов, в 1893–1903 — ${fmt1(pAvg(SL,'!'))}; многоточий — ${fmt1(pAvg(SE,'…'))} и ${fmt1(pAvg(SL,'…'))}.`;
/* подписи в печати */
const SGY = Object.keys(O.sig_year).map(Number).sort((a,b)=>a-b);
const SGF = ['Чехонте','Человек без селезёнки','Брат моего брата','А. Ч.','Чехов'];
stackYears($('#c-sigyear'), SGY, SGF.map(f=>({k:f,c:sigc(f),v:SGY.map(y=>O.sig_year[y][f]||0)})).concat([{k:'другие и без подписи',c:'var(--neutral-bar)',v:SGY.map(y=>Object.entries(O.sig_year[y]).filter(([k])=>!SGF.includes(k)).reduce((a,[,v])=>a+v,0))}]), {h:220});
hbars($('#c-chekhonte'), O.sig_forms_chekhonte.slice(0,6).map(([k,v])=>({l:cut(k.replace(/\[\d+\]/,''),26),v,c:'var(--s1)'})), {labelW:180, fmtv:v=>fmt(v)});
hbars($('#c-outlets'), O.outlets.slice(0,12).map(([k,v])=>({l:cut(k,24),v,c:'var(--s2)'})), {labelW:180, fmtv:v=>fmt(v)});
const fC = O.sig_family['Чехонте'], fT=O.stories, firstCh = SGY.find(y=>(O.sig_year[y]['Чехов']||0)>=5);
$('#f-pechat').textContent = `Под семейством «Чехонте» вышло ${fC} из ${fT} рассказов, но полное «Антоша Чехонте» — лишь в ${O.sig_forms_chekhonte.find(r=>r[0]==='Антоша Чехонте')[1]}: обычная подпись — «А. Чехонте». Своим именем он стал подписываться массово с ${firstCh} года; ${(()=>{ const nv=SA.filter(a=>a.out==='Новое время'&&a.y===firstCh); const k=nv.filter(a=>a.sf==='Чехов').length; return `в том же году в «Новом времени» вышли ${pn(nv.length,'его рассказ','его рассказа','его рассказов')}, подписью «Чехов» — ${k===nv.length?'все':k}.`; })()}`;
const OSIG = O.sig_other.filter(([k])=>/^[А-ЯЁ]/.test(k) && !/^С подлинным/.test(k)).map(([k,v])=>`«${k.replace(/\.$/,'')}»${v>1?' ×'+v:''}`);
$('#t-othersig').textContent = 'Другие подписи в печати: ' + OSIG.concat(['«Шампанский» и «Гайка № 9» (в разных частях тиража одного номера)']).join(', ') + '. В письмах сам Чехов упоминает ещё «Улисс», «Дяденька», «Крапива» (указатель псевдонимов т. 19).';

/* атлас */
const sel=$('#at-sel'); SA.slice().sort((a,b)=>a.y-b.y||a.j-b.j).forEach(a=>{ const o=document.createElement('option'); o.value=a.j; o.textContent=`${a.y} · ${cut(a.t,48)}`; sel.appendChild(o); });
function strucCanvas(host,a){ const cv=document.createElement('canvas'); host.appendChild(cv); const Wd=host.clientWidth||300; const H=46, dpr=Math.min(2,devicePixelRatio||1);
  cv.width=Wd*dpr; cv.height=H*dpr; cv.style.width=Wd+'px'; cv.style.height=H+'px'; const c=cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  const n=a.seq.length, bw=Wd/n, mx=Math.max(...a.seq); a.seq.forEach((v,i)=>{ const h=Math.max(1.5,(H-4)*Math.sqrt(v/mx)); c.fillStyle=css(a.seqk[i]==='1'?'--mark':'--neutral-bar'); c.fillRect(i*bw,H-h,Math.max(.8,bw-.6),h); }); }
function selectStory(j,scroll){ const a=A[j]; hs.sel=j; drawECG(); sel.value=j; const card=$('#at-card');
  card.innerHTML=`<div class="meta">${a.y}${a.yh!=='впервые'?' (год — '+esc(a.yh)+')':''} · т. ${a.vol}${a.unf?' · неоконченное':''} · ${esc(a.ot)}</div><div class="ttl">${esc(a.t)}</div>
  <div class="src">${a.out?'«'+esc(a.out)+'» · ':''}подпись: ${esc(a.sig||a.sf)}</div>
  <div class="tiles"><div><b>${fmt(a.w)}</b><span>слов</span></div><div><b>${fmt(a.np)}</b><span>абзацев</span></div><div><b>${fmt1(a.dlg)}%</b><span>диалог</span></div>
  <div><b>${fmt1(a.sm||0)}</b><span>слов в фразе (медиана)</span></div><div><b>${fmt1(a.ya)}</b><span>«я» на 1000 слов</span></div><div><b>${fmt1(a.pu['!'])}</b><span>«!» на 1000 слов</span></div></div>
  <p style="margin:0 0 6px"><button type="button" class="btn" id="at-cmp">+ в сравнение строения</button></p>
  <h4>Строение</h4><div id="at-struc"></div><h4>Первая фраза</h4><p class="quote">${esc(a.first)}</p><h4>Последняя фраза</h4><p class="quote">${esc(a.last)}</p>`;
  strucCanvas($('#at-struc'),a); $('#at-cmp').addEventListener('click',()=>cmpAdd(j,true)); if(scroll) $('#atlas').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}); }
sel.addEventListener('change',()=>selectStory(+sel.value,false));
$('#at-rand').addEventListener('click',()=>{ const a=SA[Math.floor(Math.random()*SA.length)]; selectStory(a.j,false); });
chart(()=>{ if(hs.sel==null){ const d=A.findIndex(a=>a.t==='Дама с собачкой'); selectStory(d>=0?d:SA[0].j,false); hs.sel=null; drawECG(); } }, null);

/* ================= III. пьесы ================= */
const PS = PL.slice().sort((a,b)=>a.y-b.y);
const psel=$('#pl-sel'); PS.forEach((p,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=`${p.y} · ${p.t}`; psel.appendChild(o); });
function drawPlay(i){ const p=PS[i]; psel.value=i; $('#u-kto').textContent=`слов речи: ${fmt(p.speech_w)}, персонажей со словами: ${p.speakers}`;
  hbars($('#c-kto'), p.top.map(([k,v])=>({l:cut(k,22),v,c:p.doctors.some(d=>d.split(/[ ,]/).some(x=>x.length>3&&k.includes(x)))?'var(--s1)':'var(--s2)'})), {labelW:170, fmtv:v=>fmt(v)});
  $('#t-cast').textContent = p.doctors.length ? `Врач в этой пьесе (выделен красным): ${p.doctors.join('; ')}` : 'Врача в списке действующих лиц этой пьесы нет.'; }
psel.addEventListener('change',()=>drawPlay(+psel.value)); drawPlay(PS.findIndex(p=>p.t==='Дядя Ваня'));
const big4=['Чайка','Дядя Ваня','Три сестры','Вишневый сад'];
hbars($('#c-pauzy'), PS.map(p=>({l:`${p.y} ${cut(p.t,18)}`,v:p.pause_k,c:big4.includes(p.t)?'var(--s1)':'var(--neutral-bar)',tip:`<b>${esc(p.t)}</b>: «Пауза» ${p.pauses} раз, ${fmt1(p.pause_k)} на 1000 слов речи`})), {labelW:170, fmtv:fmt1});
hbars($('#c-remarki'), PS.map(p=>({l:`${p.y} ${cut(p.t,18)}`,v:p.stage_n*1000/p.speech_w,c:big4.includes(p.t)?'var(--s1)':'var(--neutral-bar)'})), {labelW:170, fmtv:v=>fmt(Math.round(v))});
const maxSp = PS.reduce((a,p)=>{ const t=p.top[0]; return t&&t[1]>a[1]?[p.t,t[1],t[0]]:a; },['',0,'']);
$('#f-kto').textContent = `Самая большая роль — ${maxSp[2]} в пьесе «${maxSp[0]}» (${fmt(maxSp[1])} слов). В «Трёх сёстрах» слова распределены ровнее всего: у главного по объёму персонажа лишь ${Math.round(100*PS.find(p=>p.t==='Три сестры').top[0][1]/PS.find(p=>p.t==='Три сестры').speech_w)}% речи.`;
const bz=PS.find(p=>p.t==='Безотцовщина');
const pnum=MY.pause.num.replace(/(\d)\.(\d)/g,'$1,$2');
$('#f-pauzy').textContent = `${pnum[0].toUpperCase()+pnum.slice(1)}. Пауз больше всего в «Трёх сёстрах», но в ранней пьесе «Безотцовщина» их уже ${bz.pauses} — почти как в поздних.`;

/* ================= IV. письма ================= */
const LY = LT.by_year.filter(r=>r.y>=1880);
chart(()=>{ const box=$('#c-months'); const h=200; const [s,w]=svg(box,h); const L=36,R=8,T=12,B=24; const t0=1880,t1=1905;
  const ym=LT.ym.filter(r=>r[0]>=1880); const mx=niceMax(Math.max(...ym.map(r=>r[2]))); const sx=t=>L+(w-L-R)*(t-t0)/(t1-t0), sy=v=>h-B-(h-B-T)*v/mx; const ax=el('g',{class:'ax'},s);
  ticks(mx,3).forEach(t=>{ el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt(t),{'text-anchor':'end'}); });
  for(let y=1880;y<=1905;y+=5) txt(ax,sx(y),h-7,y,{'text-anchor':'middle'});
  const bw=Math.max(1,(w-L-R)/300-0.5);
  ym.forEach(([y,m,n])=>{ el('rect',{x:sx(y+(m-1)/12),y:sy(n),width:bw,height:sy(0)-sy(n),fill:css('--s2'),'data-tip':`${MONN[m-1]} ${y}: ${n} ${plural(n,'письмо','письма','писем')}`},s); });
  el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-months'));
const bestM = LT.ym.reduce((a,r)=>r[2]>a[2]?r:a);
hbars($('#c-placebars'), LT.places.slice(0,12).map(([k,v])=>({l:k,v,c:'var(--s2)'})), {labelW:130, fmtv:v=>fmt(v)});
dots($('#c-letlen'), LT.len_year.filter(r=>r.y>=1883).map(r=>({l:w560(r.y),v:r.med,tip:`<b>${r.y}</b>: типичное письмо ${fmt(Math.round(r.med))} слов`})), {h:210, min:0, fmtv:v=>fmt(Math.round(v))});
const lyE=LT.len_year.filter(r=>r.y>=1886&&r.y<=1892), lyL=LT.len_year.filter(r=>r.y>=1900);
$('#f-gde').textContent = `Больше всего писем написано из Ялты (${LT.places[0][1]}), Москвы (${LT.places[1][1]}) и Мелихова (${LT.places[2][1]}). Самый «письменный» месяц — ${MONN[bestM[1]-1]} ${bestM[0]} года: ${bestM[2]} ${plural(bestM[2],'письмо','письма','писем')}. К концу жизни письма стали короче: типичное письмо в 1886–1892 — около ${Math.round(lyE.reduce((a,r)=>a+r.med,0)/lyE.length)} слов, в 1900–1904 — около ${Math.round(lyL.reduce((a,r)=>a+r.med,0)/lyL.length)}.`;
/* адресаты */
const AY = []; for(let y=1875;y<=1904;y++) AY.push(y);
const A25 = ADR.slice(0,25);
heatYears($('#c-adr'), A25.map(a=>`${a.nom} (${a.n})`), AY, A25.map(a=>AY.map(y=>a.ys[y]||0)), {labelW:220, onRow:i=>selectAdr(i,true), color:'--s1'});
function selectAdr(i,scroll){ const a=ADR[i]; const card=$('#adr-card'); if($('#adr-sel')) $('#adr-sel').value=i; if(UI_READY) adrTL(i);
  const li=(arr,f)=>arr.length?'<div class="mini">'+arr.map(([k,v])=>`<span>${esc(f?f(k):k)}</span><span class="muted" style="font-family:var(--f-mono);font-size:12px">${v}</span>`).join('')+'</div>':'<p class="note">—</p>';
  card.innerHTML=`<div class="meta">${a.fam?esc(a.fam)+' · ':''}${a.y0}–${a.y1}</div><div class="ttl">${esc(a.nom)}</div>
  <div class="tiles"><div><b>${fmt(a.n)}</b><span>${plural(a.n,'письмо','письма','писем')}</span></div><div><b>${fmt(Math.round(a.w/a.n))}</b><span>слов в среднем</span></div><div><b>${fmt(a.cuts)}</b><span>купюр издателя</span></div></div>
  <div class="grid2" style="gap:0 24px"><div><h4>Как обращался</h4>${li(a.sal.slice(0,5))}<h4>Откуда писал</h4>${li(a.places.filter(p=>p[0]).slice(0,4))}</div>
  <div><h4>Как подписывался</h4>${li(a.sigfam.slice(0,5))}<h4>Формула прощания</h4>${li(a.formulas.slice(0,4))}${a.titles.length?'<h4>Самоименования</h4>'+li(a.titles.slice(0,5)):''}</div></div>`;
  if(scroll) card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'}); }
selectAdr(0,false);
$('#f-adr').textContent = `${pn(LT.n_addr,'адресат','адресата','адресатов')}, из них ${LT.addr_1} получили от Чехова всего одно письмо. Родным — ${pct(LT.family_share)} писем. Книппер он писал ${K.n} раз за ${K.y1-K.y0+1} лет; Суворину — ${ADR[2].n} за ${ADR[2].y1-ADR[2].y0+1} лет, а после ${ADR[2].y1} года переписка обрывается.`;
$('#salut').innerHTML = ADR.slice(0,18).filter(a=>a.sal.length).map(a=>`<article><h4>${esc(a.nom)}</h4>${a.sal.filter(([k])=>!/^\d/.test(k)).slice(0,3).map(([k,v])=>`<p>${esc(k)}<span>×${v}</span></p>`).join('')}</article>`).join('');
/* подписи */
const NF = ['А. Чехов','Antoine','Antonio','А.','Антон','Чехов','Антон Чехов','Чехонте','другие имена','без имени','без подписи'];
const NFC = {'А. Чехов':'--neutral-bar','Antoine':'--s1','Antonio':'--c4','А.':'--s2','Антон':'--c3','Чехов':'--g6','Антон Чехов':'--g5','Чехонте':'--g7','другие имена':'--g8','без имени':'--fold','без подписи':'--rule'};
legendTo($('#lg-podp'), NF.map(f=>[f,`var(${NFC[f]})`]));
const FY = Object.keys(LT.sig_fam_year).map(Number).filter(y=>y>=1880).sort((a,b)=>a-b);
stackYears($('#c-podp'), FY, NF.map(f=>({k:f,c:`var(${NFC[f]})`,v:FY.map(y=>LT.sig_fam_year[y][f]||0)})), {h:240});
chart(()=>{ const box=$('#c-podpto'); const rows=ADR.slice(0,10); const rowH=26; const h=rows.length*rowH+10; const [s,w]=svg(box,h); const lw=Math.min(170,w*.38);
  rows.forEach((a,i)=>{ const y=i*rowH+4; txt(s,lw-8,y+14,cut(a.nom,20),{'text-anchor':'end',style:'font-family:var(--f-body);font-size:13px;fill:var(--ink)'});
    let acc=0; const tot=a.n; a.sigfam.forEach(([k,v])=>{ const x=lw+(w-lw-4)*acc/tot, ww=(w-lw-4)*v/tot; el('rect',{x,y,width:Math.max(.5,ww-.5),height:rowH-8,fill:`var(${NFC[k]||'--rule'})`,'data-tip':`${esc(a.nom)}: ${esc(k)} — ${v} из ${tot}`},s); acc+=v; }); }); }, $('#c-podpto'));
hbars($('#c-formula'), LT.formulas.slice(0,12).map(([k,v])=>({l:cut(k,26),v,c:'var(--s2)'})), {labelW:200, fmtv:v=>fmt(v)});
const sf=LT.sig_fam, tot=LT.n;
$('#f-podp').textContent = `Обычная подпись — «А. Чехов» (${pct(100*sf['А. Чехов']/tot)} писем). Но сестре, брату Ивану и жене он всё чаще пишет «Antoine» (${sf['Antoine']}) и «Antonio» (${sf['Antonio']}), а Книппер больше всего — просто «А.» (${K.sigfam.find(r=>r[0]==='А.')?.[1]||0} из ${K.n}).`;
/* кунсткамера */
const TG = LT.title_groups.filter(g=>g[1]>0);
let tg='все';
function drawTitles(){ const rows=LT.titles.filter(r=>tg==='все'||r.g===tg); const seen=new Set(); const uniq=[];
  rows.forEach(r=>{ const k=r.t+'|'+r.to; if(seen.has(k)) return; seen.add(k); uniq.push({...r,n:rows.filter(x=>x.t===r.t&&x.to===r.to).length}); });
  $('#kunst-list').innerHTML = uniq.map(r=>`<article><div class="sig">${esc(r.full.replace(/<([^<>…]{1,30})>/g,'$1'))}</div><div class="who">${esc(r.to)}, ${r.y}${r.n>1?` · ещё ${r.n-1} ${plural(r.n-1,'раз','раза','раз')}`:''} · ${esc(r.g)}</div></article>`).join(''); }
seg($('#sl-kunst'), [['все','все']].concat(TG.map(([g,n])=>[g,`${g} (${n})`])), 'все', v=>{ tg=v; drawTitles(); }); drawTitles();
const tTo = {}; LT.titles.forEach(r=>{ tTo[r.to]=(tTo[r.to]||0)+1; }); const tTop=Object.entries(tTo).sort((a,b)=>b[1]-a[1]);
$('#f-kunst').textContent = `В ${pn(LT.titles.length,'подписи','подписях','подписях')} Чехов называет себя не только по имени: иеромонахом и архимандритом, академиком и камергером, «мужем под башмаком» и «Шиллером Шекспировичем Гёте». Больше всего таких подписей получили ${tTop[0][0]} (${tTop[0][1]}) и ${tTop[1][0]} (${tTop[1][1]}).`;
/* брань */
hbars($('#c-bran'), [{l:'письма',v:G2.letters.k23,c:'var(--s2)'},{l:'повествование',v:G2.narration.k23,c:'var(--neutral-bar)'},{l:'речь персонажей',v:G2.speech.k23,c:'var(--s1)'}], {labelW:140, fmtv:fmt1});
hbars($('#c-branto'), SW.by_to.slice(0,12).map(([k,n,w,r])=>({l:cut(k,22),v:r,c:'var(--s2)',tip:`${esc(k)}: ${n} ${plural(n,'бранное слово','бранных слова','бранных слов')} на ${fmt(w)} слов`})), {labelW:170, fmtv:fmt1});
const BW = SW.top.filter(([k])=>!['черт','чертовски','чертовый','чертик','чертов','чертовский','дьявол','окаянный','дьявольский'].includes(k)).slice(0,14);
hbars($('#c-branw'), BW.map(([k,v])=>{ const e=SW.examples[k]; return {l:k,k,v,c:'var(--s1)',click:hasWord(k),tip:(e?`<b>${esc(k)}</b><br>«${esc(e.s)}»<br>${esc(e.to)}, ${e.y}`:k)+(hasWord(k)?'<br>нажмите — слово в словоискателе':'')}; }), {labelW:110, fmtv:v=>fmt(v), onClick:r=>openWord(r.k)});
hbars($('#c-cuts'), LT.cuts.by_to.slice(0,10).map(([k,v])=>({l:cut(k.split(',')[0],22),v,c:'var(--c3)'})), {labelW:170, fmtv:v=>fmt(v)});
$('#cutw').innerHTML = LT.cuts.inword.map(r=>`<span>${esc(r.w)}<small>${esc(r.to)}, ${r.y}</small></span>`).join('');
const brFam = SW.by_to.find(r=>r[0]==='семье Чеховых'), brK = SW.by_to.find(r=>r[0]==='О. Л. Книппер');
$('#f-bran').textContent = `В письмах ${fmt1(G2.letters.k23)} бранных слова на 10 000 — меньше, чем в повествовании его рассказов (${fmt1(G2.narration.k23)}), и впятеро меньше, чем в речи персонажей (${fmt1(G2.speech.k23)}). Но всё зависит от адресата: семье — ${fmt1(brFam[3])}, Книппер — ${fmt1(brK[3])}. А «чёрт» он поминает ${SW.top.find(r=>r[0]==='черт')[1]} раз.`;
$('#w-bran').innerHTML = `Это нижняя оценка. Издание 1974–1983 годов печатало письма «без купюр (за исключением мест, неудобных для печати)», и таких мест в письмах ${LT.cuts.n}: издатель заменил слово знаком «&lt;…&gt;». Больше всего вырезано в письмах брату Александру, Суворину и Лейкину. Полного текста без купюр на диске нет.`;

/* ================= V. врач ================= */
const LB = MD.labels, LBC = MD.label_counts;
const LAB = {advice:['совет другому','--s1'],practice:['практика и случаи','--s2'],own:['своё здоровье','--c3'],views:['о медицине вообще','--c4']};
legendTo($('#lg-prakt'), Object.entries(LAB).map(([k,[l,c]])=>[`${l} (${LBC[k]||0})`,`var(${c})`]));
const MY_ = []; for(let y=1882;y<=1904;y++) MY_.push(y);
stackYears($('#c-prakt'), MY_, Object.entries(LAB).map(([k,[l,c]])=>({k:l,c:`var(${c})`,v:MY_.map(y=>(MD.label_year[y]||{})[k]||0)})), {h:210});
let pk='advice';
function drawPrakt(){ const rows=LB.filter(r=>r.lab===pk).sort((a,b)=>a.y-b.y);
  $('#prakt-list').innerHTML=rows.map(r=>`<article><div class="lab">${r.y} · ${esc(r.to)}${r.prob?' · '+esc(r.prob):''}${r.rem?' → '+esc(r.rem):''}</div><p class="quote">«${esc(r.q)}»</p></article>`).join(''); }
seg($('#sl-prakt'), Object.entries(LAB).map(([k,[l]])=>[k,`${l} (${LBC[k]||0})`]), pk, v=>{ pk=v; drawPrakt(); }); drawPrakt();
const mnum=MY.medicine.num.replace(/(\d)\.(\d)/g,'$1,$2');
const pkY = Object.entries(MD.label_year).reduce((a,[y,c])=>((c.advice||0)+(c.practice||0))>a[1]?[y,(c.advice||0)+(c.practice||0)]:a,['',0]);
$('#f-prakt').textContent = `${mnum[0].toUpperCase()+mnum.slice(1)}. Больше всего советов и практики — в ${pkY[0]} году (${pkY[1]}); в письмах этого года — холерный участок. После 1897-го врач в письмах всё чаще сам оказывается больным.`;
$('#t-prakt').textContent = `Как отбиралось. Из писем взяты абзацы по двум правилам, записанным заранее: лекарство или лечение рядом с повелительным наклонением или дозой; больной, холера, участок, вскрытие рядом с «лечил», «принимал», «мои больные». Получилось ${LB.length} абзацев. Модель прочла каждый и отнесла к одной из групп; ${LBC.other||0} оказались не о медицине («пей чай», собака по кличке Бром). Это нижняя оценка: совет без слов из словаря правило не найдёт.`;
const OY = MD.own_year.filter(r=>r[0]>=1883);
dots($('#c-bolezn'), OY.map(([y,n,t])=>({l:w560(y),v:100*n/t,tip:`<b>${y}</b>: ${n} из ${t} писем`})), {h:220, min:0, max:25, steps:5, unit:'%', fmtv:v=>fmt(Math.round(v))});
const oE=OY.filter(r=>r[0]<=1896), oL=OY.filter(r=>r[0]>=1897); const sh=(R)=>100*R.reduce((a,r)=>a+r[1],0)/R.reduce((a,r)=>a+r[2],0);
$('#f-bolezn').textContent = `До 1897 года о своём здоровье он пишет в ${fmt1(sh(oE))}% писем, после мартовского кровохарканья 1897-го — в ${fmt1(sh(oL))}%. В 1903-м почти каждое четвёртое письмо — о кашле, плеврите, температуре.`;
legendTo($('#lg-medw'), [['письма','var(--s2)'],['рассказы','var(--s1)']]);
chart(()=>{ const box=$('#c-medw'); const h=220; const [s,w]=svg(box,h); const L=40,R=10,T=12,B=24; const x0=1880,x1=1904;
  const ly=MD.letters_year, sy_=MD.stories_year; const mx=niceMax(Math.max(...ly.map(r=>r.all),...sy_.map(r=>r.all)));
  const sx=x=>L+(w-L-R)*(x-x0)/(x1-x0), sy=v=>h-B-(h-B-T)*v/mx; const ax=el('g',{class:'ax'},s);
  ticks(mx,4).forEach(t=>{ el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt(t),{'text-anchor':'end'}); });
  for(let y=1880;y<=1904;y+=w<560?8:4) txt(ax,sx(y),h-7,y,{'text-anchor':'middle'});
  [[ly,'--s2','письма'],[sy_,'--s1','рассказы']].forEach(([R_,c,nm])=>{ el('polyline',{points:R_.map(r=>`${sx(r.y)},${sy(r.all)}`).join(' '),fill:'none',stroke:css(c),'stroke-width':2},s);
    R_.forEach(r=>el('circle',{cx:sx(r.y),cy:sy(r.all),r:3.5,fill:css(c),'data-tip':`<b>${nm}, ${r.y}</b><br>${fmt1(r.all)} медицинских слов на 10 000 (из ${fmt(r.w)} слов)`},s)); });
  el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-medw'));
hbars($('#c-vrachi'), MD.doctor_period.map(([l,n,t])=>({l,v:100*n/t,c:'var(--s1)',tip:`${l}: ${n} из ${t} рассказов`})), {labelW:110, unit:'%', fmtv:v=>fmt(Math.round(v))});
$('#t-docs').innerHTML = PS.filter(p=>p.doctors.length).map(p=>`<article><div class="lab">${p.y} · ${esc(p.t)}</div><p class="quote" style="font-size:15.5px">${esc(p.doctors.join('; '))}</p></article>`).join('');
$('#f-vrachi').textContent = `В рассказах 1880–1886 годов врач действует в ${Math.round(100*dp[0][1]/dp[0][2])}%, в 1893–1898 — в ${Math.round(100*dp[2][1]/dp[2][2])}%, в 1899–1904 — в ${Math.round(100*dp[3][1]/dp[3][2])}%. ${(()=>{ const B5=['Иванов','Чайка','Дядя Ваня','Три сестры','Вишневый сад'].map(t=>PS.find(p=>p.t===t)).filter(Boolean); const w=B5.filter(p=>p.doctors.length), wo=B5.filter(p=>!p.doctors.length); return `Из пяти больших пьес врач есть в ${w.length}: ${w.map(p=>'«'+p.t+'»').join(', ')}${wo.length?'; нет — в пьесе '+wo.map(p=>'«'+p.t+'»').join(', '):''}.`; })()}`;
$('#t-docst').textContent = 'Рассказы, где врач назван 3 раза и больше, в последние годы: ' + MD.doctor_stories.filter(r=>r.y>=1892).map(r=>`«${r.t}» (${r.y})`).join(', ') + '.';

/* ================= VI. слова ================= */
let sub='stories', posk='сущ';
const SUBN={stories:'рассказы',plays:'пьесы (речь)',letters:'письма'};
function drawTop(){ hbars($('#c-top'), W.top[sub][posk].slice(0,20).map(([k,v])=>({l:k,k,v,c:sub==='letters'?'var(--s2)':sub==='plays'?'var(--c3)':'var(--s1)',click:hasWord(k),tip:`${esc(k)}: ${fmt1(v)} на 10 000 слов`+(hasWord(k)?'<br>нажмите — слово в словоискателе':'')})), {labelW:130, fmtv:fmt1, onClick:r=>openWord(r.k)}); }
seg($('#sl-sub'), Object.entries(SUBN), sub, v=>{ sub=v; drawTop(); });
seg($('#sl-pos'), [['сущ','существительные'],['глаг','глаголы'],['прил','прилагательные']], posk, v=>{ posk=v; drawTop(); }); drawTop();
const tl=W.top.letters['сущ'].slice(0,4).map(r=>r[0]), ts=W.top.stories['сущ'].slice(0,4).map(r=>r[0]), tp=W.top.plays['прил'].slice(0,4).map(r=>r[0]);
$('#f-slovar').textContent = `В рассказах чаще всего ${ts.map(TQ).join(', ')} — тело и взгляд; в письмах ${tl.map(TQ).join(', ')} — ремесло и почта. В пьесах среди прилагательных впереди ${tp.map(TQ).join(', ')}.`;
function wsShow(k){ const L=LEX[k]; if(!L) return; $('#ws-title').textContent=`«${k}»: ${fmt(L[0])} ${plural(L[0],'раз','раза','раз')}`;
  const ps=W.pw_s, pl=W.pw_l;
  chart(()=>{ const box=$('#c-ws'); const h=200; const [s,w]=svg(box,h); const L_=40,R=10,T=14,B=26; const per=W.periods;
    const vs=per.map((_,i)=>ps[i]?1e4*L[2][i]/ps[i]:0), vl=per.map((_,i)=>pl[i]?1e4*L[3][i]/pl[i]:0); const mx=niceMax(Math.max(...vs,...vl,0.1));
    const gw=(w-L_-R)/per.length; const sy=v=>h-B-(h-B-T)*v/mx; const ax=el('g',{class:'ax'},s);
    ticks(mx,3).forEach(t=>{ el('line',{x1:L_,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L_-6,sy(t)+4,fmt1(t),{'text-anchor':'end'}); });
    per.forEach((p,i)=>{ const x=L_+gw*i; [[vs[i],'--s1','рассказы',L[2][i]],[vl[i],'--s2','письма',L[3][i]]].forEach(([v,c,nm,n],j)=>{ const bw=gw*0.34; const xx=x+gw*0.14+j*bw;
        el('rect',{x:xx,y:sy(v),width:bw-2,height:Math.max(0,sy(0)-sy(v)),fill:css(c),'data-tip':`${nm}, ${p}: ${fmt1(v)} на 10 000 (${n} раз)`},s); });
      txt(ax,x+gw/2,h-8,p,{'text-anchor':'middle'}); });
    el('line',{x1:L_,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-ws'));
  hbars($('#c-ws2'), [{l:'рассказы',v:L[1][0],c:'var(--s1)'},{l:'пьесы',v:L[1][1],c:'var(--c3)'},{l:'письма',v:L[1][2],c:'var(--s2)'}], {labelW:90, fmtv:v=>fmt(v)});
  const m=lexStories(k); $('#ws-note').textContent = m ? `В ${pn(m.size,'рассказе','рассказах','рассказах')}. Подсветить их в шапке — поле «Подсветить слово».` : ''; }
const WS_EX=['скука','деньги','чай','море','любовь','водка','театр','сад','доктор','пьеса'];
function wsChips(list){ const h=$('#ws-chips'); h.innerHTML=''; list.forEach(k=>{ if(!LEX[k]) return; const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=k; b.addEventListener('click',()=>{ $('#ws-input').value=k; wsShow(k); }); h.appendChild(b); }); }
legendTo($('#lg-ws'), [['рассказы','var(--s1)'],['письма','var(--s2)']]);
wsChips(WS_EX); wsShow(LEX['скука']?'скука':Object.keys(LEX)[0]);
$('#ws-input').addEventListener('input',e=>{ const q=e.target.value; const ex=LEXN[norm(q)]; if(ex) wsShow(ex); else if(!q.trim()) wsChips(WS_EX); else wsChips(sugg(q)); });
let epk='stories';
function drawEp(){ $('#ep-grid').innerHTML = W.epochs[epk].map(([lab,rows])=>`<div class="era"><div class="h"><b>${lab}</b><span>${esc((PERIODS.find(p=>p[0]===lab)||[])[3]||'')}</span></div><ul class="wl">${rows.slice(0,14).map(r=>`<li>${hasWord(r[0])?`<button type="button" data-k="${esc(r[0])}" data-tip="открыть в словоискателе">${esc(r[0])}</button>`:`<span>${esc(r[0])}</span>`}<span style="font-family:var(--f-mono);font-size:11.5px;color:var(--muted);text-align:right">${r[2]} · ${pn(r[3],epk==='stories'?'рассказ':'письмо',epk==='stories'?'рассказа':'письма',epk==='stories'?'рассказов':'писем')}</span></li>`).join('')}</ul></div>`).join(''); }
function bindEp(){ $('#ep-grid').querySelectorAll('button[data-k]').forEach(b=>b.addEventListener('click',()=>openWord(b.dataset.k))); }
seg($('#sl-ep'), [['stories','рассказы'],['letters','письма']], epk, v=>{ epk=v; drawEp(); bindEp(); }); drawEp(); bindEp();
const epw = i => W.epochs.stories[i][1].slice(0,4).map(r=>TQ(r[0])).join(', ');
$('#f-epohi').textContent = `В 1880–1886 годах выделяются слова ${epw(0)}, в 1899–1904 — ${epw(3)}. От графов и поручиков юморески — к бабушкам и деревне.`;


/* ================= IV.6 деньги ================= */
const MN = D.money;
const DCAT = MN.cats, DCC = ['--s1','--s2','--c3','--c4','--g5'];
dots($('#c-dshare'), MN.share_year.filter(r=>r[2]>=25).map(([y,n,t])=>({l:w560(y),v:100*n/t,tip:`<b>${y}</b>: ${n} из ${t} писем`})), {h:220, min:0, max:100, steps:4, unit:'%', fmtv:v=>fmt(Math.round(v))});
legendTo($('#lg-dcat'), DCAT.map((k,i)=>[`${k} (${MN.cat_n[k]})`,`var(${DCC[i]})`]));
const DY=[]; for(let y=1880;y<=1904;y++) DY.push(y);
stackYears($('#c-dcat'), DY, DCAT.map((k,i)=>({k,c:`var(${DCC[i]})`,v:DY.map(y=>(MN.cat_year[k]||{})[y]||0)})), {h:220});
chart(()=>{ const box=$('#c-dsum'); const h=260; const [s,w]=svg(box,h); const L=56,R=10,T=12,B=24; const x0=1879.5,x1=1904.5;
  const A_=MN.amounts.filter(a=>a[0]>=1880&&a[1]>=1); const lmx=Math.log10(Math.max(...A_.map(a=>a[1])));
  const sx=x=>L+(w-L-R)*(x-x0)/(x1-x0), sy=v=>h-B-(h-B-T)*Math.log10(v)/lmx; const ax=el('g',{class:'ax'},s);
  [1,10,100,1000,10000,100000].forEach(t=>{ if(Math.log10(t)>lmx) return; el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt(t),{'text-anchor':'end'}); });
  for(let y=1880;y<=1904;y+=w<560?8:4) txt(ax,sx(y),h-7,y,{'text-anchor':'middle'});
  A_.forEach((a,k)=>el('circle',{cx:sx(a[0]+jit(k)),cy:sy(a[1]),r:2.2,fill:css('--c3'),opacity:.45},s));
  MN.amount_big.slice(0,8).forEach(b=>{ el('circle',{cx:sx(b[0]),cy:sy(b[1]),r:5,fill:css('--s1'),stroke:css('--surface'),'stroke-width':1.5,'data-tip':`<b>${fmt(b[1])} руб.</b>, ${b[0]} · ${esc(b[2])}<br>«${esc(b[3])}»`},s); });
  el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-dsum'));
hbars($('#c-dto'), MN.to_rate.slice(0,12).map(([k,n,w,r])=>({l:cut(k,22),v:r,c:'var(--c3)',tip:`${esc(k)}: ${n} денежных слов на ${fmt(w)}`})), {labelW:170, fmtv:fmt1});
let dk=DCAT[0];
function drawDengi(){ $('#dengi-list').innerHTML = MN.examples[dk].map(r=>`<article><div class="lab">${r.y} · ${esc(r.to)}</div><p class="quote">«${esc(r.s)}»</p></article>`).join(''); }
seg($('#sl-dengi'), DCAT.map(k=>[k,`${k} (${MN.cat_n[k]})`]), dk, v=>{ dk=v; drawDengi(); }); drawDengi();
const dsE=MN.share_year.filter(r=>r[0]>=1883&&r[0]<=1892), dsL=MN.share_year.filter(r=>r[0]>=1899);
const shr=R=>100*R.reduce((a,r)=>a+r[1],0)/R.reduce((a,r)=>a+r[2],0);
const mto=MN.to_rate;
$('#f-dengi').textContent = `О деньгах — в ${pn(MN.letters_with,'письме','письмах','письмах')} из ${fmt(LT.n)} (${pct(100*MN.letters_with/LT.n)}). Денежных слов в письмах ${fmt1(MN.letters_rate)} на 10 000, в рассказах — ${fmt1(MN.stories_rate)}. Чаще всего о деньгах он пишет родным: ${mto.slice(0,2).map(r=>`${r[0]} — ${fmt1(r[3])}`).join(', ')} на 10 000 слов. В 1883–1892 годах деньги упоминаются в ${Math.round(shr(dsE))}% писем, в 1899–1904 — в ${Math.round(shr(dsL))}%.`;
$('#t-dengi').textContent = `Как считалось. Денежные слова — словарь (деньги, рубль, копейка, гонорар, долг, взаймы, аванс, вексель, безденежье, заплатить, жалованье…). Категории — признаки во фразе: «займы и авансы» (взаймы, занять денег, пришли денег, аванс — в том числе чужие займы, о которых он рассказывает), «посылает деньги» (посылаю, вышлю тебе … руб.), «нет денег» (безденежье, ни гроша, нет денег), «гонорар и заработок» (гонорар, копеек со строки, за лист), «долги» (долг, вексель, задолжал). Правила уточнены после чтения примеров: «р» в «рассказа» больше не считается рублём, «процент» и «банкрот» исключены. Одно письмо может попасть в несколько категорий. Суммы — число рядом с «руб.» или «р.»; «тысяч» умножает на 1000. Это нижняя оценка: деньги без этих слов правило не найдёт.`;

/* ================= VII. мир Чехова ================= */
const WR = D.world, NW = WR.n_docs;
function butterfly(box, rows, {labelW=120, rowH=20, swatch=null, onRow=null}={}){
  return chart(()=>{ if(!rows.length){ box.innerHTML=''; return; } const h=rows.length*rowH+30; const [s,w]=svg(box,h); const narrow=w<560; const lw=narrow?90:labelW;
    const mid=(w+lw)/2+ (narrow?0:0), half=(w-lw)/2-30; const mx=niceMax(Math.max(...rows.map(r=>Math.max(r.a,r.b)),0.1));
    const xa=v=>mid-lw/2-half*v/mx, xb=v=>mid+lw/2+half*v/mx;
    txt(s,mid-lw/2-4,12,'рассказы и пьесы',{'text-anchor':'end',style:'fill:var(--muted);font-size:11px;font-family:var(--f-mono)'});
    txt(s,mid+lw/2+4,12,'письма',{style:'fill:var(--muted);font-size:11px;font-family:var(--f-mono)'});
    rows.forEach((r,i)=>{ const y=22+i*rowH, bh=rowH-7;
      if(swatch){ el('rect',{x:mid-lw/2+4,y:y+2,width:10,height:10,rx:2,fill:swatch(r.l),stroke:css('--ring')},s); }
      const clk=onRow&&r.key&&hasWord(r.key); const tl=txt(s,mid+(swatch?8:0),y+bh-1,cut(r.l,narrow?11:16),{'text-anchor':'middle',style:'font-family:var(--f-body);font-size:13px;fill:var(--ink)'+(clk?';text-decoration:underline dotted':'')});
      const ra=el('rect',{x:xa(r.a),y,width:Math.max(.5,mid-lw/2-xa(r.a)),height:bh,rx:2,fill:css('--s1'),'data-tip':r.ta+(clk?'<br>нажмите — слово в словоискателе':'')},s);
      const rb=el('rect',{x:mid+lw/2,y,width:Math.max(.5,xb(r.b)-mid-lw/2),height:bh,rx:2,fill:css('--s2'),'data-tip':r.tb+(clk?'<br>нажмите — слово в словоискателе':'')},s);
      if(clk){ const hl=el('rect',{class:'hit clickable',x:mid-lw/2,y:y-2,width:lw,height:rowH,tabindex:0,role:'button','aria-label':r.l,'data-tip':`${esc(r.l)}<br>нажмите — слово в словоискателе`},s);
        [ra,rb,hl].forEach(n=>{ n.classList.add('clickable'); n.addEventListener('click',()=>onRow(r)); }); hl.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onRow(r);} }); }
      txt(s,xa(r.a)-4,y+bh-2,fmt1(r.a),{'text-anchor':'end',style:'font-size:10.5px;fill:var(--ink-2)'});
      txt(s,xb(r.b)+4,y+bh-2,fmt1(r.b),{style:'font-size:10.5px;fill:var(--ink-2)'}); });
  }, box);
}
const YO={'черный':'чёрный','зеленый':'зелёный','желтый':'жёлтый','пестрый':'пёстрый','вишневый':'вишнёвый','пес':'пёс','береза':'берёза','черемуха':'черёмуха','мед':'мёд','еж':'ёж','жаворонок':'жаворонок','осетрина':'осетрина','селедка':'селёдка','теленок':'телёнок','котенок':'котёнок','ликер':'ликёр','щенок':'щенок','седой':'седой','серебряный':'серебряный','самолет':'самолёт','извозчик':'извозчик'};
const yo=w=>YO[w]||w;
function shelfRows(name, n=18){ return WR.shelves[name].slice(0,n).map(r=>{ const ex=(e,k)=>e?`<br>«${esc(e[0])}»<br><i>${esc(e[1])}, ${e[2]}</i>`:'';
  return {l:yo(r.w), key:r.w, a:100*r.works[0]/NW.works, b:100*r.letters[0]/NW.letters,
    ta:`<b>${esc(yo(r.w))}</b>: ${r.works[0]} из ${NW.works} рассказов и пьес (${r.works[1]} раз)${ex(r.ex_works)}`,
    tb:`<b>${esc(yo(r.w))}</b>: ${r.letters[0]} из ${NW.letters} писем (${r.letters[1]} раз)${ex(r.ex_letters)}`}; }); }
hbars($('#c-nm'), WR.names_works.m.slice(0,18).map(([k,n])=>({l:k,k,v:n,c:'var(--s2)',click:!!EX.heroes[k],tip:`${esc(k)}: ${pn(n,'текст','текста','текстов')}`+(EX.heroes[k]?'<br>нажмите — карточка имени':'')})), {labelW:110, fmtv:v=>fmt(v), rowH:21, onClick:r=>heroShow(r.k,true)});
hbars($('#c-nf'), WR.names_works.f.filter((r,i,a)=>a.findIndex(x=>x[0]===r[0])===i).slice(0,18).map(([k,n])=>({l:k,k,v:n,c:'var(--s1)',click:!!EX.heroes[k],tip:`${esc(k)}: ${pn(n,'текст','текста','текстов')}`+(EX.heroes[k]?'<br>нажмите — карточка имени':'')})), {labelW:110, fmtv:v=>fmt(v), rowH:21, onClick:r=>heroShow(r.k,true)});
$('#namepatr').innerHTML = WR.name_patr.slice(0,24).map(([k,n])=>`<span>${esc(k)}<small>${n}</small></span>`).join('');
$('#f-geroi').textContent = `Самый частый герой — Иван: ${pn(WR.names_works.m[0][1],'текст','текста','текстов')}; самая частая героиня — ${WR.names_works.f[0][0]} (${WR.names_works.f[0][1]}). «${WR.name_patr[0][0]}» встречается в ${WR.name_patr[0][1]} текстах.`;
hbars($('#c-mw'), WR.places.works.slice(0,20).map(([k,n])=>({l:k,v:100*n/NW.works,c:'var(--s1)',tip:`${esc(k)}: ${n} текстов`})), {labelW:120, fmtv:fmt1, rowH:21});
hbars($('#c-ml'), WR.places.letters.slice(0,20).map(([k,n])=>({l:k,v:100*n/NW.letters,c:'var(--s2)',tip:`${esc(k)}: ${n} писем`})), {labelW:150, fmtv:fmt1, rowH:21});
const pw=WR.places.works, plx=WR.places.letters;
$('#f-mesta').textContent = `В рассказах и пьесах мир — это ${pw.slice(0,3).map(r=>r[0]).join(', ')} и ${pw[3][0]}; в письмах — ${plx.slice(0,3).map(r=>r[0]).join(', ')}. ${plx.find(r=>r[0]==='Сахалин')?`Сахалин назван в ${pn(plx.find(r=>r[0]==='Сахалин')[1],'письме','письмах','письмах')}${pw.some(r=>r[0]==='Сахалин')?'':', а среди 40 самых частых мест рассказов и пьес его нет'}.`:''}`;
butterfly($('#c-zv'), shelfRows('Звери и птицы',22), {onRow:r=>openWord(r.key)});
$('#pets').innerHTML = WR.pets.filter(p=>p.n>0).map(p=>`<article><div class="sig">${esc(p.name)}</div><div class="who">${esc(p.who)} · ${esc(p.where)}${p.years?' · '+(p.years[0]===p.years[1]?p.years[0]:p.years[0]+'–'+p.years[1]):''}${p.where==='письма'?' · '+pn(p.docs,'письмо','письма','писем'):''}</div>${p.note?`<div class="who" style="font-family:var(--f-body);font-size:13.5px;color:var(--ink-2)">${esc(p.note)}</div>`:''}</article>`).join('');
const zv=WR.shelves['Звери и птицы'];
$('#f-zveri').textContent = `Больше всего в прозе лошадей и собак, в письмах — собак (${zv.find(r=>r.w==='собака').letters[0]} писем). В письмах Книппер «собака» — ласковое обращение: «милая собака», «собака моя» — ${pn(WR.knipper_dog,'раз','раза','раз')}. Свои собаки у Чехова тоже с именами: таксы Бром и Хина, мелиховские Шарик и Арапка, щенки Мюр и Мерилиз.`;
butterfly($('#c-food'), shelfRows('Еда',18), {onRow:r=>openWord(r.key)});
butterfly($('#c-drink'), shelfRows('Напитки',18), {onRow:r=>openWord(r.key)});
const dr=WR.shelves['Напитки'], dw=n=>dr.find(r=>r.w===n)||{works:[0],letters:[0]};
$('#f-eda').textContent = `В рассказах пьют водку (${dw('водка').works[0]} текстов) и чай (${dw('чай').works[0]}), в письмах — вино (${dw('вино').letters[0]} писем) и чай (${dw('чай').letters[0]}). Кумыс почти не встречается в прозе, но есть в ${dw('кумыс').letters[0]} письмах — это лечение.`;
butterfly($('#c-sadw'), shelfRows('Сад и лес',18), {onRow:r=>openWord(r.key)});
butterfly($('#c-tr'), shelfRows('Транспорт',18), {onRow:r=>openWord(r.key)});
const sd=WR.shelves['Сад и лес'], sw_=n=>sd.find(r=>r.w===n)||{works:[0],letters:[0]}; const tr=WR.shelves['Транспорт'], tw=n=>tr.find(r=>r.w===n)||{works:[0],letters:[0]};
$('#f-sad').textContent = `Сад назван в ${pn(sw_('сад').works[0],'рассказе','рассказах','рассказах')} и пьесах (${Math.round(100*sw_('сад').works[0]/NW.works)}% произведений) и в ${pn(sw_('сад').letters[0],'письме','письмах','письмах')}. В прозе ездят на извозчике (${tw('извозчик').works[0]} текстов) и в санях (${tw('сани').works[0]}), в письмах — на пароходе (${tw('пароход').letters[0]} писем) и поездом, с вокзала и со станции.`;
const COLHEX={'белый':'#f4f1ea','черный':'#1d1a17','красный':'#c43a2c','синий':'#2c4f9e','голубой':'#79aee0','зеленый':'#3f8a3c','желтый':'#e3c23a','серый':'#8c8a86','розовый':'#e8a0b4','лиловый':'#9a6bb3','коричневый':'#7a4e2c','бурый':'#6d4a2e','рыжий':'#c96a2b','золотой':'#c9a227','серебряный':'#c0c3c7','багровый':'#8e1f1f','алый':'#e2362e','фиолетовый':'#6b3fa0','оранжевый':'#ef8a2b','малиновый':'#b0194f','сиреневый':'#c3a2d8','седой':'#d9d6d0','пестрый':'#a58a5d','бледный':'#e9e1cf','румяный':'#e59a86','смуглый':'#a67750','вишневый':'#7b1e2b','пурпуровый':'#7d1e5a'};
butterfly($('#c-col'), shelfRows('Цвета',20), {onRow:r=>openWord(r.key), swatch:k=>COLHEX[Object.keys(YO).find(x=>YO[x]===k)||k]||css('--neutral-bar'), labelW:150});
const C8 = WR.shelves['Цвета'].slice(0,8);
$('#lg-colper').innerHTML=C8.map(r=>hasWord(r.w)?`<span><button type="button" class="lnk plain" data-k="${esc(r.w)}" data-tip="открыть в словоискателе"><i style="background:${COLHEX[r.w]||'#999'}"></i>${esc(yo(r.w))}</button></span>`:`<span><i style="background:${COLHEX[r.w]||'#999'}"></i>${esc(yo(r.w))}</span>`).join('');
$('#lg-colper').querySelectorAll('button[data-k]').forEach(b=>b.addEventListener('click',()=>openWord(b.dataset.k)));
chart(()=>{ const box=$('#c-colper'); const h=230; const [s,w]=svg(box,h); const L=36,R=10,T=12,B=26; const per=PERIODS.map(p=>p[0]);
  const vals=C8.map(r=>r.per.map((n,i)=>1e4*n/WR.per_words[i])); const mx=niceMax(Math.max(...vals.flat()));
  const sx=i=>L+(w-L-R)*(i+.5)/per.length, sy=v=>h-B-(h-B-T)*v/mx; const ax=el('g',{class:'ax'},s);
  ticks(mx,4).forEach(t=>{ el('line',{x1:L,x2:w-R,y1:sy(t),y2:sy(t),stroke:css('--grid')},ax); txt(ax,L-6,sy(t)+4,fmt1(t),{'text-anchor':'end'}); });
  per.forEach((p,i)=>txt(ax,sx(i),h-8,p,{'text-anchor':'middle'}));
  C8.forEach((r,k)=>{ const col=COLHEX[r.w]||'#999'; el('polyline',{points:vals[k].map((v,i)=>`${sx(i)},${sy(v)}`).join(' '),fill:'none',stroke:col,'stroke-width':2.2},s);
    vals[k].forEach((v,i)=>el('circle',{cx:sx(i),cy:sy(v),r:4,fill:col,stroke:css('--ink-2'),'stroke-width':.8,'data-tip':`«${yo(r.w)}», ${per[i]}: ${fmt1(v)} на 10 000 слов`},s)); });
  el('line',{x1:L,x2:w-R,y1:h-B,y2:h-B,stroke:css('--axis')},s); }, $('#c-colper'));
const col=WR.shelves['Цвета'];
$('#f-cveta').textContent = `Главные цвета прозы — ${col.filter(r=>r.w!=='бледный').slice(0,3).map(r=>'«'+yo(r.w)+'»').join(', ')}; рядом с ними — «бледный» (${col.find(r=>r.w==='бледный').works[0]} рассказов и пьес). В письмах выделяются «пёстрый» (${(col.find(r=>r.w==='пестрый')||{letters:[0]}).letters[0]}) и «вишнёвый»: из ${pn(WR.cherry.play+WR.cherry.other,'письма','писем','писем')} с этим словом в ${WR.cherry.play} речь о пьесе «Вишнёвый сад».`;

/* ================= VIII. рекорды, корпус, методика ================= */
const longest = SA.reduce((a,b)=>b.w>a.w?b:a), shortest = SA.filter(a=>!a.unf).reduce((a,b)=>b.w<a.w?b:a);
const maxL = LR.reduce((a,b)=>b.w>a.w?b:a);
const dayCnt={}; LT.strip.rows.forEach(r=>{ if(r[0]%100) dayCnt[r[0]]=(dayCnt[r[0]]||0)+1; });
const bestDay = Object.entries(dayCnt).sort((a,b)=>b[1]-a[1])[0];
const bd = +bestDay[0];
const ps3=PS.reduce((a,b)=>b.pause_k>a.pause_k?b:a);
const REC=[['Самое длинное в прозе', `«${longest.t}»`, `${pn(longest.w,'слово','слова','слов')}, ${longest.y}`],
  ['Самый короткий рассказ', `«${shortest.t}»`, `${pn(shortest.w,'слово','слова','слов')}, ${shortest.y}`],
  ['Самое длинное письмо', maxL.to, `${pn(maxL.w,'слово','слова','слов')}, ${maxL.d&&maxL.m?maxL.d+' '+MON[maxL.m-1]+' ':''}${maxL.y}`],
  ['Больше всего писем за день', `${bd%100} ${MON[Math.floor(bd/100)%100-1]} ${Math.floor(bd/10000)}`, `${bestDay[1]} ${plural(bestDay[1],'письмо','письма','писем')} с точной датой`],
  ['Больше всего рассказов за год', String(bestStY.y), `${bestStY.story_n} ${plural(bestStY.story_n,'рассказ','рассказа','рассказов')}`],
  ['Больше всего писем за год', String(bestLY.y), `${bestLY.n} ${plural(bestLY.n,'письмо','письма','писем')}`],
  ['Больше всего пауз', `«${ps3.t}»`, `${pn(ps3.pauses,'пауза','паузы','пауз')}, ${fmt1(ps3.pause_k)} на 1000 слов речи`],
  ['Самый частый адресат', K.nom, `${K.n} ${plural(K.n,'письмо','письма','писем')}`],
  ['Самая частая форма обращения', `«${ADR[1].sal[0][0]}»`, `${ADR[1].sal[0][1]} писем сестре`]];
$('#records').innerHTML=REC.map(([k,v,d])=>`<div class="rec"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="d">${esc(d)}</div></div>`).join('');
$('#longest').innerHTML = `«${esc(P.longest_sentence.text)}»<cite>${P.longest_sentence.words} слов · «${esc(P.longest_sentence.doc)}», ${P.longest_sentence.y}</cite>`;
const WK=O.words_by_kind;
hbars($('#c-corpus'), [['рассказы и повести','story'],['письма','letter'],['пьесы','play'],['«Остров Сахалин», «Из Сибири»','nonfic'],['статьи, рецензии','article'],['записные книжки','notebook'],['медицинские тексты','medical'],['дневники','diary'],['гимназическое, стихи','juvenilia']].map(([l,k])=>({l,v:(WK[k]||0)/1000,c:'var(--s2)'})), {labelW:210, fmtv:v=>fmt(Math.round(v))});
hbars($('#c-excl'), Object.entries(O.excluded).map(([k,v])=>({l:cut(k,30),v,c:'var(--neutral-bar)'})).concat([{l:'первая редакция «Иванова» (т. 11)',v:1,c:'var(--neutral-bar)'},{l:'дарственные надписи',v:O.other.inscr,c:'var(--neutral-bar)'},{l:'официальные бумаги',v:O.other.doc,c:'var(--neutral-bar)'}]), {labelW:220, fmtv:v=>fmt(v)});
$('#t-korpus').textContent = `Источник — Полное собрание сочинений и писем в 30 томах (изд. «Наука», 1974–1983), электронная редакция без раздела «Варианты». Тома 1–18 (сочинения) взяты из папки заказчика; тома писем 19–30 — из сборника «Все 4494 письма Чехова из ПСС», потому что в папке не было томов 19, 27 и 28. Совпадение проверено: число писем в девяти общих томах одинаково до письма. Найдено ${fmt(O.letters)} писем — столько же, сколько в названии сборника.`;
const ML=[
 `<b>Границы текстов</b> — по оглавлению EPUB (якоря NCX) поверх склеенного spine; сноски и звёздочки комментариев сняты. «Петерб&lt;ургскую&gt;» — раскрытие сокращения, скобки сняты; «&lt;…&gt;» — пропуск издателя, считается отдельно (${LT.cuts.n} в письмах, из них ${LT.cuts.inword.length} внутри слова).`,
 `<b>Год рассказа</b> — год первой публикации из строки «Впервые — …» комментария ПСС; для посмертных публикаций — дата написания из комментария («Датируется…»); ${O.year_how['оценка по тому']||0} недатированных текстов получили год ближайшего датированного соседа в томе (тома расположены по времени написания). <b>Подпись в печати</b> — из строки «Подпись:» того же комментария; семейства: «Чехонте» (А. Чехонте, Антоша Чехонте, Антоша Ч., Дон Антонио Чехонте…), «Человек без селезёнки», «Брат моего брата», «Чехов» (Антон Чехов, Ан. Чехов, А. Чехов).`,
 `<b>Исключены</b>, но посчитаны: Dubia, коллективное, «Другие редакции», «Редактированное», адресная книжка, первая редакция «Иванова» (т. 11), сборка «Из записной книжки Ивана Иваныча» (т. 10; по 5-словным шинглам вбирает 12 ранее напечатанных рассказов), дубль «Мамаша и г. Лентовский» = «Кое-что &lt;1&gt;» (доля общих шинглов 0,99).`,
 `<b>Письма</b>: адресат — из оглавления тома («Суворину А. С.»), в именительный падеж — правилом. Склеены написания: Книппер-Чеховой → Книппер, Шавровой-Юст → Шавровой, «Пешкову А. М. (М. Горькому)» → Пешкову. Дата — по старому стилю: скобки с новым стилем («21 декабря 1897 (2 января 1898)») сняты до разбора. Место — текст после года в строке даты; «Лопасня» (почта Мелихова) считается Мелиховом.`,
 `<b>Подпись письма</b> — последняя группа коротких курсивных абзацев в конце письма (в издании подписи набраны курсивом), после которой идёт не больше трёх абзацев приписки; адреса на конверте (слова «высокоблагородию», «д.», «пер.», «губ.», отчество в дательном падеже, «На обороте:») отсекаются. Подпись найдена в ${fmt(LT.sig_found)} из ${fmt(LT.n)} писем. Подпись делится на формулу («Ваш», «Искренно преданный»), самоименование и форму имени. Самоименования (${LT.titles.length}) — явный список, просмотренный целиком: адреса, даты, суммы и приписки чужой рукой исключены.`,
 `<b>Обращение</b> — начало первого абзаца письма до «!» или запятой, если в нём не больше 8 слов и оно кончается «!» или содержит слово-обращение («милый», «дорогой», «многоуважаемый», «дуся»…).`,
 `<b>Брань</b> — три ступени по словарю (чертыхание; ругательства — «сволочь», «подлец», «дурак», «сукин»…; непечатное и телесное). Считаются ступени 2–3. Звериные слова («свинья», «скотина», «осёл») засчитываются, если рядом (±60 знаков) нет признаков прямого значения («резать», «хлев», «стадо»…). «Подлый», «дрянь», «мерзкий» — оценки, а не брань. pymorphy относит «черт», «черту», «черта» к «черта»: для них правило по форме («к черту», «до черта»). Аудит по сырому тексту проведён; числа — нижняя оценка. Вердикт мифа сравнивает письма с речью персонажей.`,
 `<b>Медицина</b>: словари четырёх полей (болезни; лекарства и лечение; врачи и больницы; тело и симптомы); «температура», «сердце», «кровь», «земский» не входят — слишком часто в другом смысле. «Своя болезнь» — письмо, где в одной фразе есть слово о болезни и «я / у меня / мой». Врачебные абзацы — ${LB.length} кандидатов по двум правилам, записанным до чтения; каждый прочитан моделью и размечен (совет, практика, своё здоровье, взгляды, не о медицине); цитаты проверены как точные подстроки.`,
 `<b>Фраза</b> — до «.», «!», «?» или «…», после которых заглавная, тире или кавычка; инициалы дают лишние границы. <b>Реплика</b> — абзац, который начинается с тире или кавычки и короче 120 слов. В пьесах говорящий — полужирное начало абзаца, ремарка — курсив; «Пауза» считается в ремарках.`,
 `<b>Слова</b> — pymorphy3, первый разбор, без снятия омонимии; служебные слова, местоименные прилагательные и имена исключены из списков. Слова эпох — log-odds с информативным априором Дирихле (Monroe et al., 2008).`,
 `<b>Мир Чехова</b> — словари полок (еда, напитки, звери и птицы, сад и лес, транспорт, цвета); рейтинг — по числу текстов (рассказы и пьесы отдельно от писем). Слова с другим значением получают правило контекста: «чай» (частица) засчитывается только рядом с «пить», «стакан», «самовар»…; «такса» — не рядом с «аптекарской»; «рак» — не рядом с «желудка»; «масло» — не рядом с «краски»; «свинья», «осёл», «скотина» в зверей не входят (бранное). Аудит по сырому тексту проведён: расхождения — другие слова с той же основой («ром» — «роман», «сахар» — «Сахалин», «ива» — «Иван»). <b>Места и люди</b> — слова, которые пишутся с заглавной и размечены pymorphy как топоним или фамилия; явные исправления: отчества и названия («Нива», «Чайка», «Иванов» — пьеса, «Мелихов» — Мелихово) исключены, падежные формы одной фамилии склеены (Суворина → Суворин, Потапенка → Потапенко), «Питер» → Петербург. <b>Клички</b> — список кандидатов, проверенный по контекстам; в письмах засчитывается упоминание рядом со словом о животном.`,
 `<b>Места писем</b> — каждое место, откуда написано 8 писем и больше, — отдельной строкой; остальные — группами по явному списку: путь на Сахалин 1890 года (по месту и году), другие места за границей, в дороге (поезд, пароход, станции), другие места в России. «Мелихаво» и «Ст. Лопасня» считаются Мелиховом.`,
 `<b>Вехи</b> на хронологии — первый год, когда место становится главным местом писем (не меньше 10 писем). Окончание университета в 1884 году — по комментарию т. 3; кровохарканье в марте 1897 — по письму Н. М. Линтваревой («на пути у меня началось кровохарканье»).`,
 `<b>Мифы</b> — пороги записаны в коде до подсчёта (<code>rules.py</code>). Цитаты ищутся по всем формам слов в одном абзаце; «ружьё» — только в голосе самого Чехова (письма, записные книжки, статьи).`,
 `<b>Известные ограничения</b>: омонимы не различаются; словари неполны; письма в издании 1974–1983 годов с купюрами; год первой публикации пьесы может не совпадать с редакцией текста («О вреде табака» — 1886, текст — редакция 1902 года).`];
$('#metod-list').innerHTML = ML.map(x=>`<li>${x}</li>`).join('');

/* тема и ширина — перерисовка */
let lastW=innerWidth; addEventListener('resize',()=>{ if(Math.abs(innerWidth-lastW)>30){ lastW=innerWidth; rerenderAll(); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',rerenderAll);
new MutationObserver(rerenderAll).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
