"""Шаг 4. Подсчёты: обзор, проза, пьесы, письма (адресаты, места, подписи, обращения, купюры), брань, медицина,
слова, мир. Все вердикты — по порогам из rules.py. Выход: analysis/stats.json. Запуск: python compute.py [--qa] [модуль …]
"""
import json
import re
import sys
from collections import Counter, defaultdict

import numpy as np

import rules
from common import Corpus, plural, r1, r2, snip

QA = "--qa" in sys.argv
ONLY = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = {}
C = None

PUNCT = {"!": r"!", "?": r"\?", "…": r"…|\.\.\.", "—": r"(?<=\s)—(?=\s)", ";": r";", "()": r"\("}
PRON1 = {"я", "меня", "мне", "мной", "мною", "мой", "моя", "мое", "мои", "моего", "моей", "моему", "моим", "моих", "моими", "мою"}


def per(n, d, k=1000):
    return (n * k / d) if d else 0.0


# ======================= обзор
def overview():
    D = C.docs
    st = [d for d in D if d["kind"] == "story"]
    pl = [d for d in D if d["kind"] == "play"]
    le = [d for d in D if d["kind"] == "letter"]
    wd = np.bincount(C.t_doc, minlength=len(D))
    man = json.load(open(C_DIR / "texts" / "manifest_log.json", encoding="utf-8"))
    kinds = Counter(d["kind"] for d in D)
    words_by_kind = defaultdict(int)
    for i, d in enumerate(D):
        words_by_kind[d["kind"]] += int(wd[i])
    years = list(range(1875, 1905))
    by_year = {y: {"story_n": 0, "story_w": 0, "letter_n": 0, "letter_w": 0, "play_w": 0} for y in years}
    for i, d in enumerate(D):
        y = d.get("year")
        if y not in by_year:
            continue
        if d["kind"] == "story":
            by_year[y]["story_n"] += 1
            by_year[y]["story_w"] += int(wd[i])
        elif d["kind"] == "letter":
            by_year[y]["letter_n"] += 1
            by_year[y]["letter_w"] += int(wd[i])
        elif d["kind"] == "play":
            by_year[y]["play_w"] += int(wd[i])
    outlets = Counter(d["outlet"] for d in st if d.get("outlet"))
    top_out = [o for o, _ in outlets.most_common(9)]
    out_year = defaultdict(Counter)
    for d in st:
        o = d.get("outlet") if d.get("outlet") in top_out else ("другие" if d.get("outlet") else "нет данных")
        out_year[d["year"]][o] += 1
    sig_year = defaultdict(Counter)
    for d in st:
        sig_year[d["year"]][d["sig_family"]] += 1
    sig_forms = Counter(d["sig"] for d in st if d["sig_family"] == "Чехонте")
    OUT["overview"] = {
        "kinds": kinds, "words_by_kind": words_by_kind, "total_words": int(wd.sum()),
        "stories": len(st), "story_words": int(sum(wd[i] for i, d in enumerate(D) if d["kind"] == "story")),
        "plays": len(pl), "letters": len(le), "letter_words": int(sum(wd[i] for i, d in enumerate(D) if d["kind"] == "letter")),
        "addressees": len({d["to_key"] for d in le}), "places": len({d["place"] for d in le if d["place"]}),
        "excluded": man["excluded"], "roles": man["roles"], "other": man["other"], "dups": len(man["dups"]),
        "by_year": [{"y": y, **by_year[y]} for y in years],
        "outlets": outlets.most_common(20), "top_outlets": top_out,
        "outlet_year": {y: dict(c) for y, c in sorted(out_year.items())},
        "sig_year": {y: dict(c) for y, c in sorted(sig_year.items())},
        "sig_family": Counter(d["sig_family"] for d in st), "sig_forms_chekhonte": sig_forms.most_common(),
        "sig_other": Counter(d["sig"] for d in st if d["sig_family"] == "другие псевдонимы").most_common(),
        "year_how": Counter(d["year_how"] for d in st),
        "unfinished": sum(1 for d in st if d["unfinished"]),
    }
    if QA:
        print("обзор:", {k: v for k, v in OUT["overview"].items() if k not in ("by_year", "outlet_year", "sig_year")})


# ======================= проза: рассказы
def sent_stats(lens):
    if not lens:
        return None, None, None
    a = np.array(lens)
    return float(np.median(a)), float(np.percentile(a, 25)), float(np.percentile(a, 75))


def prose():
    D = C.docs
    st_ids = [i for i, d in enumerate(D) if d["kind"] == "story"]
    # по абзацам — векторно
    p_words = C.p_nw
    rows = []
    pron_ids = np.array([C.form_ix[f] for f in PRON1 if f in C.form_ix])
    t_is_pron = np.isin(C.t_form, pron_ids)
    nar_tok = C.t_kind == 0
    pron_nar = np.bincount(C.t_doc[t_is_pron & nar_tok], minlength=len(D))
    nar_w = np.bincount(C.t_doc[nar_tok], minlength=len(D))
    dlg_w = np.bincount(C.t_doc[C.t_kind == 1], minlength=len(D))
    paras_of = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        paras_of[int(di)].append(pi)
    for i in st_ids:
        d = D[i]
        ps = paras_of[i]
        sl = [n for pi in ps for n in C.p_sl[pi]]
        med, q1, q3 = sent_stats(sl)
        text = "\n".join(C.ptext[pi] for pi in ps)
        tw = int(nar_w[i] + dlg_w[i])
        punct = {k: r2(per(len(re.findall(rx, text)), tw)) for k, rx in PUNCT.items()}
        seq = [int(C.p_nw[pi]) for pi in ps]
        seqk = "".join("1" if C.p_kind[pi] == 1 else "0" for pi in ps)
        # длинная повесть: сжимаем последовательность до 240 штрихов (для шапки)
        if len(seq) > 240:
            k = int(np.ceil(len(seq) / 240))
            seq2, k2 = [], []
            for j in range(0, len(seq), k):
                seq2.append(max(seq[j:j + k]))
                k2.append("1" if seqk[j:j + k].count("1") * 2 >= len(seqk[j:j + k]) else "0")
            seq, seqk = seq2, "".join(k2)
        longest = max(sl) if sl else 0
        first = next((C.ptext[pi] for pi in ps if C.p_nw[pi] >= 4), "")
        last = next((C.ptext[pi] for pi in reversed(ps) if C.p_nw[pi] >= 3), "")
        ot = next((k for k, v in rules.OUTLET_TYPE.items() if d.get("outlet") in v), "посмертно или нет данных")
        rows.append({"i": i, "id": d["id"], "t": d["title"], "y": d["year"], "yh": d["year_how"], "vol": d["vol"],
                     "out": d.get("outlet"), "ot": ot, "sig": d.get("sig"), "sf": d["sig_family"], "unf": d["unfinished"],
                     "w": tw, "np": len(ps), "dlg": r1(per(dlg_w[i], tw, 100)), "sm": r1(med), "sq1": r1(q1), "sq3": r1(q3),
                     "ya": r1(per(pron_nar[i], nar_w[i])), "pu": punct, "long": longest, "seq": seq, "seqk": seqk,
                     "first": first_sentence(first), "last": last_sentence(last)})
    # по годам: медианы по рассказам и объём
    years = sorted({r["y"] for r in rows})
    by_year = []
    for y in years:
        R = [r for r in rows if r["y"] == y and r["w"] >= 150]
        if not R:
            continue
        ww = np.array([r["w"] for r in R])
        sl = [n for r in R for pi in paras_of[r["i"]] for n in C.p_sl[pi]]
        med, q1, q3 = sent_stats(sl)
        dl = sum(dlg_w[r["i"]] for r in R) / max(1, sum(r["w"] for r in R)) * 100
        ya = sum(pron_nar[r["i"]] for r in R) / max(1, sum(nar_w[r["i"]] for r in R)) * 1000
        by_year.append({"y": y, "n": len(R), "w_med": float(np.median(ww)), "w_q1": float(np.percentile(ww, 25)),
                        "w_q3": float(np.percentile(ww, 75)), "s_med": med, "s_q1": q1, "s_q3": q3, "dlg": r1(dl), "ya": r1(ya)})
    # рекорд: самая длинная фраза
    best = None
    for r in rows:
        if r["long"] and (best is None or r["long"] > best[0]):
            best = (r["long"], r)
    lf = longest_sentence(paras_of[best[1]["i"]]) if best else ""
    OUT["prose"] = {"atlas": rows, "by_year": by_year, "longest_sentence": {"words": best[0], "doc": best[1]["t"],
                                                                         "y": best[1]["y"], "text": lf}}
    if QA:
        print("проза по годам:")
        for b in by_year:
            print("  ", b)
        print("самая длинная фраза:", best[0], best[1]["t"], lf[:300])


def first_sentence(t):
    m = re.match(r"(.+?[.!?…]+)(?:\s|$)", t)
    s = m.group(1) if m else t
    return s[:260]


def last_sentence(t):
    parts = re.split(r"(?<=[.!?…])\s+(?=[—«А-ЯЁ])", t)
    return parts[-1][:260] if parts else t[:260]


def longest_sentence(ps):
    best = ""
    for pi in ps:
        for s in re.split(r"(?<=[.!?…])\s+(?=[—«\"(]?\s*[А-ЯЁA-Z])", C.ptext[pi]):
            if len(s.split()) > len(best.split()):
                best = s
    return best


# ======================= пьесы
DOC_RX = re.compile(r"\b(?:врач|доктор|лекарь|фельдшер)\b|медицинском факультете", re.I)


def plays():
    D = C.docs
    out = []
    paras_of = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        paras_of[int(di)].append(pi)
    for i, d in enumerate(D):
        if d["kind"] != "play":
            continue
        ps = paras_of[i]
        spk = Counter()
        n_speech = n_stage = pauses = stage_w = 0
        cast = []
        for pi in ps:
            k = C.p_kind[pi]
            if k == 2:
                spk[norm_spk(C.p_spk[pi])] += int(C.p_nw[pi])
                n_speech += int(C.p_nw[pi])
            elif k == 3:
                n_stage += 1
                stage_w += int(C.p_nw[pi])
                pauses += len(re.findall(r"\b[Пп]ауза\b", C.ptext[pi]))
            elif k == 4:
                cast.append(C.ptext[pi])
        doctors = [c for c in cast if DOC_RX.search(c)]
        top = spk.most_common(10)
        out.append({"i": i, "t": d["title"], "y": d["year"], "vol": d["vol"], "speech_w": n_speech, "stage_n": n_stage,
                    "stage_w": stage_w, "pauses": pauses, "pause_k": r2(per(pauses, n_speech)), "speakers": len(spk),
                    "top": top, "cast": cast, "doctors": doctors, "unf": d["unfinished"]})
    OUT["plays"] = out
    if QA:
        for p in out:
            print(f"  {p['y']} {p['t'][:22]:22s} речь {p['speech_w']:6d} ремарок {p['stage_n']:4d} пауз {p['pauses']:3d} "
                  f"({p['pause_k']}/1000) врачи: {p['doctors']} | {p['top'][:4]}")


def norm_spk(s):
    s = re.sub(r"\s*\(.*$", "", s or "").strip(" .,:")
    return s[:1].upper() + s[1:].lower() if s.isupper() else s




# ======================= письма
NAME_FAM = [("А. Чехов", r"^(?:А|Ан|Ант)\.?\s*(?:П\.\s*)?Чехов"), ("Антон Чехов", r"^Антон\s+Чехов|^Антуан\s+Чехов"),
            ("Чехов", r"^Чехов"), ("Чехонте", r"Чехонте"), ("Antoine", r"^(?:Antoine|Антуан)$"),
            ("Antonio", r"^(?:Antonio|Антонио)$"), ("Антон", r"^Антон$"), ("А.", r"^А\.?(?:\s*Ч\.?)?$"),
            ("другие имена", r".")]
ADDR_WORDS = r"(?:[Мм]ил(?:ый|ая|ейший|ейшая|ые)|[Дд]орог(?:ой|ая|ие)|[Уу]важаем|[Мм]ногоуважаем|[Дд]обрейш|[Лл]юбезн|" \
             r"[Гг]лубокоуважаем|[Мм]илостив|[Дд]уся|[Дд]усик|[Сс]обак|[Аа]ктрис|[Кк]ачалот|[Пп]упс|[Лл]ошад|[Кк]расавиц|" \
             r"[Зз]дравствуй|[Нн]есравненн|[Пп]релестн|[Бб]ратец|[Жж]ена|[Мм]амаша|[Гг]олубчик|[Дд]ружище|[Сс]частлив|" \
             r"[Сс]тарик|[Рр]одн(?:ой|ая)|[Кк]ормилец|[Бб]лагодетель|[Вв]ашество|[Сс]иятельн)"


def sig_family(name):
    for fam, rx in NAME_FAM:
        if re.search(rx, name or ""):
            return fam
    return "без имени"


def salutation(ps):
    for pi in ps[:2]:
        t = C.ptext[pi]
        if re.match(r"^\d{1,2}(?:-?го)?\s*[а-я]{3,9}\.?\s*$|^\d+\.?$|^(?:Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье)", t):
            continue
        m = re.match(r"^(.{2,80}?)(!+|,)(?:\s|$)", t)
        if not m:
            return None
        s = m.group(1).strip()
        if len(s.split()) > 8:
            return None
        if m.group(2).startswith("!") or re.search(ADDR_WORDS, s):
            return s + ("!" if m.group(2).startswith("!") else "")
        return None
    return None


def letters():
    D = C.docs
    L = [i for i, d in enumerate(D) if d["kind"] == "letter"]
    wd = np.bincount(C.t_doc, minlength=len(D))
    paras_of = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        paras_of[int(di)].append(pi)
    years = list(range(1875, 1905))
    # места по годам: каждое место с ≥ PLACE_MIN писем — своя строка, остальное — по группам rules.PLACE_GROUPS
    def pfix(p):
        return rules.PLACE_FIX.get(p, p) if p else None
    place_tot = Counter(pfix(D[i]["place"]) for i in L if D[i]["place"])
    solo = {p for p, n in place_tot.items() if n >= rules.PLACE_MIN and p not in rules.ROAD}
    gname = dict((k, n) for n, k in rules.PLACE_GROUPS)

    def prow(i):
        p, y = pfix(D[i]["place"]), D[i]["year"]
        if not p or p == "Ялта или Москва":
            return gname["none"], p
        if p in solo:
            return p, p
        if p in rules.SAKHALIN_1890 and y == 1890:
            return gname["sakh"], p
        if p in rules.ABROAD:
            return gname["abroad"], p
        if p in rules.ROAD or re.match(r"(?:По пути|По дороге|Пароход)", p):
            return gname["road"], p
        return gname["russia"], p
    place_rows = defaultdict(lambda: {"n": 0, "ys": Counter(), "m": Counter()})
    for i in L:
        row, p = prow(i)
        e = place_rows[row]
        e["n"] += 1
        e["ys"][D[i]["year"]] += 1
        if p:
            e["m"][p] += 1
    prow_list = []
    for name, e in place_rows.items():
        ys = [y for y in e["ys"] if y]
        prow_list.append({"name": name, "n": e["n"], "group": name in gname.values(), "y0": min(ys) if ys else None,
                          "y1": max(ys) if ys else None, "ys": {y: e["ys"][y] for y in sorted(ys)},
                          "members": e["m"].most_common() if name in gname.values() else []})
    order_g = [n for n, _ in rules.PLACE_GROUPS]
    prow_list.sort(key=lambda r: (r["group"], order_g.index(r["name"]) if r["group"] else 0, r["y0"] or 9999, -r["n"]))
    place_tot = Counter({k: v for k, v in place_tot.items()})
    top_places = [p for p, _ in place_tot.most_common(9)]
    place_year = defaultdict(Counter)
    for i in L:
        place_year[D[i]["year"]][prow(i)[0]] += 1
    # адресаты
    by_to = defaultdict(list)
    for i in L:
        by_to[D[i]["to_key"]].append(i)
    ranking = sorted(by_to.items(), key=lambda kv: -len(kv[1]))
    addr = []
    for k, ids in ranking[:60]:
        d0 = D[ids[0]]
        ys = Counter(D[i]["year"] for i in ids)
        fams = Counter(sig_family(D[i]["sig_name"]) if D[i]["sig_raw"] else "без подписи" for i in ids)
        forms = Counter(D[i]["sig_name"] for i in ids if D[i]["sig_name"])
        titles = Counter(D[i]["sig_title"] for i in ids if D[i]["sig_title"])
        formulas = Counter(D[i]["sig_formula"] for i in ids if D[i]["sig_formula"])
        sals = Counter(s for s in (salutation(paras_of[i]) for i in ids) if s)
        addr.append({"k": k, "nom": d0["to_nom"], "fam": d0["family"], "n": len(ids), "w": int(sum(wd[i] for i in ids)),
                     "y0": min(ys), "y1": max(ys), "ys": {y: ys[y] for y in sorted(ys)},
                     "sigfam": fams.most_common(), "forms": forms.most_common(8), "formulas": formulas.most_common(6),
                     "titles": titles.most_common(8), "sal": sals.most_common(8),
                     "cuts": int(sum(D[i]["cuts"] for i in ids)), "places": Counter(D[i]["place"] for i in ids).most_common(4)})
    # подписи по годам (семейства формы имени)
    fam_year = defaultdict(Counter)
    for i in L:
        f = sig_family(D[i]["sig_name"]) if D[i]["sig_raw"] else "без подписи"
        fam_year[D[i]["year"]][f] += 1
    formula_fam = Counter()
    for i in L:
        f = D[i]["sig_formula"]
        key = ("Ваш" if re.match(r"^Ваш", f) else "Твой" if re.match(r"^Тв", f) else
               "уважающий/преданный" if re.search(r"уважающ|преданн|почтени|услуг|честь", f, re.I) else
               "иностранная" if re.match(r"Tuus|Votre", f) else "без формулы" if not f else "прочие")
        formula_fam[key] += 1
    # купюры
    cut_letters = [i for i in L if D[i]["cuts"]]
    cut_by_to = Counter()
    for i in cut_letters:
        cut_by_to[D[i]["to_nom"]] += D[i]["cuts"]
    cut_year = Counter()
    for i in cut_letters:
        cut_year[D[i]["year"]] += D[i]["cuts"]
    inword = [{"w": w, "to": D[i]["to_nom"], "y": D[i]["year"]} for i in L for w in D[i].get("cut_words", [])]
    # «Итого»: письма по годам и месяцам
    ym = Counter((D[i]["year"], D[i]["month"]) for i in L if D[i]["month"])
    OUT["letters"] = {
        "n": len(L), "words": int(sum(wd[i] for i in L)),
        "by_year": [{"y": y, "n": sum(1 for i in L if D[i]["year"] == y),
                     "w": int(sum(wd[i] for i in L if D[i]["year"] == y))} for y in years],
        "ym": [[y, m, n] for (y, m), n in sorted(ym.items())],
        "places": place_tot.most_common(40), "top_places": top_places, "place_rows": prow_list,
        "place_year": {y: dict(c) for y, c in sorted(place_year.items()) if y},
        "addressees": addr, "n_addr": len(by_to),
        "addr_1": sum(1 for k, v in by_to.items() if len(v) == 1),
        "family_share": r1(100 * sum(1 for i in L if D[i]["family"]) / len(L)),
        "sig_found": sum(1 for i in L if D[i]["sig_raw"]),
        "sig_fam": Counter(sig_family(D[i]["sig_name"]) if D[i]["sig_raw"] else "без подписи" for i in L),
        "sig_fam_year": {y: dict(c) for y, c in sorted(fam_year.items()) if y},
        "formula_fam": formula_fam, "formulas": Counter(D[i]["sig_formula"] for i in L if D[i]["sig_formula"]).most_common(25),
        "cuts": {"n": int(sum(D[i]["cuts"] for i in L)), "letters": len(cut_letters),
                 "by_to": cut_by_to.most_common(15), "by_year": sorted(cut_year.items()), "inword": inword,
                 "illeg": int(sum(D[i]["illeg"] for i in L))},
        "median_words": float(np.median([wd[i] for i in L])),
        "len_year": [{"y": y, "med": float(np.median([wd[i] for i in L if D[i]["year"] == y]))} for y in years
                     if any(D[i]["year"] == y for i in L)],
    }
    # кунсткамера самоименований (явный список просмотренных — sig_titles.py)
    from sig_titles import KEEP, GROUPS
    rows = []
    for i in L:
        d = D[i]
        t = d["sig_title"]
        if not t or t not in KEEP:
            continue
        disp, grp = KEEP[t]
        full = re.sub(r"\[\d+\]|\*", "", re.sub(r"\s+", " ", d["sig_raw"])).strip()
        rows.append({"t": disp, "g": grp, "full": full, "to": d["to_nom"], "y": d["year"], "fam": d["family"]})
    OUT["letters"]["titles"] = rows
    OUT["letters"]["knipper_split"] = {"до свадьбы (Книппер)": sum(1 for i in L if D[i]["title"].startswith("Книппер О. Л.")),
                                       "после (Книппер-Чеховой)": sum(1 for i in L if D[i]["title"].startswith("Книппер-Чеховой"))}
    # лента писем для шапки: дата (ггггммдд, неизвестное — середина), слов, группа адресата
    G = ["О. Л. Книппер", "семья", "А. С. Суворин", "Н. А. Лейкин", "другие"]
    def grp(d):
        if d["to_key"] == "Книппер О. Л.":
            return 0
        if d["family"]:
            return 1
        return {"Суворину А. С.": 2, "Лейкину Н. А.": 3}.get(d["to_key"], 4)
    strip = []
    for i in L:
        d = D[i]
        if not d["year"]:
            continue
        strip.append([d["year"] * 10000 + (d["month"] or 0) * 100 + (d["day"] or 0), int(wd[i]), grp(d), d["to_nom"]])
    strip.sort()
    names = sorted({s[3] for s in strip})
    nix = {n: j for j, n in enumerate(names)}
    OUT["letters"]["strip"] = {"groups": G, "names": names, "rows": [[a, b, g, nix[n]] for a, b, g, n in strip]}
    OUT["letters"]["title_groups"] = [[g, sum(1 for r in rows if r["g"] == g)] for g in GROUPS]
    # редкие формы имени
    rare = Counter(D[i]["sig_name"] for i in L if D[i]["sig_name"] and sig_family(D[i]["sig_name"]) == "другие имена")
    OUT["letters"]["rare_names"] = [{"n": k, "c": v, "to": Counter(D[i]["to_nom"] for i in L if D[i]["sig_name"] == k).most_common(3)}
                                    for k, v in rare.most_common(30)]
    if QA:
        print("семейства подписей:", OUT["letters"]["sig_fam"])
        print("формулы:", formula_fam)
        for a in addr[:25]:
            print(f"  {a['n']:4d} {a['nom'][:26]:26s} {a['y0']}–{a['y1']} {a['sigfam'][:3]} | {a['sal'][:3]} | {a['titles'][:3]}")
        print("самоименований:", len(rows), OUT["letters"]["title_groups"])
        print("кому:", Counter(r["to"] for r in rows).most_common(8))
        print("купюры:", OUT["letters"]["cuts"]["n"], OUT["letters"]["cuts"]["by_to"][:8])


# ======================= брань
def swear():
    D = C.docs
    tier_of = {}
    for tier, words in rules.SWEAR.items():
        for w in words:
            i = C.lid(w)
            if i is not None:
                tier_of[i] = tier
    harsh = set(C.ids(rules.HARSH).tolist())
    lids = np.array(sorted(tier_of), dtype=np.int32)
    hit = np.isin(C.t_lemma, lids)
    # правило контекста для слов с прямым значением: предыдущее слово или «!» после
    ctx = {C.lid(k): v for k, v in rules.SWEAR_CONTEXT.items() if C.lid(k) is not None}
    idx = np.nonzero(hit)[0]
    keep = np.ones(len(idx), dtype=bool)
    for j, ti in enumerate(idx):
        li = int(C.t_lemma[ti])
        if li not in ctx:
            continue
        pt = C.ptext[C.t_para[ti]]
        form = C.forms[C.t_form[ti]]
        m = re.search(r"(?i)\b" + re.escape(form) + r"\b", pt.replace("ё", "е"))
        win = pt[max(0, m.start() - 60): m.end() + 60] if m else pt
        keep[j] = not re.search(r"\b(?:" + rules.SWEAR_CONTEXT[C.lemmas[li]] + ")", win, re.I)
    idx = idx[keep]
    # правило по словоформе: «черт/черту/черта» (pymorphy → «черта»-линия)
    extra = []
    for form, (lem, cond) in rules.FORM_RULES.items():
        fi = C.form_ix.get(form)
        if fi is None:
            continue
        for ti in np.nonzero(C.t_form == fi)[0]:
            pt = C.ptext[C.t_para[ti]].replace("ё", "е")
            ok = False
            for m in re.finditer(r"(\S+)?\s*\b" + form + r"\b(\s+\S+)?", pt, re.I):
                prev = (m.group(1) or "").lower().strip(",.;:—«»()!?")
                nxt = (m.group(2) or "").lower()
                if cond == "!":
                    ok = not re.search(r"лиц|характер|сходств|харак", nxt)
                else:
                    ok = prev in cond.split("|")
                break
            if ok:
                extra.append(ti)
    tier_of[C.lid("черт")] = 1
    idx = np.union1d(idx, np.array(extra, dtype=idx.dtype))
    t_tier = np.zeros(len(C.t_form), dtype=np.int8)
    t_tier[idx] = [tier_of.get(int(l), 1) for l in C.t_lemma[idx]]
    is_let = C.t_dkind == "letter"
    is_story = C.t_dkind == "story"
    is_play = C.t_dkind == "play"
    groups = {"letters": is_let & (C.t_kind == 5),
              "narration": is_story & (C.t_kind == 0),
              "speech": (is_story & (C.t_kind == 1)) | (is_play & (C.t_kind == 2))}
    res = {}
    for g, m in groups.items():
        n = int(m.sum())
        res[g] = {"words": n, **{f"t{t}": int((m & (t_tier == t)).sum()) for t in (1, 2, 3)},
                  "harsh": int((m & np.isin(C.t_lemma, list(harsh))).sum())}
        for t in (1, 2, 3):
            res[g][f"k{t}"] = r2(per(res[g][f"t{t}"], n, 10000))
        res[g]["k23"] = r2(per(res[g]["t2"] + res[g]["t3"], n, 10000))
        res[g]["kh"] = r2(per(res[g]["harsh"], n, 10000))
    # топ слов в письмах
    let_idx = idx[is_let[idx] & (C.t_kind[idx] == 5)]
    top = Counter("черт" if C.lemmas[int(l)] == "черта" else C.lemmas[int(l)] for l in C.t_lemma[let_idx])
    # по годам и адресатам (письма)
    let_docs = C.t_doc[let_idx]
    by_year = Counter(D[int(d)]["year"] for d in let_docs)
    w_year = Counter()
    lw = np.bincount(C.t_doc[groups["letters"]], minlength=len(D))
    for i, d in enumerate(D):
        if d["kind"] == "letter":
            w_year[d["year"]] += int(lw[i])
    by_to = Counter(D[int(d)]["to_nom"] for d in let_docs)
    w_to = Counter()
    for i, d in enumerate(D):
        if d["kind"] == "letter":
            w_to[d["to_nom"]] += int(lw[i])
    to_rate = sorted([(k, by_to[k], w_to[k], per(by_to[k], w_to[k], 10000)) for k in by_to if w_to[k] >= 8000],
                     key=lambda r: -r[3])
    # примеры: по одному на слово (письма), отрывок 170 знаков
    ex = {}
    for ti in let_idx:
        lem = C.lemmas[int(C.t_lemma[ti])]
        lem = "черт" if lem == "черта" else lem
        if lem in ex:
            continue
        pt = C.ptext[C.t_para[ti]]
        form = C.forms[C.t_form[ti]]
        m = re.search(r"(?i)\b" + re.escape(form) + r"\b", pt.replace("ё", "е"))
        if m:
            d = D[int(C.t_doc[ti])]
            ex[lem] = {"s": snip(pt, m.start(), m.end()), "to": d["to_nom"], "y": d["year"], "tier": int(t_tier[ti])}
    lt = res["letters"]
    ratio_speech = lt["k23"] / res["speech"]["k23"] if res["speech"]["k23"] else None
    ratio_nar = lt["k23"] / res["narration"]["k23"] if res["narration"]["k23"] else None
    OUT["swear"] = {"groups": res, "top": top.most_common(40), "by_year": [[y, by_year[y], w_year[y]] for y in sorted(w_year) if y],
                    "by_to": [[k, n, w, r2(r)] for k, n, w, r in to_rate[:20]], "examples": ex,
                    "ratio_speech": r2(ratio_speech), "ratio_nar": r2(ratio_nar),
                    "letters_with": int(len(set(let_docs.tolist())))}
    if QA:
        for g, r in res.items():
            print(" ", g, r)
        print("  письма/речь:", r2(ratio_speech), " письма/повествование:", r2(ratio_nar))
        print("  топ:", top.most_common(40))
        print("  кому (на 10 000 слов):", [(k, n, round(r, 1)) for k, n, w, r in to_rate[:12]])
        # аудит по сырому тексту (канон 4.11)
        lettext = "\n".join(C.ptext[pi] for pi in range(len(C.ptext)) if C.p_kind[pi] == 5).lower().replace("ё", "е")
        counted = Counter(C.lemmas[int(l)] for l in C.t_lemma[let_idx])
        print("  аудит (письма): слово | засчитано | основа в тексте")
        for tier, words in rules.SWEAR.items():
            for w in words:
                stem = w[:-1] if len(w) > 4 else w
                raw = len(re.findall(r"\b" + re.escape(stem) + r"[а-я]{0,4}\b", lettext))
                c = counted.get(w, 0)
                if raw > c * 1.5 + 2 or (raw and not c):
                    print(f"     {w:12s} {c:4d} {raw:4d}")


# ======================= медицина
SYMPT = r"\b(?:кашл|кровохарк|кровь\s+(?:горлом|шла|идет|пошла)|температур|t°|лихора|геморро|перебо[ия]|туберкул|чахот|" \
        r"плеврит|одышк|понос|кишк|желуд|бронхит|инфлюэнц|мигрен|плеврит|бацилл|легки[ех]\b|верхушк|ревматизм|инфлюэнц|болен\b|хвора|нездоров)"
ME = r"(?:\b(?:я|у меня|мне|меня|мой|моя|мое|моё|мои|моего|моей|моих|моим)\b)"


def medicine():
    D = C.docs
    fields = {k: C.ids(v) for k, v in rules.MED.items()}
    allmed = np.unique(np.concatenate(list(fields.values())))
    is_med = np.isin(C.t_lemma, allmed)
    res = {"fields": list(fields), "letters_year": [], "stories_year": []}
    for kind, pk, key in (("letter", 5, "letters_year"), ("story", None, "stories_year")):
        m = (C.t_dkind == kind) & ((C.t_kind == pk) if pk is not None else (C.t_kind <= 1))
        for y in range(1880, 1905):
            my = m & (C.t_year == y)
            n = int(my.sum())
            if n < 3000:
                continue
            row = {"y": y, "w": n, "all": r2(per(int((my & is_med).sum()), n, 10000))}
            for k, ids in fields.items():
                row[k] = r2(per(int((my & np.isin(C.t_lemma, ids)).sum()), n, 10000))
            res[key].append(row)
    # своя болезнь: доля писем года, где есть фраза с симптомом и «я/у меня»
    L = [i for i, d in enumerate(D) if d["kind"] == "letter"]
    paras_of = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        paras_of[int(di)].append(pi)
    own_year, tot_year, own_ex = Counter(), Counter(), []
    for i in L:
        y = D[i]["year"]
        tot_year[y] += 1
        hit = None
        for pi in paras_of[i]:
            for s in re.split(r"(?<=[.!?…])\s+", C.ptext[pi]):
                if re.search(SYMPT, s, re.I) and re.search(ME, s, re.I):
                    hit = s
                    break
            if hit:
                break
        if hit:
            own_year[y] += 1
            own_ex.append({"y": y, "to": D[i]["to_nom"], "s": hit[:230]})
    res["own_year"] = [[y, own_year[y], tot_year[y]] for y in sorted(tot_year) if y and tot_year[y] >= 5]
    res["own_n"] = sum(own_year.values())
    # врачи в прозе: рассказы, где «доктор/врач/лекарь/фельдшер» ≥ 3 раз
    docw = C.ids(["доктор", "врач", "лекарь", "фельдшер"])
    st = [i for i, d in enumerate(D) if d["kind"] == "story"]
    cnt = np.bincount(C.t_doc[np.isin(C.t_lemma, docw)], minlength=len(D))
    doc_st = [{"t": D[i]["title"], "y": D[i]["year"], "n": int(cnt[i])} for i in st if cnt[i] >= 3]
    per_period = []
    for lab, a, b, _ in rules.PERIODS:
        ids = [i for i in st if a <= D[i]["year"] <= b]
        per_period.append([lab, sum(1 for i in ids if cnt[i] >= 3), len(ids)])
    res["doctor_stories"] = sorted(doc_st, key=lambda r: (r["y"], -r["n"]))
    res["doctor_period"] = per_period
    # медицинские тексты
    wd = np.bincount(C.t_doc, minlength=len(D))
    res["med_texts"] = [{"t": d["title"], "w": int(wd[i]), "kind": d["kind"]} for i, d in enumerate(D) if d["kind"] in ("medical", "nonfic")]
    # итог разметки врачебных абзацев (если уже есть)
    try:
        from med_labels import LABELS
    except ImportError:
        LABELS = {}
    rows = []
    for pid, (lab, why, prob, rem, q) in LABELS.items():
        d = D[int(C.p_doc[pid])]
        rows.append({"pid": pid, "lab": lab, "why": why, "prob": prob, "rem": rem, "q": q, "to": d["to_nom"], "y": d["year"]})
    res["labels"] = rows
    lab_year = defaultdict(Counter)
    for r in rows:
        lab_year[r["y"]][r["lab"]] += 1
    res["label_counts"] = Counter(r["lab"] for r in rows)
    res["label_year"] = {y: dict(c) for y, c in sorted(lab_year.items())}
    OUT["medicine"] = res
    if QA:
        print("  письма, мед. слов на 10 000:", [(r["y"], r["all"]) for r in res["letters_year"]])
        print("  рассказы:", [(r["y"], r["all"]) for r in res["stories_year"]])
        print("  своя болезнь:", res["own_year"])
        print("  врачи в рассказах по периодам:", per_period, len(doc_st))
        import random
        random.seed(5)
        for e in random.sample(own_ex, 12):
            print("   ", e)
        print("  метки:", res["label_counts"])


# ======================= поиск известных цитат (мифы)
def quotes():
    D = C.docs
    Q = {"gun": (["ружье", "выстрелить"], ("letter", "notebook", "article", "diary"), ["акт", "сцена", "висеть"]),
         "beauty": (["человек", "прекрасный", "лицо", "одежда", "душа", "мысль"], None, []),
         "slave": (["выдавливать", "раб"], ("letter",), []),
         "wife": (["законный", "жена", "любовница"], ("letter",), ["медицина"]),
         "short": (["краткость", "сестра", "талант"], None, [])}
    res = {}
    for key, (need, kinds, extra) in Q.items():
        ids = C.ids(need)
        paras = None
        for li in ids:
            s = set(C.t_para[C.t_lemma == li].tolist())
            paras = s if paras is None else paras & s
        hits = []
        for pi in sorted(paras or []):
            d = D[int(C.p_doc[pi])]
            if kinds and d["kind"] not in kinds:
                continue
            t = C.ptext[pi]
            ex = [w for w in extra if C.lid(w) is not None and (C.t_lemma[C.t_para == pi] == C.lid(w)).any()]
            hits.append({"kind": d["kind"], "title": d["title"], "y": d["year"], "to": d.get("to_nom"),
                         "spk": C.p_spk[pi], "extra": ex, "text": t[:900]})
        res[key] = hits
        if QA:
            print(f"  [{key}] найдено абзацев: {len(hits)}")
            for h in hits[:6]:
                print("     ", h["kind"], h["title"][:40], h["y"], h["spk"], h["extra"], "|", h["text"][:400].replace("\n", " "))
    OUT["quotes"] = res


# ======================= мифы: вердикты только порогами rules.MYTHS
def myths():
    D = C.docs
    M = {m["id"]: dict(m) for m in rules.MYTHS}
    P, S, L, Q = OUT["prose"], OUT["swear"], OUT["letters"], OUT["quotes"]
    # short
    st = [r for r in P["atlas"] if not r["unf"]]
    e = np.median([r["w"] for r in st if 1880 <= r["y"] <= 1886])
    l_ = np.median([r["w"] for r in st if 1888 <= r["y"] <= 1903])
    k = l_ / e
    M["short"].update(v="yes" if k <= 0.8 else "no" if k >= 1.25 else "part",
                      num=f"медиана рассказа 1880–1886 — {int(e)} {plural(int(e), 'слово', 'слова', 'слов')}, 1888–1903 — {int(l_)} {plural(int(l_), 'слово', 'слова', 'слов')} (в {k:.1f} раза длиннее)",
                      src=src_of(Q["short"]))
    # gun
    g = [h for h in Q["gun"] if ("акт" in h["extra"] or "сцена" in h["extra"])]
    v = "yes" if any("висеть" in h["extra"] for h in g) else "part" if g else "no"
    M["gun"].update(v=v, num=("в письмах есть «ружьё» и «выстрелить» рядом со «сценой», но без «висит на стене»" if v == "part"
                              else "найдено" if v == "yes" else "в 30 томах в голосе самого Чехова не найдено"), src=src_of(g))
    # beauty
    b = Q["beauty"]
    inlet = [h for h in b if h["kind"] == "letter"]
    v = "yes" if inlet else "part" if b else "no"
    M["beauty"].update(v=v, num="; ".join(f"{h['spk']} в пьесе «{h['title']}» ({h['y']})" for h in b) or "не найдено",
                       src=src_of(b))
    for key in ("slave", "wife"):
        h = Q[key]
        if key == "wife":
            h = [x for x in h if "медицина" in x["extra"]]
        note = {"slave": " — в третьем лице, как сюжет рассказа о «молодом человеке», который «выдавливает из себя по каплям раба»",
                "wife": "; в 1889 г. та же метафора ещё дважды — о беллетристике и театре"}[key]
        M[key].update(v="yes" if h else "no", num=(f"письмо {h[0]['title'].split(' («')[0]}{note}" if h else "в письмах не найдено"), src=src_of(h))
    # medicine — по разметке врачебных абзацев
    lab = OUT["medicine"]["labels"]
    if lab:
        ny = Counter(d["year"] for d in D if d["kind"] == "letter")
        def rate(a, b):
            n = sum(1 for r in lab if r["lab"] in ("advice", "practice") and a <= r["y"] <= b)
            return n, 100 * n / sum(ny[y] for y in range(a, b + 1))
        n0, r0 = rate(1887, 1898)
        n1, r1_ = rate(1899, 1904)
        k = r1_ / r0 if r0 else 0
        M["medicine"].update(v="no" if k >= 0.8 else "yes" if k <= 0.5 else "part",
                             num=f"врачебных абзацев (советы и практика) на 100 писем: 1887–1898 — {r0:.1f} ({n0}), 1899–1904 — {r1_:.1f} ({n1})")
    else:
        M["medicine"].update(v="none", num="разметка ещё не готова")
    # swear
    k = S["ratio_speech"]
    g = S["groups"]
    M["swear"].update(v="yes" if k >= 1.5 else "no" if k <= 0.8 else "part",
                      num=f"брани на 10 000 слов: письма {g['letters']['k23']}, речь персонажей {g['speech']['k23']}, "
                          f"повествование {g['narration']['k23']}; вырезано издателем мест: {L['cuts']['n']}")
    # pause
    pl = OUT["plays"]
    big = [p for p in pl if p["t"] in ("Чайка", "Дядя Ваня", "Три сестры", "Вишневый сад")]
    early = [p for p in pl if p["y"] and p["y"] < 1892 and p["t"] != "О вреде табака"]
    kb = sum(p["pauses"] for p in big) * 1000 / sum(p["speech_w"] for p in big)
    ke = sum(p["pauses"] for p in early) * 1000 / sum(p["speech_w"] for p in early)
    k = kb / ke
    M["pause"].update(v="yes" if k >= 2 else "no" if k <= 1.2 else "part",
                      num=f"пауз на 1000 слов речи: четыре большие пьесы {kb:.1f}, пьесы до 1892 {ke:.1f} "
                          f"(в «Безотцовщине» — {next(p['pause_k'] for p in pl if p['t']=='Безотцовщина')})")
    # knipper
    a = L["addressees"]
    ks = L.get("knipper_split", {})
    M["knipper"].update(v="yes" if a[0]["k"] == "Книппер О. Л." else "no",
                        num=f"{a[0]['nom']} — {a[0]['n']} {plural(a[0]['n'],'письмо','письма','писем')} за {a[0]['y1']-a[0]['y0']+1} {plural(a[0]['y1']-a[0]['y0']+1, 'год', 'года', 'лет')} "
                            f"(из них {ks.get('после (Книппер-Чеховой)')} — после свадьбы, адресованы Книппер-Чеховой) "
                            f"({a[0]['y0']}–{a[0]['y1']}); {a[1]['nom']} — {a[1]['n']} за {a[1]['y1']-a[1]['y0']+1} {plural(a[1]['y1']-a[1]['y0']+1, 'год', 'года', 'лет')} ({a[1]['y0']}–{a[1]['y1']})")
    # antosha
    f = OUT["overview"]["sig_forms_chekhonte"]
    tot = sum(n for _, n in f)
    full = sum(n for s, n in f if s and s.startswith("Антоша Чехонте"))
    ash = full / tot
    M["antosha"].update(v="yes" if ash >= 0.5 else "part",
                        num=f"полное «Антоша Чехонте» — {full} {plural(full,'подпись','подписи','подписей')} из {tot} {plural(tot, 'подписи', 'подписей', 'подписей')} семейства Чехонте; "
                            f"обычная форма — «{f[0][0]}» ({f[0][1]})")
    V = OUT.get("voices", {}).get("chekhonte") if "chekhonte" in M else None
    if "chekhonte" not in M:
        pass
    elif V:
        M["chekhonte"].update(v={"отличается": "yes", "в пределах разброса": "no", "на границе": "part"}.get(V["verdict"], "none"),
                              num=V["num"] + ("; ни на одном наборе слов не «отличается», но вердикт по правилу должен совпасть "
                                              "на 100, 200 и 300 словах — а он «в пределах» / «на границе»" if V["verdict"] == "неустойчиво" else ""))
    elif "chekhonte" in M:
        M["chekhonte"].update(v="none", num="голоса не посчитаны")
    OUT["myths"] = list(M.values())
    if QA:
        for m in OUT["myths"]:
            print(f"  [{m['v']}] {m['q']} — {m['num']}")


def src_of(hits):
    return [{"title": h["title"], "y": h["y"], "to": h.get("to"), "spk": h.get("spk"), "kind": h["kind"],
             "text": h["text"][:600]} for h in hits[:3]]


# ======================= голоса: Чехонте ↔ Чехов (правило rules.VOICE, записано до прогона)
PRON = {"я", "меня", "мне", "мной", "мною", "ты", "тебя", "тебе", "тобой", "он", "его", "ему", "им", "нем", "она", "ее", "ей", "ею",
        "нее", "ней", "оно", "мы", "нас", "нам", "нами", "вы", "вас", "вам", "вами", "они", "их", "них", "ими", "ним", "ими", "себя",
        "себе", "собой", "мой", "моя", "мое", "мои", "моего", "моей", "моему", "моим", "моих", "мою", "твой", "твоя", "твое", "твои",
        "твоего", "твоей", "твоим", "твоих", "свой", "своя", "свое", "свои", "своего", "своей", "своему", "своим", "своих", "свою",
        "своими", "наш", "наша", "наше", "наши", "нашего", "нашей", "ваш", "ваша", "ваше", "ваши", "вашего", "вашей"}


def delta_matrix(chunks, mfw, drop=None):
    V = Counter()
    for ch in chunks:
        V.update(ch)
    vocab = [f for f, _ in V.most_common() if drop is None or C.forms[f] not in drop][:mfw]
    ix = {f: j for j, f in enumerate(vocab)}
    X = np.zeros((len(chunks), len(vocab)))
    for i, ch in enumerate(chunks):
        n = len(ch)
        cc = Counter(f for f in ch if f in ix)
        for f, k in cc.items():
            X[i, ix[f]] = k / n
    Z = (X - X.mean(0)) / (X.std(0) + 1e-12)
    Dm = np.abs(Z[:, None, :] - Z[None, :, :]).mean(2)
    return Dm, Z


def voices():
    D = C.docs
    y0, y1 = rules.VOICE["years"]
    size = rules.VOICE["chunk"]
    sel = {"Чехонте": [], "Чехов": []}
    for i, d in enumerate(D):
        if d["kind"] == "story" and y0 <= d["year"] <= y1 and d["sig_family"] in sel and not d["unfinished"]:
            sel[d["sig_family"]].append(i)
    m = (C.t_kind == 0) & ~C.l_name[C.t_lemma] & ~C.t_cap | ((C.t_kind == 0) & C.t_sst & ~C.l_name[C.t_lemma])
    chunks = {}
    for sig, ids in sel.items():
        ids = sorted(ids, key=lambda i: (D[i]["year"], D[i]["vol"], i))
        buf, owners, out = [], set(), []
        for i in ids:
            toks = C.t_form[(C.t_doc == i) & m].tolist()
            for f in toks:
                buf.append(f)
                owners.add(i)
                if len(buf) == size:
                    out.append((buf, owners))
                    buf, owners = [], set()
                    owners.add(i)
        chunks[sig] = out
    n = min(len(v) for v in chunks.values())
    pick = {sig: [v[int(round(j))] for j in np.linspace(0, len(v) - 1, n)] for sig, v in chunks.items()}
    allc = pick["Чехонте"] + pick["Чехов"]
    lab = ["Чехонте"] * n + ["Чехов"] * n
    toks = [c[0] for c in allc]
    own = [c[1] for c in allc]
    res = {"n_chunks": n, "available": {k: len(v) for k, v in chunks.items()}, "variants": {}}
    for var, drop in (("main", None), ("nopron", PRON)):
        res["variants"][var] = {}
        for mfw in rules.VOICE["mfw"]:
            Dm, Z = delta_matrix(toks, mfw, drop)
            within = {s: [] for s in ("Чехонте", "Чехов")}
            cross = []
            for a in range(len(allc)):
                for b in range(a + 1, len(allc)):
                    if own[a] & own[b]:
                        continue
                    if lab[a] == lab[b]:
                        within[lab[a]].append(Dm[a, b])
                    else:
                        cross.append(Dm[a, b])
            base = {s: float(np.mean(v)) for s, v in within.items()}
            Dx = float(np.mean(cross))
            mb = max(base.values())
            verdict = "отличается" if Dx > mb * 1.10 else "в пределах разброса" if Dx <= mb else "на границе"
            row = {"D": r2(Dx), "base": {k: r2(v) for k, v in base.items()}, "verdict": verdict}
            if mfw == 200:
                U, S, Vt = np.linalg.svd(Z - Z.mean(0), full_matrices=False)
                P = U[:, :2] * S[:2]
                row["pca"] = [[r2(P[i, 0]), r2(P[i, 1]), lab[i]] for i in range(len(allc))]
                row["pca_var"] = [r1(100 * S[0] ** 2 / (S ** 2).sum()), r1(100 * S[1] ** 2 / (S ** 2).sum())]
            res["variants"][var][str(mfw)] = row
    vs = [res["variants"]["main"][str(k)]["verdict"] for k in rules.VOICE["mfw"]]
    final = vs[0] if len(set(vs)) == 1 else "неустойчиво"
    vs2 = [res["variants"]["nopron"][str(k)]["verdict"] for k in rules.VOICE["mfw"]]
    r200 = res["variants"]["main"]["200"]
    res["verdict"] = final
    res["verdict_nopron"] = vs2[0] if len(set(vs2)) == 1 else "неустойчиво"
    res["num"] = (f"расстояние Чехонте ↔ Чехов {r200['D']} против {max(r200['base'].values())} внутри одной подписи "
                  f"(200 частых слов; {n} + {n} {plural(n, 'кусок', 'куска', 'кусков')} по {size} слов повествования, 1886–1887)")
    res["outlets"] = {sig: Counter(D[i]["outlet"] for i in ids).most_common(4) for sig, ids in sel.items()}
    OUT.setdefault("voices", {})["chekhonte"] = res
    if QA:
        print("  кусков:", res["available"], "взято по", n)
        for var in res["variants"]:
            for k, r in res["variants"][var].items():
                print("  ", var, k, r["D"], r["base"], r["verdict"])
        print("  вердикт:", final, "| без местоимений:", res["verdict_nopron"])


# ======================= слова
FUNC = {"NPRO", "PREP", "CONJ", "PRCL", "INTJ", "PRED", "NUMR", "NONE", "LATN", "Apro"}
PRON_ADJ = {"который", "свой", "этот", "весь", "мой", "такой", "самый", "должный", "твой", "ваш", "наш", "тот", "сам", "каждый",
            "какой", "всякий", "другой", "один", "иной", "некоторый", "никакой", "его", "ее", "их", "чей", "сей", "оный", "таков"}
SKIPV = {"быть", "есть", "мочь", "стать"}
SKIPW = SKIPV | {"уже", "потом", "очень", "сегодня", "теперь", "тоже", "также", "еще", "опять", "тут", "там", "здесь", "вот", "так",
                 "как", "где", "когда", "всегда", "никогда", "иногда", "часто", "проч", "ст", "го", "др", "г", "пр", "сейчас", "далее",
                 "что-то", "какой-то", "какой-нибудь", "этакий", "больший", "отчий"}
SHOW = {"черта": "чёрт/черта", "деньга": "деньги", "ее": "её"}


def words():
    D = C.docs
    subs = {"stories": (C.t_dkind == "story") & (C.t_kind <= 1),
            "plays": (C.t_dkind == "play") & (C.t_kind == 2),
            "letters": (C.t_dkind == "letter") & (C.t_kind == 5)}
    good = np.array([(not C.l_name[i]) and C.lemmas[i] not in PRON_ADJ and C.lemmas[i] not in SKIPW and len(C.lemmas[i]) > 1
                     for i in range(len(C.lemmas))])
    nm = lambda i: SHOW.get(C.lemmas[i], C.lemmas[i])
    pos = C.l_pos
    top = {}
    for s, m in subs.items():
        n = int(m.sum())
        cnt = np.bincount(C.t_lemma[m], minlength=len(C.lemmas))
        top[s] = {}
        for P, allow in (("сущ", {"NOUN"}), ("глаг", {"VERB", "INFN"}), ("прил", {"ADJF", "ADJS"})):
            ok = good & np.isin(pos, list(allow)) & ~np.isin(np.array(C.lemmas, dtype=object), list(SKIPV))
            order = np.argsort(-cnt * ok)[:25]
            top[s][P] = [[nm(i), r1(per(cnt[i], n, 10000))] for i in order if ok[i]]
    # слова эпох (log-odds с априором Дирихле, Monroe et al. 2008): рассказы по периодам, слово ≥ 8 раз и ≥ 2 рассказов периода
    def epochs(mask, min_docs=2):
        per_p = []
        tot = np.bincount(C.t_lemma[mask], minlength=len(C.lemmas)).astype(float)
        a0 = tot.sum()
        alpha = tot / a0 * 500.0 + 0.01
        A = alpha.sum()
        for lab, y0, y1, _ in rules.PERIODS:
            mp = mask & (C.t_year >= y0) & (C.t_year <= y1)
            yi = np.bincount(C.t_lemma[mp], minlength=len(C.lemmas)).astype(float)
            yj = tot - yi
            ni, nj = yi.sum(), yj.sum()
            if ni < 1000:
                per_p.append([lab, []])
                continue
            d = np.log((yi + alpha) / (ni + A - yi - alpha)) - np.log((yj + alpha) / (nj + A - yj - alpha))
            var = 1 / (yi + alpha) + 1 / (yj + alpha)
            z = d / np.sqrt(var)
            ndocs = np.bincount(np.unique(np.stack([C.t_lemma[mp], C.t_doc[mp]]), axis=1)[0], minlength=len(C.lemmas))
            ok = good & (yi >= 8) & (ndocs >= min_docs) & np.isin(pos, ["NOUN", "VERB", "INFN", "ADJF", "ADJS", "ADVB"])
            order = np.argsort(-(z * ok))[:24]
            per_p.append([lab, [[nm(i), r1(z[i]), int(yi[i]), int(ndocs[i])] for i in order if ok[i] and z[i] > 0]])
        return per_p
    ep = {"stories": epochs(subs["stories"]), "letters": epochs(subs["letters"], min_docs=3)}
    # словоискатель: слово во всех формах → всего, по подкорпусам, по годам (рассказы и письма), рассказы (разреженно)
    stm = subs["stories"]
    st_ids = [i for i, d in enumerate(D) if d["kind"] == "story"]
    st_pos = {i: j for j, i in enumerate(st_ids)}
    content = good & np.isin(pos, ["NOUN", "VERB", "INFN", "ADJF", "ADJS", "ADVB", "COMP", "PRTF", "PRTS", "GRND"])
    alln = np.bincount(C.t_lemma, minlength=len(C.lemmas))
    keep = np.nonzero(content & (alln >= 30))[0]
    # + имена и места (для поиска), ≥ 30
    keep = np.union1d(keep, np.nonzero((C.l_name | C.l_geo) & (alln >= 30) & (C.l_capshare >= 0.7))[0])
    kset = np.zeros(len(C.lemmas), bool)
    kset[keep] = True
    lex = {}
    ys = list(range(1880, 1905))
    yidx = {y: j for j, y in enumerate(ys)}
    for s, m in subs.items():
        mm = m & kset[C.t_lemma]
        pairs = np.stack([C.t_lemma[mm], C.t_year[mm]])
        u, cnt = np.unique(pairs, axis=1, return_counts=True)
        for (li, y), k in zip(u.T, cnt):
            e = lex.setdefault(int(li), {"s": [0, 0, 0], "sy": {}, "ly": {}, "st": {}})
            e["s"][["stories", "plays", "letters"].index(s)] += int(k)
            if s in ("stories", "letters") and y in yidx:
                e["sy" if s == "stories" else "ly"][int(y)] = int(k)
    mm = stm & kset[C.t_lemma]
    u, cnt = np.unique(np.stack([C.t_lemma[mm], C.t_doc[mm]]), axis=1, return_counts=True)
    for (li, di), k in zip(u.T, cnt):
        lex[int(li)]["st"][st_pos[int(di)]] = int(k)
    # показ — самое частое написание словоформы, совпадающее с леммой (канон 3.1)
    out = {}
    wy_s = Counter(C.t_year[stm].tolist())
    wy_l = Counter(C.t_year[subs["letters"]].tolist())
    for li, e in lex.items():
        name = nm(li)
        if C.l_name[li] or C.l_geo[li]:
            name = name[:1].upper() + name[1:]
        tot = sum(e["s"])
        if tot < 30:
            continue
        # рассказы (для подсветки листов в шапке) — только если слово есть не более чем в 250 рассказах
        stl = [x for kv in sorted(e["st"].items()) for x in kv] if len(e["st"]) <= 120 else []
        pp = lambda dct: [sum(v for y, v in dct.items() if a <= y <= b) for _, a, b, _ in rules.PERIODS]
        out[name] = [tot, e["s"], pp(e["sy"]), pp(e["ly"]), stl]
    pw = lambda cn: [sum(v for y, v in cn.items() if a <= y <= b) for _, a, b, _ in rules.PERIODS]
    OUT["words"] = {"top": top, "epochs": ep, "sub_words": {s: int(m.sum()) for s, m in subs.items()},
                    "periods": [p[0] for p in rules.PERIODS], "pw_s": pw(wy_s), "pw_l": pw(wy_l)}
    OUT["lex"] = out
    if QA:
        for s in top:
            print(" ", s, {P: [w for w, _ in v[:12]] for P, v in top[s].items()})
        for s in ep:
            for lab, rows in ep[s]:
                print(" ", s, lab, [r[0] for r in rows[:16]])
        print("  словоискатель:", len(out), "слов;", round(len(json.dumps(out, ensure_ascii=False)) / 1024), "KB")


# ======================= мир Чехова
def sent_with(t, form, maxw=34):
    for s in re.split(r"(?<=[.!?…])\s+", t):
        if re.search(r"(?i)(?<![а-яё])" + re.escape(form) + r"(?![а-яё])", s.replace("ё", "е")) and len(s.split()) <= maxw:
            return s.strip()
    return None


def world():
    D = C.docs
    grp = {"works": np.isin(C.t_dkind, ["story", "play"]) & (C.t_kind <= 2),
           "letters": (C.t_dkind == "letter") & (C.t_kind == 5)}
    n_docs = {g: len(set(C.t_doc[m].tolist())) for g, m in grp.items()}
    out = {"shelves": {}, "n_docs": n_docs, "audit": []}
    ptxt = C.ptext

    def ok_ctx(w, ti):
        pt = ptxt[C.t_para[ti]].replace("ё", "е")
        form = C.forms[C.t_form[ti]]
        m = re.search(r"(?i)(?<![а-я])" + re.escape(form) + r"(?![а-я])", pt)
        win = pt[max(0, m.start() - 30): m.end() + 30].lower() if m else pt.lower()
        if w == "чай":
            return form != "чай" or bool(re.search(r"пить|пью|пьем|пьет|пил|выпи|стакан|чашк|самовар|горяч|крепк|лимон|подали|налил|напи|чаепит|сахар", win))
        if w == "такса":
            return not re.search(r"аптекарск|по таксе|такса на|таксу на|цен", win)
        if w == "рак":
            return not re.search(r"желуд|раком|опухол|рак груди|рак печени", win)
        if w == "масло":
            return not re.search(r"маслян|краск|живопис|холст", win)
        if w == "линейка":
            return bool(re.search(r"ехать|поехал|сел|лошад|экипаж|линейк[еу] ", win))
        if w == "железная":
            return bool(re.search(r"железн\w+ дорог", win))
        return True
    for shelf, words in rules.WORLD.items():
        rows = []
        for w in words:
            li = C.lid(w)
            if li is None or C.lemmas[li] != w.replace("ё", "е") and w not in ("пельмени", "вареники", "сани", "дрожки", "сливки"):
                # лемма pymorphy не совпала со словом словаря — берём как есть, но проверяем аудитом
                pass
            if li is None:
                continue
            idx = np.nonzero(C.t_lemma == li)[0]
            if w in ("чай", "такса", "рак", "масло", "линейка", "железная"):
                idx = np.array([ti for ti in idx if ok_ctx(w, ti)], dtype=np.int64)
            row = {"w": "железная дорога" if w == "железная" else w}
            for g, m in grp.items():
                ii = idx[m[idx]] if len(idx) else idx
                docs = C.t_doc[ii] if len(ii) else np.array([], dtype=np.int32)
                row[g] = [int(len(set(docs.tolist()))), int(len(ii))]
                # пример — короткая фраза
                ex = None
                for ti in ii[:: max(1, len(ii) // 25)] if len(ii) else []:
                    s = sent_with(ptxt[C.t_para[ti]], C.forms[C.t_form[ti]])
                    if s and 5 <= len(s.split()):
                        d = D[int(C.t_doc[ti])]
                        ex = [s[:230], d["title"] if d["kind"] != "letter" else d["to_nom"], d["year"]]
                        break
                row["ex_" + g] = ex
                # по периодам (произведения)
                if g == "works":
                    row["per"] = [int(((C.t_year[ii] >= a) & (C.t_year[ii] <= b)).sum()) if len(ii) else 0 for _, a, b, _ in rules.PERIODS]
            if row["works"][1] + row["letters"][1] == 0:
                continue
            rows.append(row)
        rows.sort(key=lambda r: -(r["works"][0] + r["letters"][0]))
        out["shelves"][shelf] = rows
    # слова периода: на 10 000 слов произведений
    out["per_words"] = [int((grp["works"] & (C.t_year >= a) & (C.t_year <= b)).sum()) for _, a, b, _ in rules.PERIODS]
    out["group_words"] = {g: int(m.sum()) for g, m in grp.items()}
    # ---- места (топонимы) и люди: леммы, которые пишутся с заглавной, по разбору pymorphy
    from common import _morph
    M_ = _morph()
    cand = np.nonzero((C.l_capshare >= 0.7) & (C.l_count >= 8))[0]
    kind_of = {}
    for li in cand:
        lem = C.lemmas[li]
        tags = set()
        for p in M_.parse(lem)[:3]:
            tags |= set(p.tag.grammemes)
        if "Geox" in tags:
            kind_of[li] = "geo"
        elif "Surn" in tags:
            kind_of[li] = "surn"
        elif "Name" in tags:
            kind_of[li] = "name_" + ("f" if "femn" in tags and "masc" not in tags else "m")
        elif "Patr" in tags:
            kind_of[li] = "patr"
        elif not C.f_known[C.form_ix.get(lem, 0)] if lem in C.form_ix else True:
            kind_of[li] = "unk"
    doc_sets = {}
    for g, m in grp.items():
        mm = m & np.isin(C.t_lemma, list(kind_of)) & ~C.t_sst
        u = np.unique(np.stack([C.t_lemma[mm], C.t_doc[mm]]), axis=1)
        cnt = Counter(u[0].tolist())
        doc_sets[g] = cnt
    cap = lambda s: "-".join(x[:1].upper() + x[1:] for x in s.split("-"))
    addr_sur = {re.split(r"\s*\(", d["to_nom"])[0].split()[-1].lower().replace("ё", "е") for d in D if d["kind"] == "letter"}
    def rank(kinds, g, top):
        rows = [[cap(C.lemmas[li]), n, kind_of[li]] for li, n in doc_sets[g].items() if kind_of.get(li) in kinds]
        rows.sort(key=lambda r: -r[1])
        return rows[:top]
    import world_lists as WL

    def clean_rank(rows, drop, alias, top, cyr=True):
        acc = Counter()
        for name, n, _ in rows:
            if cyr and not re.match(r"^[А-ЯЁ]", name):
                continue
            k = alias.get(name, name)
            if name in drop and name not in alias:
                continue
            acc[k] = max(acc[k], n) if k != name else acc[k] + n if k in acc else n
        return [[k, v] for k, v in acc.most_common(top)]
    out["places"] = {g: clean_rank(rank({"geo"}, g, 200), WL.PLACE_DROP, WL.PLACE_ALIAS, 40) for g in grp}
    ppl = clean_rank(rank({"surn", "unk"}, "letters", 400), WL.PEOPLE_DROP, WL.PEOPLE_ALIAS, 130)
    out["people_letters"] = [[k, n, k.lower().replace("ё", "е") in addr_sur] for k, n in ppl]
    nw = {"m": [], "f": []}
    for g in ("m", "f"):
        for name, n, _ in rank({"name_" + g}, "works", 80):
            fx = WL.NAME_FIX.get(name, g)
            if fx is None:
                continue
            if isinstance(fx, tuple):
                name, fx = fx
            nw[fx].append([name, n])
    out["names_works"] = {g: sorted(v, key=lambda r: -r[1])[:30] for g, v in nw.items()}
    # клички
    ANW = re.compile(r"такс|собак|собачк|\bпс[аыу]\b|\bпес\b|щен|кошк|\bкот|мангус|лошад|гус[ья]|свинь|пуд|дворняж|\bпсов")
    pets = []
    for name, who, where, note in WL.PETS:
        rx = re.compile(r"(?<![А-Яа-яЁё])" + (r"[Сс]волоч(?:ь|ью|и)" if name == "Сволочь" else re.escape(name) + r"(?:[аеуы]|ом|ой|ою)?") + r"(?![а-яё])")
        docs = set()
        n = 0
        for pi, t in enumerate(ptxt):
            d = D[int(C.p_doc[pi])]
            if where == "letters":
                if d["kind"] != "letter":
                    continue
                for m in rx.finditer(t):
                    win = t[max(0, m.start() - 90): m.end() + 90].lower()
                    if (re.search(r"мангус", win) if name == "Сволочь" else ANW.search(win)):
                        n += 1
                        docs.add(int(C.p_doc[pi]))
            else:
                if d["kind"] != "story" or d["title"] != where:
                    continue
                k = len(rx.findall(t))
                n += k
                if k:
                    docs.add(int(C.p_doc[pi]))
        ys = sorted({D[i]["year"] for i in docs})
        pets.append({"name": name, "who": who, "where": "письма" if where == "letters" else f"«{where}»", "note": note, "n": n,
                     "docs": len(docs), "years": [ys[0], ys[-1]] if ys else None})
    out["pets"] = pets
    # «собака» — ласковое обращение к Книппер
    kn = [i for i, d in enumerate(D) if d["kind"] == "letter" and d["to_key"] == "Книппер О. Л."]
    kn_set = set(kn)
    dog_addr = sum(len(re.findall(r"(?i)\b(?:милая|моя|хорошая|дорогая|славная|добрая|собака моя|здравствуй,)\s*,?\s*собак|собака моя|собачка моя|моя собачка",
                                  ptxt[pi])) for pi in range(len(ptxt)) if int(C.p_doc[pi]) in kn_set)
    out["knipper_dog"] = dog_addr
    out["addr_sur"] = sorted(addr_sur)
    # «Иван Иваныч»: имя + отчество в произведениях, по числу текстов
    nm = defaultdict(set)
    for di, d in enumerate(D):
        if d["kind"] not in ("story", "play"):
            continue
    wm = grp["works"]
    idx = np.nonzero(wm)[0]
    kinds_arr = np.array([kind_of.get(int(l), "") for l in C.t_lemma[idx]], dtype=object)
    for k in np.nonzero((kinds_arr[:-1] == "name_m") | (kinds_arr[:-1] == "name_f"))[0]:
        a, b = idx[k], idx[k + 1]
        if b == a + 1 and C.t_para[a] == C.t_para[b] and kinds_arr[k + 1] == "patr":
            nm[C.forms[C.t_form[a]].capitalize() + " " + C.forms[C.t_form[b]].capitalize()].add(int(C.t_doc[a]))
    # нормализуем падеж: берём леммы
    nm2 = defaultdict(set)
    for k, s in nm.items():
        f1, f2 = k.split()
        l1 = C.lemmas[C.f_lemma[C.form_ix[f1.lower()]]]
        l2 = C.lemmas[C.f_lemma[C.form_ix[f2.lower()]]]
        l2c = cap(l2)
        if C.l_name[C.f_lemma[C.form_ix[f1.lower()]]] and any("femn" in p.tag for p in M_.parse(l1)[:1]):
            if not re.search(r"вна$|чна$", l2c):
                l2c = re.sub(r"ович$", "овна", l2c) if l2c.endswith("ович") else re.sub(r"евич$", "евна", l2c) if l2c.endswith("евич") else re.sub(r"ич$", "ична", l2c)
        nm2[cap(l1) + " " + l2c] |= s
    out["name_patr"] = sorted([[k, len(v)] for k, v in nm2.items()], key=lambda r: -r[1])[:30]
    OUT["world"] = out
    if QA:
        for shelf, rows in out["shelves"].items():
            print(" ", shelf, [(r["w"], r["works"][0], r["letters"][0]) for r in rows[:22]])
        print("  места (произв.):", out["places"]["works"][:30])
        print("  места (письма):", out["places"]["letters"][:30])
        print("  люди в письмах:", out["people_letters"][:60])
        print("  клички:", [(p["name"], p["n"], p["docs"], p["years"]) for p in out["pets"]], "собака-Книппер:", out["knipper_dog"])
        print("  имена м:", out["names_works"]["m"][:25])
        print("  имена ж:", out["names_works"]["f"][:25])
        print("  имя-отчество:", out["name_patr"][:20])
        # аудит по сырому тексту
        raw = "\n".join(ptxt[pi] for pi in range(len(ptxt)) if C.p_kind[pi] in (0, 1, 2, 5)).lower().replace("ё", "е")
        print("  аудит: слово | засчитано | основа в тексте")
        for shelf, words in rules.WORLD.items():
            got = {r["w"]: r["works"][1] + r["letters"][1] for r in out["shelves"][shelf]}
            for w in words:
                stem = w if len(w) <= 4 else w[:-1]
                n_raw = len(re.findall(r"\b" + re.escape(stem) + r"[а-я]{0,3}\b", raw))
                n = got.get("железная дорога" if w == "железная" else w, 0)
                if n_raw > 1.6 * n + 8:
                    print(f"     {shelf:14s} {w:12s} {n:6d} {n_raw:6d}")


# ======================= деньги в письмах
def money():
    D = C.docs
    lm = (C.t_dkind == "letter") & (C.t_kind == 5)
    sm = (C.t_dkind == "story") & (C.t_kind <= 1)
    ids = C.ids(rules.MONEY)
    is_m = np.isin(C.t_lemma, ids)
    years = list(range(1880, 1905))
    rate_l = [[y, r2(per(int((lm & is_m & (C.t_year == y)).sum()), int((lm & (C.t_year == y)).sum()), 10000))] for y in years
              if (lm & (C.t_year == y)).sum() > 3000]
    rate_s = [[lab, r2(per(int((sm & is_m & (C.t_year >= a) & (C.t_year <= b)).sum()), int((sm & (C.t_year >= a) & (C.t_year <= b)).sum()), 10000))]
              for lab, a, b, _ in rules.PERIODS]
    L = [i for i, d in enumerate(D) if d["kind"] == "letter"]
    has_m = np.bincount(C.t_doc[lm & is_m], minlength=len(D))
    share_year = [[y, sum(1 for i in L if D[i]["year"] == y and has_m[i]), sum(1 for i in L if D[i]["year"] == y)] for y in years]
    top = Counter(C.lemmas[int(l)] for l in C.t_lemma[lm & is_m]).most_common(30)
    # категории по фразам
    paras_of = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        paras_of[int(di)].append(pi)
    cats = {k: re.compile(v) for k, v in rules.MONEY_CAT.items()}
    cat_year = {k: Counter() for k in cats}
    cat_to = {k: Counter() for k in cats}
    ex = {k: [] for k in cats}
    amounts = []
    amt_rx = re.compile(rules.AMOUNT)
    for i in L:
        d = D[i]
        hit = set()
        for pi in paras_of[i]:
            for s in re.split(r"(?<=[.!?…])\s+", C.ptext[pi]):
                for k, rx in cats.items():
                    if rx.search(s):
                        if k not in hit:
                            hit.add(k)
                            if 4 <= len(s.split()) <= 45:
                                ex[k].append({"s": s.strip(), "to": d["to_nom"], "y": d["year"]})
                for m in amt_rx.finditer(s):
                    v = m.group(1).replace(" ", "").replace(",", ".")
                    try:
                        v = float(v)
                    except ValueError:
                        continue
                    if m.group(2):
                        v *= 1000
                    if 0 < v < 1e6:
                        amounts.append([d["year"], v, d["to_nom"], s.strip()[:200]])
        for k in hit:
            cat_year[k][d["year"]] += 1
            cat_to[k][d["to_nom"]] += 1
    # примеры: равномерно по годам, не больше 24 на категорию
    for k in ex:
        L_ = sorted(ex[k], key=lambda r: (r["y"] or 0))
        step = max(1, len(L_) // 24)
        ex[k] = L_[::step][:24]
    # по адресатам: денежных слов на 10 000
    w_to, m_to = Counter(), Counter()
    lw = np.bincount(C.t_doc[lm], minlength=len(D))
    mw = np.bincount(C.t_doc[lm & is_m], minlength=len(D))
    for i in L:
        w_to[D[i]["to_nom"]] += int(lw[i])
        m_to[D[i]["to_nom"]] += int(mw[i])
    to_rate = sorted([[k, m_to[k], w_to[k], r1(per(m_to[k], w_to[k], 10000))] for k in w_to if w_to[k] >= 8000], key=lambda r: -r[3])
    big = sorted(amounts, key=lambda r: -r[1])[:25]
    OUT["money"] = {"rate_letters": rate_l, "rate_stories": rate_s, "share_year": share_year, "top": top,
                    "letters_rate": r2(per(int((lm & is_m).sum()), int(lm.sum()), 10000)),
                    "stories_rate": r2(per(int((sm & is_m).sum()), int(sm.sum()), 10000)),
                    "letters_with": int((has_m[[i for i in L]] > 0).sum()),
                    "cats": list(cats), "cat_year": {k: dict(sorted(v.items())) for k, v in cat_year.items()},
                    "cat_n": {k: sum(v.values()) for k, v in cat_year.items()},
                    "cat_to": {k: v.most_common(8) for k, v in cat_to.items()}, "examples": ex,
                    "amounts": [[a[0], round(a[1], 2)] for a in amounts], "amount_big": big, "to_rate": to_rate[:20]}
    if QA:
        print("  денежных слов на 10 000: письма", OUT["money"]["letters_rate"], "рассказы", OUT["money"]["stories_rate"])
        print("  писем с деньгами:", OUT["money"]["letters_with"], "из", len(L))
        print("  топ:", top)
        print("  категории:", OUT["money"]["cat_n"])
        for k in ex:
            print("  ==", k, OUT["money"]["cat_to"][k][:5])
            import random
            random.seed(7)
            for e in random.sample(ex[k], min(8, len(ex[k]))):
                print("     ", e["y"], e["to"][:18], "|", e["s"][:170])
        print("  сумм:", len(amounts), "крупные:", [(b[0], b[1], b[2][:15], b[3][:80]) for b in big[:10]])
        print("  адресаты:", to_rate[:10])


def cherry():
    """«вишнёвый» в письмах: сколько раз это название пьесы, а сколько — цвет/ягода."""
    play = other = 0
    for i, d in enumerate(C.docs):
        if d["kind"] != "letter":
            continue
    L = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        if C.docs[int(di)]["kind"] == "letter":
            L[int(di)].append(C.ptext[pi])
    for di, ps in L.items():
        t = " ".join(ps)
        if re.search(r"Вишнев\w* сад|«Вишнев", t):
            play += 1
        elif re.search(r"вишнев", t):
            other += 1
    OUT.setdefault("world", {})["cherry"] = {"play": play, "other": other}


def people_force():
    """Толстой, Горький, Пушкин: фамилии, которые pymorphy разбирает как прилагательное или город (world_lists.FORCE_PERSON)."""
    import world_lists as WL
    L = defaultdict(list)
    for pi, di in enumerate(C.p_doc):
        if C.p_kind[pi] == 5:
            L[int(di)].append(C.ptext[pi])
    addr = set(OUT["world"].get("addr_sur", []))
    ppl = [r for r in OUT["world"]["people_letters"] if r[0] not in WL.FORCE_PERSON]
    for name, rx in WL.FORCE_PERSON.items():
        n = sum(1 for ps in L.values() if re.search(r"(?<![А-Яа-яЁё])" + rx, " ".join(ps)))
        ppl.append([name, n, name.lower() in addr])
    ppl.sort(key=lambda r: -r[1])
    OUT["world"]["people_letters"] = ppl[:130]
    if QA:
        print("  люди:", ppl[:15])


C_DIR = __import__("pathlib").Path(__file__).parent.parent
MODULES = {"overview": overview, "prose": prose, "plays": plays, "letters": letters, "swear": swear, "medicine": medicine, "quotes": quotes, "words": words, "world": world, "money": money, "cherry": cherry, "people_force": people_force, "myths": myths}


def main():
    global C
    C = Corpus()
    path = C_DIR / "analysis" / "stats.json"
    if ONLY and path.exists():
        OUT.update(json.load(open(path, encoding="utf-8")))
    for name, f in MODULES.items():
        if ONLY and name not in ONLY:
            continue
        print("==", name)
        f()
    json.dump(OUT, open(path, "w", encoding="utf-8"), ensure_ascii=False, default=lambda o: o if not hasattr(o, "item") else o.item())
    print("stats.json:", round(path.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
