# Данные отчёта «Чехов на просвет»

Отчёт собирает `build_report.py`: `report.head.html` + `report.body.html` + `stats.json` (в JS — `D`) + `explore.json` (в JS — `EX`)
+ `report.lib.js` + `report.app.js` + `report.chrome.js`. Числа в отчёте берутся только из этих двух файлов.

Периоды (везде 4, `EX.periods`): `1880–1886`, `1887–1892`, `1893–1898`, `1899–1904`; подписи `EX.period_names`.

## stats.json (`D`)

| Ключ | Что внутри |
|---|---|
| `overview` | счётчики корпуса; `by_year[{y,story_n,story_w,letter_n,letter_w,play_w}]`; `outlets`; `sig_year{y:{семейство:n}}`; `sig_forms_chekhonte`; `excluded` |
| `prose.atlas[]` | рассказ: `t` название, `y` год, `vol`, `out` издание, `ot` тип издания, `sig`/`sf` подпись, `w` слов, `np` абзацев, `dlg` % диалога, `sm/sq1/sq3` длина фразы, `ya` «я» на 1000, `pu{'!','?','…','—',';','()'}` на 1000, `seq`/`seqk` штрихи абзацев (1 — реплика), `first`/`last` фразы. Индекс в массиве = `j` |
| `prose.by_year[]` | по годам: `n`, `w_med/w_q1/w_q3`, `s_med/s_q1/s_q3`, `dlg`, `ya` |
| `plays[]` | `t`, `y`, `speech_w`, `stage_n`, `pauses`, `pause_k`, `top[[персонаж, слов]]`, `cast[]`, `doctors[]` |
| `letters` | `n`, `by_year[{y,n,w}]`, `ym[[y,m,n]]`, `places`, `place_rows[{name,n,group,y0,y1,ys{y:n},members}]`, `addressees[{k,nom,fam,n,w,y0,y1,ys{y:n},sigfam,forms,formulas,titles,sal,cuts,places}]` (60 главных), `sig_fam`, `sig_fam_year`, `formulas`, `cuts{n,letters,by_to,by_year,inword[{w,to,y}]}`, `titles[{t,g,full,to,y}]` (самоименования), `title_groups`, `strip{groups,names,rows[[ггггммдд,слов,группа,индекс_имени]]}` (все 4494 письма; 0 в дне/месяце — неизвестно), `len_year`, `knipper_split` |
| `swear` | `groups{letters,narration,speech:{words,k1,k2,k3,k23,kh,...}}`, `top[[слово,n]]`, `by_year`, `by_to[[кому,n,слов,на10000]]`, `examples{слово:{s,to,y,tier}}` |
| `money` | `share_year[[y,писем с деньгами,всего]]`, `cats[]`, `cat_year{кат:{y:n}}`, `cat_n`, `cat_to`, `examples{кат:[{s,to,y}]}`, `amounts[[y,руб]]`, `amount_big[[y,руб,кому,фраза]]`, `to_rate[[кому,n,слов,на10000]]`, `top` |
| `medicine` | `letters_year/stories_year[{y,w,all,<поле>}]`, `own_year[[y,n,всего]]`, `doctor_period[[период,n,всего]]`, `doctor_stories`, `labels[{lab,why,prob,rem,q,to,y}]` (lab: advice/practice/own/views/other), `label_year` |
| `words` | `top{stories,plays,letters:{сущ,глаг,прил:[[слово,на10000]]}}`, `epochs{stories,letters:[[период,[[слово,сила,n,текстов]]]]}`, `periods`, `pw_s`/`pw_l` слов по периодам |
| `lex{слово:[всего,[рассказы,пьесы,письма],[4 периода рассказов],[4 периода писем],[j,n,j,n…] рассказы]}` | словоискатель, 5285 слов; последний массив пуст для слов, которые есть больше чем в 120 рассказах |
| `world` | `shelves{Еда,Напитки,Звери и птицы,Сад и лес,Транспорт,Цвета:[{w,works[текстов,раз],letters[писем,раз],ex_works,ex_letters[фраза,где,год],per[4]}]}`, `n_docs{works,letters}`, `places{works,letters:[[место,текстов]]}`, `people_letters[[фамилия,писем,есть_среди_адресатов]]`, `names_works{m,f}`, `name_patr`, `pets[{name,who,where,note,n,docs,years}]`, `knipper_dog`, `cherry` |
| `myths[{id,q,v,num,src}]` | v: yes/no/part/none |
| `quotes` | найденные абзацы для мифов |

## explore.json (`EX`)

| Ключ | Что внутри |
|---|---|
| `per_tokens_works`, `per_tokens_letters` | слов по 4 периодам (рассказы+пьесы; письма) |
| `palette{works,letters:[{p,c:[[цвет,hex,n]]}]}` | палитра каждого периода (как у Бродского: полоса, отрезки по частоте) |
| `wmap[{w,k,x,y,c,n}]`, `wgroups[8][слова]`, `neighbors{k:[k…]}` | карта словаря рассказов и пьес (t-SNE); `k` — ключ в `D.lex`; по периодам — `D.lex[k][2]` и `EX.per_tokens_works` |
| `net{nodes[{name,n писем,np абзацев,per[4],y0,y1,adr,wrote писем ему,cl,x,y,nb[[j,w]],ctx[{s,to,y}]}],edges[[i,j,w]],clusters[{names,n}],total}` | «Круг Чехова»: люди в письмах; ребро — названы в одном абзаце; раскладка «островами» |
| `heroes{имя:{g m/f,n текстов,per[4],texts[[название,год,раз]],ctx[{s,to,y}]}}` | карточки имён героев рассказов и пьес |
| `themes{поле:{works[4],letters[4] на 1000 слов,words[[слово,в прозе,в письмах]],loud[[текст,год,на1000]]}}` | 14 тем |
