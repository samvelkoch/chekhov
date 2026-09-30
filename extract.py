"""Шаг 1. Извлечение текстов из ПСС Чехова в 30 томах (изд. «Наука», 1974–1983).

Источники (вне репозитория):
  • тома 1–18 (сочинения) — папка заказчика /Users/samvel/chekhov/corpus;
  • тома 19–30 (письма) — составной EPUB «Все 4494 письма Чехова из ПСС» (~/projects/Чехов):
    в папке corpus из писем есть только 20–26, 29, 30; составной файл закрывает 19, 27, 28.
    Тома писем из corpus используются для сверки (--qa).

Выход (локально, в .gitignore): corpus/works.jsonl, corpus/letters.jsonl, corpus/other.jsonl,
corpus/pseudonyms.txt, corpus/extract_log.json.
Запуск: python extract.py [--qa]
"""
import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

from epubflat import books

HERE = Path(__file__).parent
SRC_WORKS = Path("/Users/samvel/chekhov/corpus")
SRC_LETTERS = Path("/Users/samvel/projects/Чехов/Chehov_Vse-4494-pisma-Chehova-iz-PSS.703532.epub")
OUT = HERE / "corpus"

SERVICE = re.compile(r"^(Антон Павлович Чехов Полное|Том \d|От редакции|Комментарии|Прижизненные переводы|Иллюстрации|"
                     r"Выходные данные|Примечания|Список книг|Указатель|\d+$)")
SECTION = re.compile(r"^(Рассказы|Повести|Пьесы|Неопубликованное|Неоконченное|Статьи|Гимназическое|Dubia|Коллективное|"
                     r"Приложени|Дневниковые записи)")
DATED = re.compile(r"^(.+?),\s*((?:[^,]*?\b)?(?:1[89]\d\d)\b.*)$")


def clean_title(s):
    return re.sub(r"\s+", " ", re.sub(r"\[\d+\]|\*+$", "", s.replace("*", ""))).strip()


def vol_no(path):
    return int(re.search(r"_tomah_(\d+)", path).group(1))


def parse_first(note):
    """Первая строка комментария: год первой публикации, издание, подпись."""
    note = re.sub(r"\s+", " ", note or "")
    r = {"note": note, "year": None, "outlet": None, "signature": None, "year_src": None}
    m = re.search(r"Впервые(?:\s+опубликовано)?\s*(?:[—:-]|\b)\s*(.*)", note)
    if m:
        rest = m.group(1)
        o = re.match(r"«([^»]+)»", rest)
        r["outlet"] = o.group(1) if o else None
        y = re.search(r"\b(18[6-9]\d|190\d|19[1-9]\d)\b", rest)
        if y:
            r["year"], r["year_src"] = int(y.group(1)), "впервые"
    if r["year"] is None:
        y = re.search(r"(?:Датируется|Написано|датируется)[^.]*?\b(18[6-9]\d|190[0-4])\b", note)
        if y:
            r["year"], r["year_src"] = int(y.group(1)), "датируется"
    s = re.search(r"Подпись:\s*(.+)", note)
    if s:
        sig = re.split(r"\.\s+(?=[А-ЯЁ][а-яё]+\s+[а-яё«(])|;\s", s.group(1))[0]
        r["signature"] = sig.strip().rstrip(".").strip()
    return r


def comment_text(b, href, limit=40):
    """Полный комментарий к произведению: от якоря ссылки-звёздочки до следующего заглавия (h5 не из цифр)."""
    frag = href.partition("#")[2]
    i = b.anchor.get(frag)
    if i is None:
        return ""
    out = []
    for bl in b.blocks[i:i + limit]:
        if out and bl["tag"] == "h5" and not re.fullmatch(r"\d+", bl["t"]):
            break
        out.append(bl["t"])
    return "\n".join(out)


def extract_works():
    recs, log = [], []
    files = sorted(glob.glob(str(SRC_WORKS / "*.epub")), key=vol_no)
    for f in files:
        v = vol_no(f)
        if v >= 19:
            continue
        b = books(f)[0]
        toc = b.toc
        # родитель каждого пункта — ближайший выше с меньшей глубиной
        parents, stack = [], []
        for it in toc:
            while stack and stack[-1]["depth"] >= it["depth"]:
                stack.pop()
            parents.append(list(stack))
            stack.append(it)
        is_work = [False] * len(toc)
        for i, it in enumerate(toc):
            lab = it["label"]
            if it["start"] is None or SERVICE.match(lab) or SECTION.match(lab):
                continue
            anc = parents[i]
            if any(SERVICE.match(a["label"]) for a in anc):
                continue
            if any(is_work[toc.index(a)] for a in anc):
                continue  # действие пьесы, глава «Сахалина» — часть произведения
            is_work[i] = True
            sec = next((a["label"] for a in reversed(anc) if SECTION.match(a["label"])), "")
            blocks = b.blocks[it["start"]:it["end"]]
            notes = [(n, h) for bl in blocks[:3] for n, h in zip(bl["notes"], bl.get("hrefs", []))
                     if "Впервые" in n or "Подпись" in n or "Печатается" in n]
            meta = parse_first(notes[0][0] if notes else "")
            meta["comment"] = comment_text(b, notes[0][1]) if notes else ""
            if meta["year"] is None or meta["year"] > 1904:
                y = re.search(r"(?:Датируется|датируется|Написан[аоы]?|написан[аоы]?|Относится к|относится к)"
                              r"[^.]{0,120}?\b(18[7-9]\d|190[0-4])\b", meta["comment"])
                if y:
                    meta["year_written"] = int(y.group(1))
            recs.append({"id": f"v{v:02d}_{len(recs):04d}", "vol": v, "section": sec, "title": clean_title(lab),
                         "children": [clean_title(toc[j]["label"]) for j in range(i + 1, len(toc))
                                      if it in parents[j] and parents[j][-1] is it],
                         **meta, "blocks": blocks})
        log.append({"vol": v, "title": b.title, "works": sum(is_work), "blocks": len(b.blocks)})
    return recs, log


def extract_letters():
    letters, other, log, pseud = [], [], [], ""
    for bi, b in enumerate(books(str(SRC_LETTERS))[:12]):
        v = 19 + bi
        section = None
        n0 = len(letters)
        for it in b.toc:
            lab = it["label"]
            if it["depth"] == 1:
                section = lab
            if lab.startswith("Псевдонимы Чехова"):
                pseud = "\n".join(bl["t"] for bl in b.blocks[it["start"]:it["end"]])
            m = DATED.match(lab)
            if not m or it["depth"] < 2 or it["start"] is None:
                continue
            if section.startswith("Письма"):
                role = "letter"
            elif section.startswith("Дарственные"):
                role = "inscr"
            elif section.startswith("Официальные"):
                role = "doc"
            else:
                continue
            blocks = b.blocks[it["start"]:it["end_leaf"]]
            rec = {"vol": v, "role": role, "label": clean_title(lab), "to_label": clean_title(m.group(1)),
                   "date_label": clean_title(m.group(2)), "blocks": blocks}
            # «218. М. В. КИСЕЛЕВОЙ» и «14 января 1887 г. Москва.»
            # номер бывает «1727а», «2778–2779», «3017» без точки; иногда номера нет, а строка даты
            # слита с заголовком («2804а. О. И. ЧЕРЕПОВОЙ-ОРЛОВСКОЙ 24 июня 1899 г. Москва.»)
            for k, bl in enumerate(blocks[1:4], start=1):
                t = bl["t"]
                # заголовок — строка со словом из заглавных (КИСЕЛЕВОЙ, РЕДАКЦИЮ); строка даты таких слов не имеет
                is_head = re.search(r"\b[А-ЯЁ]{3,}\b", t)
                h = re.match(r"^(\d+)[а-я]?(?:[–-]\d+)?\.?\s+(.+)$", t) if is_head else None
                date_only = re.match(r"^.*\b1[89]\d\d\s*г\.", t)
                if is_head:
                    rec["num"] = int(h.group(1)) if h else None
                    rest = h.group(2) if h else t
                    sp = re.match(r"^(.*?[А-ЯЁ»)])\s+((?:\d|[А-ЯЁ][а-яё]).*\b1[89]\d\d\s*г\..*)$", rest)
                    if sp:
                        rec["to_caps"], dl, nxt = sp.group(1), sp.group(2), k + 1
                    else:
                        rec["to_caps"] = rest
                        dl, nxt = (blocks[k + 1]["t"], k + 2) if k + 1 < len(blocks) else ("", k + 1)
                    break
                if date_only:  # заголовка нет, сразу дата
                    rec["num"], rec["to_caps"], dl, nxt = None, None, t, k + 1
                    break
            else:
                dl, nxt = "", 1
            dm = re.match(r"^(.*?\b1[89]\d\d)\s*г\.?\s*(.*)$", dl)
            rec["dateline"] = dl
            place = dm.group(2) if dm else ""
            place = re.sub(r"^\s*\([^)]*\)\s*|^[,\s]+|^\(\?\)\s*", "", place).strip().rstrip(".").strip()
            rec["place"] = place or None
            rec["body_from"] = nxt
            (letters if role == "letter" else other).append(rec)
        log.append({"vol": v, "title": b.title, "letters": len(letters) - n0, "blocks": len(b.blocks)})
    return letters, other, log, pseud


def main(qa=False):
    OUT.mkdir(exist_ok=True)
    works, wlog = extract_works()
    letters, other, llog, pseud = extract_letters()
    for name, rows in (("works", works), ("letters", letters), ("other", other)):
        with open(OUT / f"{name}.jsonl", "w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    (OUT / "pseudonyms.txt").write_text(pseud, encoding="utf-8")
    nums = [r.get("num") for r in letters if r.get("num")]
    c = Counter(nums)
    log = {"works": wlog, "letters": llog, "n_works": len(works), "n_letters": len(letters),
           "n_other": dict(Counter(r["role"] for r in other)),
           "letter_nums": {"with_num": len(nums), "unique": len(c), "max": max(nums) if nums else None,
                           "dups": sorted(k for k, v in c.items() if v > 1)[:50],
                           "missing": sorted(set(range(1, max(nums) + 1)) - set(nums))[:200] if nums else []},
           "no_num": [r["label"] for r in letters if not r.get("num")][:50],
           "no_place": [r["label"] + " | " + r["dateline"] for r in letters if not r.get("place")][:60]}
    (OUT / "extract_log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in log.items() if k not in ("works", "letters")}, ensure_ascii=False, indent=1)[:3000])
    for w in wlog:
        print(w)
    for l in llog:
        print(l)
    if qa:
        qa_report(works, letters)


def qa_report(works, letters):
    print("\n=== произведения без года:", sum(1 for w in works if not w["year"]))
    for w in works:
        if not w["year"]:
            print("   ", w["vol"], w["section"][:20], "|", w["title"][:50], "|", w["note"][:90])
    print("\n=== подписи в печати:", Counter(w["signature"] for w in works).most_common(60))
    print("\n=== места писем:", Counter(r.get("place") for r in letters).most_common(40))


if __name__ == "__main__":
    main(qa="--qa" in sys.argv)
