"""Шаг 2. Манифест: роль каждого текста, год, подпись в печати, адресат и место письма, дубли.

Роли (явная таблица ниже, пересобирается):
  story     — рассказы, повести, юморески (т. 1–10), включая неоконченное (флаг unfinished);
  play      — пьесы (т. 11–13); «Иванов» т. 11 (первая редакция) — redaction, в подсчётах не участвует;
  nonfic    — «Из Сибири», «Остров Сахалин» (т. 14–15);
  article   — статьи, рецензии, заметки, воззвания (т. 16);
  medical   — «Врачебное дело в России», медицинские отчёты по Мелиховскому участку (т. 16, приложения);
  notebook  — записные книжки, записи на листах (т. 17); diary — дневниковые записи (т. 17);
  juvenilia — гимназическое, стихотворения, записи в альбомах (т. 18) — считается, в меры прозы не входит;
  excluded  — «Другие редакции», Dubia, Коллективное, Редактированное, списки, адресная книжка — считается и называется.
Письма: role=letter; надписи (inscr) и официальные бумаги (doc) — отдельно.

Выход: texts/works.jsonl, texts/letters.jsonl, texts/manifest.csv, texts/letters.csv, texts/manifest_log.json
Запуск: python manifest.py [--qa]
"""
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
CORP, OUT = HERE / "corpus", HERE / "texts"

VOL_RANGE = {1: (1880, 1882), 2: (1883, 1884), 3: (1884, 1885), 4: (1885, 1886), 5: (1886, 1886), 6: (1887, 1887),
             7: (1888, 1891), 8: (1892, 1894), 9: (1894, 1897), 10: (1898, 1903), 11: (1878, 1888),
             12: (1889, 1891), 13: (1895, 1904), 14: (1890, 1895), 16: (1881, 1902), 17: (1891, 1904), 18: (1875, 1904)}

# ---------- роли произведений
def work_role(w):
    v, sec, t = w["vol"], w["section"], w["title"]
    if t in ("Другие редакции", "Редактированное", "Список произведений, ранее приписывавшихся Чехову", "Адресная книжка"):
        return "excluded", t
    if sec.startswith("Dubia"):
        return "excluded", "Dubia (авторство под сомнением)"
    if sec.startswith("Коллективное"):
        return "excluded", "Коллективное (в соавторстве)"
    if v <= 10:
        return "story", ""
    if v <= 13:
        if v == 11 and t == "Иванов":
            return "redaction", "первая редакция (1887); в подсчётах — редакция 1889 г. из т. 12"
        return "play", ""
    if v == 14:
        return "nonfic", ""
    if v == 16:
        if t.startswith(("Врачебное дело", "Медицинский отчет")):
            return "medical", ""
        return "article", ""
    if v == 17:
        return ("diary", "") if sec.startswith("Дневниковые") else ("notebook", "")
    if v == 18:
        return "juvenilia", ""
    return "excluded", "нет правила"


# ---------- подпись в печати → семейство
SIG_FAMILY = [
    ("Чехонте", r"Чехонте|Антоша|Ч-те|Антонио"),
    ("Человек без селезёнки", r"селезенки|Ч\. без с|Ч\. Б\. С"),
    ("Брат моего брата", r"Брат моего брата"),
    ("Чехов", r"Чехов"),
    ("А. Ч.", r"^(?:А|Ан)\. Ч\.?$|^А\. П\.?$|^Анче$"),
]


def sig_family(w):
    s, note = w.get("signature"), w.get("note") or ""
    if s:
        s = re.split(r"\.\s+(?:Помета|Дата|Посвящение|Рисунки|К заглавию)|\s+\(", s)[0].strip()
        for fam, rx in SIG_FAMILY:
            if re.search(rx, s):
                return fam, s
        return "другие псевдонимы", s
    if re.search(r"[Бб]ез подписи", note):
        return "без подписи", None
    if re.search(r"[Пп]одпись\s*(?:—\s*)?(?:см\.\s*)?в тексте|[Ии]мя автора\s*—\s*в (?:под)?заголовке|Антоши Ч", note):
        return "в тексте или заголовке", None
    if re.search(r"Антона Чехова|А\. Чехова|А\. П\. Чехова|Ант\. П\. Чехова", note):
        return "Чехов", "имя на издании"
    return "нет данных", None


# ---------- письма: адресат
ADDR_MERGE = {  # написания одного адресата → одно (явный список, приводится в методике)
    "Книппер-Чеховой О. Л.": "Книппер О. Л.",
    "Шавровой-Юст Е. М.": "Шавровой Е. М.",
    "Пешкову А. М. (М. Горькому)": "Пешкову А. М.",
}
NOM_FIX = {"Книппер О. Л.": "О. Л. Книппер", "Пешкову А. М.": "А. М. Горький (Пешков)", "Чеховым": "семье Чеховых",
           "Толстому Л. Н.": "Л. Н. Толстой", "Горькому": "М. Горький", "Сумбатову (Южину) А. И.": "А. И. Сумбатов (Южин)"}
FAMILY = {"Чеховой М. П.": "сестра Мария", "Чехову Ал. П.": "брат Александр", "Чехову И. П.": "брат Иван",
          "Чехову М. П.": "брат Михаил", "Чехову Н. П.": "брат Николай", "Чеховой Е. Я.": "мать",
          "Чехову П. Е.": "отец", "Чеховым": "семья", "Книппер О. Л.": "жена"}


def addr_key(label):
    k = re.sub(r"\s*\(\?\)\s*", " ", label).strip()
    k = ADDR_MERGE.get(k, k)
    return k


def dative_to_nom(key):
    """«Суворину А. С.» → «А. С. Суворин» (правила + явные исправления NOM_FIX)."""
    if key in NOM_FIX:
        return NOM_FIX[key]
    m = re.match(r"^(.+?)(?:\s+\((.+?)\))?\s+((?:[А-ЯЁ][а-яё]?\.\s*){1,3})$", key)
    if not m:
        return key
    sur, alias, ini = m.group(1), m.group(2), m.group(3).strip()

    def one(w):
        parts = w.split("-")
        out = []
        for p in parts:
            for a, b in (("скому", "ский"), ("цкому", "цкий"), ("ской", "ская"), ("цкой", "цкая"), ("ому", "ой"),
                         ("ову", "ов"), ("еву", "ев"), ("ёву", "ёв"), ("ину", "ин"), ("ыну", "ын"),
                         ("овой", "ова"), ("евой", "ева"), ("иной", "ина"), ("ыной", "ына"), ("ой", "ая"),
                         ("ичу", "ич"), ("ью", "ь"), ("ю", "ь"), ("у", "")):
                if p.endswith(a) and len(p) > len(a) + 1:
                    p = p[: -len(a)] + b
                    break
            out.append(p)
        return "-".join(out)

    nom = one(sur)
    s = f"{ini} {nom}"
    if alias:
        s += f" ({one(alias)})"
    return s


# ---------- письма: дата
MONTHS = [("январ", 1), ("феврал", 2), ("март", 3), ("апрел", 4), ("ма[йя]", 5), ("июн", 6), ("июл", 7), ("август", 8),
          ("сентябр", 9), ("октябр", 10), ("ноябр", 11), ("декабр", 12)]


def parse_date(label):
    """Дата по старому стилю — основная; скобки (новый стиль за границей, «?» и цитаты-различители) снимаются до разбора."""
    lab = re.sub(r"\([^)]*\)", " ", label)
    y = re.findall(r"\b(1[89]\d\d)\b", lab)
    year = int(y[-1]) if y else None
    mon, pos = None, 10 ** 9
    for stem, k in MONTHS:
        m = re.search(r"\b" + stem, lab.lower())
        if m and m.start() < pos:
            mon, pos = k, m.start()
    d = re.match(r"^\s*(\d{1,2})\s", lab)
    exact = bool(d and mon and not re.search(r"или|не позднее|не ранее|до |после |между|—|\?|конец|начало|середина", label))
    return year, mon, int(d.group(1)) if d else None, exact


PLACE_FIX = {"Лопасня": "Мелихово"}  # письма «из Лопасни» — почтовое отделение Мелихова (в методике)


def norm_place(p, dateline):
    """Место — текст после последнего «18NN г.» строки даты (опечатки OCR: «е.», «в.», «з.» вместо «г.»)."""
    ms = list(re.finditer(r"\b1[89]\d\d(?:-х|-е)?\??\s*(?:гг?\.?|[евз]\.|годов\.|годы\.)?\s*\)?\s*[,.]?\s*(?:г\.\s*)?",
                          dateline or ""))
    if ms:
        p = (dateline[ms[-1].end():] or "").strip() or p
    if not p:
        return None
    p = re.sub(r"^\(\?\)\s*|\s*\(\?\)|^\?\s*|^\([^)]*\)\s*", "", p).strip(" .,:")
    p = re.split(r"\s*[—–]\s*|,\s*|[.:!]\s*", p)[0].strip()
    if not p or not re.match(r"[А-ЯЁA-Z]|в поезде|на пароходе", p):
        return None
    return PLACE_FIX.get(p, p)


# ---------- шинглы для дублей
def shingles(text, k=5):
    w = re.findall(r"[а-яёa-z]+", text.lower())
    return {hash(" ".join(w[i:i + k])) for i in range(max(0, len(w) - k + 1))}


def main(qa=False):
    OUT.mkdir(exist_ok=True)
    works = [json.loads(l) for l in open(CORP / "works.jsonl", encoding="utf-8")]
    letters = [json.loads(l) for l in open(CORP / "letters.jsonl", encoding="utf-8")]
    other = [json.loads(l) for l in open(CORP / "other.jsonl", encoding="utf-8")]

    # --- произведения
    prev_year = {}
    for w in works:
        w["role"], w["role_note"] = work_role(w)
        w["unfinished"] = bool(re.match(r"Неопубликованное|Неоконченное", w["section"]))
        y, src = w.get("year"), w.get("year_src")
        if y and y > 1904:  # посмертная публикация: берём дату написания из комментария
            y, src = w.get("year_written"), "датируется" if w.get("year_written") else None
        if y is None and w.get("year_written"):
            y, src = w["year_written"], "датируется"
        lo, hi = VOL_RANGE.get(w["vol"], (1875, 1904))
        if y is None:  # тома расположены по времени написания: год ближайшего датированного соседа
            y, src = min(max(prev_year.get(w["vol"], lo), lo), hi), "оценка по тому"
        w["year_final"], w["year_how"] = y, src
        if src in ("впервые", "датируется"):
            prev_year[w["vol"]] = y
        w["sig_family"], w["sig_clean"] = sig_family(w)
        w["words"] = sum(len(re.findall(r"[А-Яа-яЁёA-Za-z]+", b["t"])) for b in w["blocks"])

    # --- дубли и редакции среди художественных текстов (канон 2.4)
    cand = [w for w in works if w["role"] in ("story", "play", "redaction", "juvenilia", "article")]
    sh = {w["id"]: shingles(" ".join(b["t"] for b in w["blocks"])) for w in cand}
    inv = defaultdict(list)
    for wid, s in sh.items():
        for x in s:
            inv[x].append(wid)
    pair = Counter()
    for ids in inv.values():
        if 1 < len(ids) < 6:
            for i in range(len(ids)):
                for j in range(i + 1, len(ids)):
                    pair[(ids[i], ids[j])] += 1
    dups = []
    byid = {w["id"]: w for w in works}
    for (a, b), n in pair.items():
        sa, sb = len(sh[a]), len(sh[b])
        small = n / max(1, min(sa, sb))
        jac = n / max(1, sa + sb - n)
        if small >= 0.5:
            dups.append({"a": a, "b": b, "ta": byid[a]["title"], "tb": byid[b]["title"], "va": byid[a]["vol"],
                         "vb": byid[b]["vol"], "jaccard": round(jac, 3), "share_small": round(small, 3)})
    DUP_ROLE = {}
    # сборка-хаб: текст, которому принадлежат ≥ 3 других (≥ 0,5 шинглов меньшего), — авторская сборка
    # из уже напечатанного («Из записной книжки Ивана Иваныча»); исключается сборка, а не оригиналы
    hub = Counter()
    for d in dups:
        a, b = byid[d["a"]], byid[d["b"]]
        hub[(a if a["words"] > b["words"] else b)["id"]] += 1
    hubs = {k for k, v in hub.items() if v >= 3}
    for h in hubs:
        DUP_ROLE[h] = f"сборка из {hub[h]} ранее напечатанных текстов"
    for d in dups:
        a, b = byid[d["a"]], byid[d["b"]]
        if {a["role"], b["role"]} & {"redaction"} or {a["id"], b["id"]} & hubs:
            continue
        if d["share_small"] >= 0.9 or d["jaccard"] >= 0.9:
            # оставить текст с метаданными первой публикации, иначе больший
            keep = max((a, b), key=lambda w: (w["year_how"] == "впервые", w["words"]))
            drop = b if keep is a else a
            DUP_ROLE[drop["id"]] = f"дубль «{keep['title']}» (т. {keep['vol']})"
    for wid, note in DUP_ROLE.items():
        if byid[wid]["role"] in ("story", "play", "juvenilia", "article"):
            byid[wid]["role_dup"] = note
            byid[wid]["role"], byid[wid]["role_note"] = "excluded", note

    # --- письма
    for r in letters:
        r["to_key"] = addr_key(r["to_label"])
        r["to_nom"] = dative_to_nom(r["to_key"])
        r["family"] = FAMILY.get(r["to_key"])
        r["year"], r["month"], r["day"], r["exact"] = parse_date(r["date_label"])
        r["place_n"] = norm_place(r.get("place"), r.get("dateline"))
        body = " ".join(b["t"] for b in r["blocks"][r.get("body_from", 2):])
        lat = len(re.findall(r"[A-Za-z]", body))
        cyr = len(re.findall(r"[А-Яа-яЁё]", body))
        r["lang"] = "ru" if cyr >= lat else ("fr/de/en" if lat else "?")
        r["words"] = len(re.findall(r"[А-Яа-яЁёA-Za-z]+", body))
        r["uid"] = f"L{r['vol']}_{r.get('num') or 'x'}_{hashlib.md5(r['label'].encode()).hexdigest()[:5]}"

    # --- запись
    with open(OUT / "works.jsonl", "w", encoding="utf-8") as fh:
        for w in works:
            fh.write(json.dumps(w, ensure_ascii=False) + "\n")
    with open(OUT / "letters.jsonl", "w", encoding="utf-8") as fh:
        for r in letters:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    cols = ["id", "vol", "section", "title", "role", "role_note", "role_dup", "unfinished", "year_final", "year_how",
            "outlet", "sig_family", "sig_clean", "words"]
    with open(OUT / "manifest.csv", "w", encoding="utf-8", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(cols)
        for w in works:
            wr.writerow([w.get(c, "") for c in cols])
    lcols = ["uid", "vol", "num", "to_key", "to_nom", "family", "date_label", "year", "month", "day", "exact",
             "place_n", "lang", "words"]
    with open(OUT / "letters.csv", "w", encoding="utf-8", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(lcols)
        for r in letters:
            wr.writerow([r.get(c, "") for c in lcols])
    log = {"roles": Counter(w["role"] for w in works), "role_words": {}, "dups": dups,
           "excluded": Counter(w["role_note"] for w in works if w["role"] == "excluded"),
           "sig_family": Counter(w["sig_family"] for w in works if w["role"] == "story"),
           "letters": len(letters), "other": Counter(r["role"] for r in other),
           "letter_lang": Counter(r["lang"] for r in letters),
           "addressees": len({r["to_key"] for r in letters}),
           "places": Counter(r["place_n"] for r in letters).most_common(60),
           "year_how": Counter(w["year_how"] for w in works if w["role"] in ("story", "play"))}
    for w in works:
        log["role_words"][w["role"]] = log["role_words"].get(w["role"], 0) + w["words"]
    log["letter_words"] = sum(r["words"] for r in letters)
    (OUT / "manifest_log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(json.dumps({k: v for k, v in log.items() if k not in ("dups", "places")}, ensure_ascii=False, indent=1, default=str))
    if qa:
        print("\n=== дубли/редакции (доля общих шинглов меньшего ≥ 0,5):")
        for d in sorted(dups, key=lambda d: -d["share_small"]):
            print(f"   {d['share_small']:.2f} J={d['jaccard']:.2f}  т.{d['va']} «{d['ta']}» ↔ т.{d['vb']} «{d['tb']}»")
        print("\n=== помечены как дубль:", {byid[k]["title"]: v for k, v in DUP_ROLE.items()})
        print("\n=== места:", log["places"])
        print("\n=== адресаты (топ-40, именительный):")
        c = Counter((r["to_key"], r["to_nom"]) for r in letters)
        for (k, n), v in c.most_common(40):
            print(f"   {v:4d}  {k:40s} → {n}")
        print("\n=== годы писем:", sorted(Counter(r["year"] for r in letters).items(), key=lambda x: (x[0] is None, x[0])))
        print("\n=== годы рассказов:", sorted(Counter(w["year_final"] for w in works if w["role"] == "story").items()))
        print("\n=== оценочные годы:", [(w["vol"], w["title"][:30], w["year_final"]) for w in works
                                       if w["year_how"] == "оценка по тому" and w["role"] in ("story", "play")])


if __name__ == "__main__":
    main(qa="--qa" in sys.argv)
