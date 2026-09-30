"""Шаг 3. Разметка: абзацы по видам, подписи и конверты писем, фразы, словоформы, начальные формы (pymorphy3).

Виды абзацев:
  nar — повествование; dlg — реплика (абзац начинается с тире/кавычки и короче 120 слов, канон 4.12);
  speech — речь персонажа пьесы (говорящий — полужирное в начале абзаца); stage — ремарка;
  cast — список действующих лиц; body — текст письма; sig — подпись; env — конверт/адрес; date — дата внутри письма.
Очистка: «<…>» — пропуск публикатора (считается, из текста убирается); «Петерб<ургскую>» — раскрытие сокращения
(скобки снимаются); «<нрзб.>» — неразборчиво (считается); знак ударения U+0301 снимается.

Выход: analysis/corpus.pkl. Запуск: python prepare.py [--qa]
"""
import json
import pickle
import re
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pymorphy3

HERE = Path(__file__).parent
TEXTS = HERE.parent / "texts"
KEEP_ROLES = {"story", "play", "nonfic", "article", "medical", "notebook", "diary", "juvenilia"}

WORD = re.compile(r"[А-Яа-яЁёA-Za-z]+(?:-[А-Яа-яЁёA-Za-z]+)*")
SENT_END = re.compile(r"([.!?…]+[»\")]?)\s+(?=[—–«\"(]?\s*[А-ЯЁA-Z])")
CUT = re.compile(r"<\s*(?:…|\.\.\.)\s*>")
ILLEG = re.compile(r"<\s*нрзб\.?\s*>", re.I)
FILL = re.compile(r"<([^<>…]{1,40})>")

# ---------- письма: подписи, конверты
ADDRESS = re.compile(r"высокоблагороди|превосходительств|сиятельств|благородию|^Доктору|^Здесь\b|Заказное|На обороте|"
                     r"Russie|Russland|\bгуб\.|\bд\.\s|\bд-м\b|\bдом\b|\bпер\.|\bул\.|\bкв\.|\bпл\.|редакци|\bуезда?\b|"
                     r"\bстанци|\bпочт(?:а|ы|е|ой|овый|овая|амт)\b|Мойка|Невский|Кирпичный|инспектору|[Нн]ачальнику|«Нива»|"
                     r"\b[А-ЯЁ][а-яё]+(?:овичу|евичу|ьичу|ичу|овне|евне|ичне|ьевне|ишне)\b|Jalta|Moscou|Moskau|"
                     r"^\s*(?:Москва|Петербург|Ялта|Таганрог|Лопасня|Серпухов|Сумы|Ницца|Париж)\.?\s*$|"
                     r"^[А-ЯЁ][а-яё\-]+\.\s+(?:[^.]*\.\s+)?[А-ЯЁ][а-яё\-]*(?:ой|ову|еву|ину|ыну|ому|скому|ю|у)\.?$")
DATEISH = re.compile(r"^(?:\d{1,2}(?:-?го)?\s*[а-я]{3,9}\.?|[Пп]онедельник|[Вв]торник|[Сс]реда|[Чч]етверг|[Пп]ятница|"
                     r"[Сс]уббота|[Вв]оскресенье|[Нн]очь|[Уу]тро|[Вв]ечер)[\s.,\d]*(?:\S+\.?){0,3}$")
FORMULA = re.compile(r"^((?:(?:[Вв]аш(?:его|им|а|е|и)?|[Тт]во(?:й|я|и|его|им)|[Вв]есь|[Вв]сегда|[Ии]скренн[оe]|[Дд]ушевно|"
                     r"[Сс]ердечно|[Гг]лубоко|[Гг]орячо|[Пп]реданн(?:ый|ейший|ого)|[Уу]важающ(?:ий|ая|его)|[Лл]юбящ(?:ий|ая|его)|"
                     r"[Бб]лагодарн(?:ый|ейший)|[Гг]отовый|к\s+услугам|[Сс]\s+почтением|и|Вас|тебя|вас|душой|всей|душою|"
                     r"неизменно|искренно|[Пп]очитающ(?:ий|ая)|[Сс]\s+совершенным\s+почтением|[Сс]\s+глубоким\s+уважением|"
                     r"[Сс]\s+истинным\s+уважением|имею\s+честь\s+быть|[Вв]ерный|[Пп]окорн(?:ый|ейший)|"
                     r"[Кк]репко\s+жму\s+(?:Вам\s+|тебе\s+)?руку|[Жж]му\s+(?:Вам\s+|тебе\s+)?руку|[Цц]елую|[Оо]бнимаю|"
                     r"[Кк]репко|[Жж]елаю\s+Вам\s+всего\s+хорошего|[Бб]удьте\s+здоровы(?:\s+и\s+благополучны)?|"
                     r"[Бб]удь\s+здоров|[Пп]ривет|[Кк]ланяюсь|Tuus|Votre(?:\s+à\s+tous)?|[Ии]мею\s+честь\s+быть|"
                     r"[Оо]ста(?:юсь|емся)|Вам|[Вв]сем\s+сердцем|[Вв]сей\s+душой|[Ии]скренне)(?![А-Яа-яЁёA-Za-z])\s*[,.!]?\s*)+)")
# форма имени — в конце подписи; всё между формулой и именем — самоименование («благодетель», «Иеромонах», «муж»)
NAME_END = re.compile(r"((?:(?:А|Ан|Ант|Антоша|Антон)\.?\s*(?:П\.\s*)?)?(?:Чехов(?:а|ым|у)?|Чехонте|Ч)\.?|"
                      r"Антуан(?:\s+Чехов)?|Антоний|Антон|Антоша|Антонио|Antoine|Antonio|Antonius|Anton|Tonio|Тото|"
                      r"Tchechoff|Tchekhoff|Tschechoff|А\.?|Ант\.?)\s*$")
SIG_TAIL = re.compile(r"\.\s+(?:\d|[Пп]онедельник|[Вв]торник|[Сс]реда|[Чч]етверг|[Пп]ятница|[Сс]уббота|[Вв]оскресенье|"
                      r"Ялта|Москва|Мелихово|На бланке|P\.\s*S|Р\.\s*S).*$")


PLACES = set()


def em_frac(b):
    t = b["t"]
    return sum(e - s for s, e in b["em"]) / max(1, len(t))


def letter_parts(blocks):
    """Разделяет блоки письма: тело, подпись, конверт, даты. Возвращает (body_blocks, sig_text, env_texts, sig_how)."""
    kinds = []
    env_mode = False
    for b in blocks:
        t, ef = b["t"], em_frac(b)
        sig_like = ef >= 0.6 and len(t.split()) <= 14 and (bool(FORMULA.match(t)) or bool(
            re.search(r"\bА\.\s*Чехов|Antoine|Antonio|Антонио|\bАнтон\b|Чехонте", t)))
        if re.match(r"^(?:На обороте|На конверте|На бланке)\s*:", t) or re.match(r"^(?:На обороте|На конверте)\.?\s*$", t):
            env_mode = True
        if env_mode:
            kinds.append("env")
        elif sig_like:
            kinds.append("ital")
        elif ef >= 0.6 and (ADDRESS.search(t) or t.split(".")[0].strip() in PLACES):
            kinds.append("env")
        elif ef >= 0.6 and len(t.split()) <= 6 and DATEISH.match(t):
            kinds.append("date")
        elif ef >= 0.6 and len(t.split()) <= 12:
            kinds.append("ital")
        else:
            kinds.append("body")
    # подпись — последняя группа коротких курсивных блоков (ital) в конце письма, до конверта;
    # после неё может идти приписка (P. S.) обычным шрифтом, но не больше 3 абзацев
    sig_idx = []
    last_body = max([i for i, k in enumerate(kinds) if k == "body"], default=-1)
    ital = [i for i, k in enumerate(kinds) if k == "ital"]
    for i in reversed(ital):
        after_body = sum(1 for j in range(i + 1, len(kinds)) if kinds[j] == "body")
        if after_body <= 3:
            sig_idx = [i]
            j = i - 1
            while j >= 0 and kinds[j] in ("ital",) and len(sig_idx) < 3:
                sig_idx.insert(0, j)
                j -= 1
            break
    how = "block"
    sig = " ".join(blocks[i]["t"] for i in sig_idx).strip()
    if not sig:  # подпись в конце последнего абзаца курсивом
        for i in range(len(blocks) - 1, max(-1, len(blocks) - 4), -1):
            b = blocks[i]
            if kinds[i] != "body" or not b["em"]:
                continue
            s, e = b["em"][-1]
            if e >= len(b["t"]) - 2 and len(b["t"][s:e].split()) <= 8:
                sig, how = b["t"][s:e].strip(), "inline"
                b = dict(b)
                b["t"] = b["t"][:s].rstrip()
                blocks = blocks[:i] + [b] + blocks[i + 1:]
                break
    body = [b for i, b in enumerate(blocks) if kinds[i] in ("body",) or (kinds[i] == "ital" and i not in sig_idx)]
    env = [blocks[i]["t"] for i, k in enumerate(kinds) if k == "env"]
    return body, sig, env, how if sig else None


def split_sig(sig):
    """«Твой благодетель А. Чехов. 96 1/XI.» → формула «Твой», самоименование «благодетель», имя «А. Чехов»."""
    s = re.sub(r"\s+", " ", sig).strip()
    s = re.split(r"\s*Рукой\s", s)[0]
    s = SIG_TAIL.sub("", s).strip(" .,!")
    s = re.sub(r"[\s.]+\d{1,2}(?:\s*[/—–-]|\s+\d{2}\b|\s+[а-я]{3}).*$|\s+\d{2}\s*[—–-]?\s*\d{0,2}/?[IVXLC]+.*$", "", s)
    s = s.replace("*", "").strip(" .,!")
    m = FORMULA.match(s)
    formula = m.group(1).strip(" ,.!") if m else ""
    rest = s[m.end():].strip() if m else s
    n = NAME_END.search(rest)
    if n and n.group(1).strip():
        name, title = n.group(1).strip(" .,"), rest[: n.start()].strip(" .,")
    else:
        name, title = "", rest.strip(" .,")
    return formula, title, name


# ---------- очистка и абзацы
INWORD = re.compile(r"([А-Яа-яЁё]+)<\s*(?:…|\.\.\.)\s*>([А-Яа-яЁё]*)|<\s*(?:…|\.\.\.)\s*>([А-Яа-яЁё]+)")


def clean(t, cnt):
    for m in INWORD.finditer(t):  # купюра внутри слова: «ж<…>», «др<…>ный» — видно, какое слово вырезано
        cnt.setdefault("inword", []).append(m.group(0))
    t = INWORD.sub(" ", t)
    cnt["cuts"] += len(CUT.findall(t)) + len(cnt.get("inword", [])) - cnt.get("_inw_seen", 0)
    cnt["_inw_seen"] = len(cnt.get("inword", []))
    cnt["illeg"] += len(ILLEG.findall(t))
    t = CUT.sub(" ", t)
    t = ILLEG.sub(" ", t)
    t = FILL.sub(r"\1", t)
    t = t.replace("́", "").replace("­", "")
    t = re.sub(r"\[\d+\]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def story_paras(w, cnt):
    out = []
    for b in w["blocks"]:
        if b["tag"].startswith("h") or not b["t"].strip():
            continue
        t = clean(b["t"], cnt)
        if not t or re.fullmatch(r"[IVXLC]+\.?|\*+|\d+", t):
            continue
        n = len(WORD.findall(t))
        kind = "dlg" if re.match(r"^[—–-]\s|^«", t) and n < 120 else "nar"
        out.append({"kind": kind, "t": t})
    return out


def play_paras(w, cnt):
    out, in_cast = [], False
    for b in w["blocks"]:
        t0 = b["t"].strip()
        if not t0:
            continue
        if b["tag"].startswith("h"):
            in_cast = False
            continue
        if re.match(r"^(ДЕЙСТВУЮЩИЕ\s+ЛИЦА|Действующие\s+лица)", t0):
            in_cast = True
            continue
        if in_cast:
            if b["st"] and b["st"][0][0] == 0:
                in_cast = False
            else:
                out.append({"kind": "cast", "t": clean(t0, cnt)})
                continue
        if b["st"] and b["st"][0][0] == 0:
            s, e = b["st"][0]
            spk = t0[s:e].strip(" .")
            rest = t0[e:]
            # ремарки в скобках курсивом внутри реплики
            rem = [t0[a:c] for a, c in b["em"] if a >= e]
            speech = rest
            for r in rem:
                speech = speech.replace(r, " ")
            speech = re.sub(r"^\s*[.,:]\s*", "", speech)
            out.append({"kind": "speech", "t": clean(speech, cnt), "spk": spk})
            for r in rem:
                out.append({"kind": "stage", "t": clean(r, cnt), "spk": spk})
        else:
            out.append({"kind": "stage", "t": clean(t0, cnt)})
    return [p for p in out if p["t"]]


def plain_paras(w, cnt):
    out = []
    for b in w["blocks"]:
        if b["tag"].startswith("h"):
            continue
        t = clean(b["t"], cnt)
        if t:
            out.append({"kind": "nar", "t": t})
    return out


def sentences(t):
    """Длины фраз в словах (граница — . ! ? … перед заглавной, тире или кавычкой)."""
    parts = SENT_END.split(t)
    sents, cur = [], ""
    for i, p in enumerate(parts):
        cur += p
        if i % 2 == 1:
            sents.append(cur)
            cur = ""
    if cur.strip():
        sents.append(cur)
    return [n for n in (len(WORD.findall(s)) for s in sents) if n > 0]


def main(qa=False):
    works = [json.loads(l) for l in open(TEXTS / "works.jsonl", encoding="utf-8")]
    letters = [json.loads(l) for l in open(TEXTS / "letters.jsonl", encoding="utf-8")]
    PLACES.update(r["place_n"] for r in letters if r["place_n"])
    PLACES.update(["Лопасня", "Ст", "Серпухов", "Алексин", "Сахалин", "Ефремов"])
    docs = []
    for w in works:
        if w["role"] not in KEEP_ROLES:
            continue
        cnt = Counter()
        f = story_paras if w["role"] == "story" else play_paras if w["role"] == "play" else plain_paras
        paras = f(w, cnt)
        docs.append({"id": w["id"], "kind": w["role"], "title": w["title"], "vol": w["vol"], "year": w["year_final"],
                     "year_how": w["year_how"], "outlet": w.get("outlet"), "sig_family": w["sig_family"],
                     "sig": w.get("sig_clean"), "unfinished": w["unfinished"], "section": w["section"],
                     "paras": paras, "cuts": cnt["cuts"], "illeg": cnt["illeg"]})
    sig_rows = []
    for r in letters:
        cnt = Counter()
        blocks = r["blocks"][r.get("body_from", 2):]
        body, sig, env, how = letter_parts(blocks)
        paras = [{"kind": "body", "t": clean(b["t"], cnt)} for b in body]
        paras = [p for p in paras if p["t"]]
        formula, title, name = split_sig(clean(sig, Counter())) if sig else ("", "", "")
        docs.append({"id": r["uid"], "kind": "letter", "title": r["label"], "vol": r["vol"], "year": r["year"],
                     "month": r["month"], "day": r["day"], "exact": r["exact"], "num": r.get("num"),
                     "to_key": r["to_key"], "to_nom": r["to_nom"], "family": r["family"], "place": r["place_n"],
                     "lang": r["lang"], "sig_raw": sig, "sig_formula": formula, "sig_title": title, "sig_name": name, "sig_how": how,
                     "env": env, "paras": paras, "cuts": cnt["cuts"], "illeg": cnt["illeg"],
                     "cut_words": cnt.get("inword", [])})
    print("документов:", Counter(d["kind"] for d in docs))

    # ---------- токены
    morph = pymorphy3.MorphAnalyzer()
    form_ix, forms = {}, []
    tok_form, tok_doc, tok_para, tok_cap, tok_sst = [], [], [], [], []
    paras_tab = []  # (doc, kind, spk, n_words, sent_lens)
    for di, d in enumerate(docs):
        for p in d["paras"]:
            pi = len(paras_tab)
            words = [(m.group(0), m.start()) for m in WORD.finditer(p["t"])]
            sl = sentences(p["t"])
            paras_tab.append((di, p["kind"], p.get("spk"), len(words), sl))
            # начало фразы: первое слово абзаца и слова после границы
            starts = {0}
            acc = 0
            for n in sl[:-1]:
                acc += n
                starts.add(acc)
            for k, (wd, _) in enumerate(words):
                lw = wd.lower().replace("ё", "е")
                fi = form_ix.get(lw)
                if fi is None:
                    fi = form_ix[lw] = len(forms)
                    forms.append(lw)
                tok_form.append(fi)
                tok_doc.append(di)
                tok_para.append(pi)
                tok_cap.append(wd[0].isupper())
                tok_sst.append(k in starts)
    print("слов:", len(tok_form), "разных словоформ:", len(forms))

    lemma_ix, lemmas = {}, []
    f_lemma, f_pos, f_name, f_geo, f_known = [], [], [], [], []
    for f in forms:
        pr = morph.parse(f)[0]
        lem = pr.normal_form.replace("ё", "е")
        li = lemma_ix.get(lem)
        if li is None:
            li = lemma_ix[lem] = len(lemmas)
            lemmas.append(lem)
        f_lemma.append(li)
        f_pos.append(str(pr.tag.POS) if pr.tag.POS else ("LATN" if re.match(r"[a-z]", f) else "NONE"))
        g = pr.tag.grammemes
        f_name.append(bool(g & {"Name", "Surn", "Patr"}))
        f_geo.append("Geox" in g)
        f_known.append(morph.word_is_known(f))
    corpus = {
        "docs": [{k: v for k, v in d.items() if k != "paras"} for d in docs],
        "para_text": [p["t"] for d in docs for p in d["paras"]],
        "paras": paras_tab,
        "forms": forms, "lemmas": lemmas,
        "f_lemma": np.array(f_lemma, dtype=np.int32), "f_pos": np.array(f_pos, dtype=object),
        "f_name": np.array(f_name), "f_geo": np.array(f_geo), "f_known": np.array(f_known),
        "t_form": np.array(tok_form, dtype=np.int32), "t_doc": np.array(tok_doc, dtype=np.int32),
        "t_para": np.array(tok_para, dtype=np.int32), "t_cap": np.array(tok_cap), "t_sst": np.array(tok_sst),
    }
    with open(HERE / "corpus.pkl", "wb") as fh:
        pickle.dump(corpus, fh, protocol=4)
    print("сохранено", HERE / "corpus.pkl")
    if qa:
        qa_report(corpus)


def qa_report(C):
    docs = C["docs"]
    L = [d for d in docs if d["kind"] == "letter"]
    print("\n=== подписи найдены:", sum(1 for d in L if d["sig_raw"]), "из", len(L),
          Counter(d["sig_how"] for d in L))
    print("   по томам без подписи:", sorted(Counter(d["vol"] for d in L if not d["sig_raw"]).items()))
    print("\n=== формы имени (топ-80):")
    for k, v in Counter(d["sig_name"] for d in L).most_common(80):
        print(f"   {v:5d} | {k}")
    print("\n=== формулы (топ-30):", Counter(d["sig_formula"] for d in L).most_common(30))
    print("\n=== самоименования:", Counter(d["sig_title"] for d in L if d["sig_title"]).most_common(200))
    print("\n=== без подписи (40 случайных): последние 2 абзаца")
    import random
    random.seed(2)
    for d in random.sample([d for d in L if not d["sig_raw"]], 40):
        print(f"   [{d['to_nom'][:18]}, {d['year']}] env={d['env'][:2]}")
    print("\n=== купюр <…> в письмах:", sum(d["cuts"] for d in L), "в письмах с купюрами:", sum(1 for d in L if d["cuts"]),
          "| в произведениях:", sum(d["cuts"] for d in docs if d["kind"] != "letter"))
    kinds = Counter(p[1] for p in C["paras"])
    print("\n=== абзацы по видам:", kinds)
    import random
    random.seed(1)
    print("\n=== 25 случайных писем: подпись | конец тела")
    for d in random.sample(L, 25):
        print(f"   [{d['to_nom'][:20]}, {d['year']}] sig={d['sig_raw']!r}  env={d['env'][:1]}")


if __name__ == "__main__":
    main(qa="--qa" in sys.argv)
