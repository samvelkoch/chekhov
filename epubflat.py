"""EPUB → поток абзацев с якорями и оглавлением (NCX).

Абзац (block): текст, тег, класс, отрезки курсива (em) и полужирного (strong), якоря id внутри,
атрибуты title у ссылок (в ПСС Чехова там первая строка комментария: «Впервые — …, 1884 … Подпись: …»).
Сноски <sup>…</sup> выкидываются. Составной EPUB (несколько книг в одном zip) читается по префиксу.
"""
import re
import zipfile
from html.parser import HTMLParser

BLOCK = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote", "table", "body"}
SKIP = {"sup", "script", "style", "head", "title"}
HEAD = {"h1", "h2", "h3", "h4", "h5", "h6"}


class _Flat(HTMLParser):
    def __init__(self, fname):
        super().__init__(convert_charrefs=True)
        self.blocks, self.buf, self.em, self.st = [], [], [], []
        self.skip = self.emd = self.std = 0
        self.stack = []  # открытые блочные теги: (tag, class)
        self.pending_ids = ["FILE:" + fname]
        self.cur_ids, self.cur_notes, self.cur_hrefs = [], [], []
        self._em0 = self._st0 = None

    # --- служебное
    def _len(self):
        return sum(len(s) for s in self.buf)

    def flush(self):
        raw = "".join(self.buf)
        if raw.strip() or self.cur_ids:
            tag, cls = self.stack[-1] if self.stack else ("p", "")
            # нормализация пробелов со сдвигом отрезков
            text, spans_e, spans_s = _norm(raw, self.em, self.st)
            if text or self.cur_ids:
                self.blocks.append({"t": text, "tag": tag, "cls": cls, "ids": self.pending_ids + self.cur_ids,
                                    "em": spans_e, "st": spans_s, "notes": self.cur_notes,
                                    "hrefs": self.cur_hrefs})
                self.pending_ids = []
        self.buf, self.em, self.st, self.cur_ids, self.cur_notes, self.cur_hrefs = [], [], [], [], [], []
        self._em0 = self._len() if self.emd else None
        self._st0 = self._len() if self.std else None

    # --- разбор
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP:
            self.skip += 1
            return
        if "id" in a:
            (self.cur_ids if self.buf and "".join(self.buf).strip() else self.pending_ids).append(a["id"])
        if tag == "a" and a.get("title"):
            self.cur_notes.append(a["title"])
            self.cur_hrefs.append(a.get("href", ""))
        if tag in BLOCK:
            self.flush()
            self.stack.append((tag, a.get("class", "")))
        elif tag == "br":
            self.buf.append("\n")
        elif tag in ("em", "i"):
            if not self.emd:
                self._em0 = self._len()
            self.emd += 1
        elif tag in ("strong", "b"):
            if not self.std:
                self._st0 = self._len()
            self.std += 1

    def handle_startendtag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            (self.cur_ids if self.buf and "".join(self.buf).strip() else self.pending_ids).append(a["id"])
        if tag == "br" and not self.skip:
            self.buf.append("\n")
        elif tag in BLOCK:
            self.flush()

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip = max(0, self.skip - 1)
            return
        if tag in BLOCK:
            self.flush()
            if self.stack:
                self.stack.pop()
        elif tag in ("em", "i") and self.emd:
            self.emd -= 1
            if not self.emd and self._em0 is not None:
                self.em.append((self._em0, self._len()))
        elif tag in ("strong", "b") and self.std:
            self.std -= 1
            if not self.std and self._st0 is not None:
                self.st.append((self._st0, self._len()))

    def handle_data(self, data):
        if self.skip:
            return
        self.buf.append(data.replace("\n", " "))


def _norm(raw, em, st):
    """Схлопывает пробелы и переносит отрезки em/strong на новые позиции."""
    out, pos_map, prev_space = [], [], True
    for ch in raw:
        pos_map.append(len(out))
        if ch in " \t\r  ​" or ch == "\n":
            if not prev_space:
                out.append(" ")
            prev_space = True
        else:
            out.append(ch)
            prev_space = False
    pos_map.append(len(out))
    text = "".join(out)
    lead = len(text) - len(text.lstrip())
    text2 = text.strip()

    def conv(spans):
        res = []
        for a, b in spans:
            a2, b2 = pos_map[min(a, len(raw))] - lead, pos_map[min(b, len(raw))] - lead
            a2, b2 = max(0, a2), min(len(text2), b2)
            if b2 > a2 and text2[a2:b2].strip():
                res.append((a2, b2))
        return res

    return text2, conv(em), conv(st)


def _attr(tag_src, name):
    m = re.search(name + r'="([^"]*)"', tag_src)
    return m.group(1) if m else None


class Book:
    """Одна книга внутри zip (prefix — путь к OPF-папке для составного EPUB)."""

    def __init__(self, zf: zipfile.ZipFile, opf_path: str):
        self.z = zf
        self.base = opf_path.rsplit("/", 1)[0] + "/" if "/" in opf_path else ""
        opf = zf.read(opf_path).decode("utf-8", "replace")
        self.title = re.sub(r"\s+", " ", (re.search(r"<dc:title>(.*?)</dc:title>", opf, re.S) or [None, ""])[1]).strip()
        man, ncx = {}, None
        for m in re.finditer(r"<item\b[^>]*>", opf):
            s = m.group(0)
            man[_attr(s, "id")] = _attr(s, "href")
            if "dtbncx" in (_attr(s, "media-type") or ""):
                ncx = _attr(s, "href")
        self.spine = [man[x] for x in re.findall(r'<itemref\b[^>]*idref="([^"]+)"', opf) if x in man]
        self.blocks = []
        for h in self.spine:
            if not h.endswith(("html", "htm")):
                continue
            src = zf.read(self.base + h).decode("utf-8", "replace")
            p = _Flat(h)
            p.feed(src)
            p.flush()
            self.blocks.extend(p.blocks)
        self.anchor = {}
        for i, b in enumerate(self.blocks):
            for a in b["ids"]:
                self.anchor.setdefault(a, i)
        self.toc = self._toc(zf.read(self.base + ncx).decode("utf-8", "replace")) if ncx else []

    def _toc(self, ncx):
        items, depth = [], 0
        for m in re.finditer(r"<navPoint\b|</navPoint>|<text>(.*?)</text>|<content\b[^>]*src=\"([^\"]+)\"", ncx, re.S):
            s = m.group(0)
            if s.startswith("<navPoint"):
                depth += 1
                items.append({"depth": depth, "label": "", "src": None})
            elif s == "</navPoint>":
                depth -= 1
            elif m.group(1) is not None and items and not items[-1]["label"]:
                import html as _h
                items[-1]["label"] = re.sub(r"\s+", " ", _h.unescape(m.group(1))).strip()
            elif m.group(2) and items and items[-1]["src"] is None:
                items[-1]["src"] = m.group(2)
        for it in items:
            f, _, frag = (it["src"] or "").partition("#")
            it["start"] = self.anchor.get(frag) if frag else self.anchor.get("FILE:" + f)
            if it["start"] is None:
                it["start"] = self.anchor.get("FILE:" + f)
        # конец — начало следующего пункта оглавления любого уровня
        starts = sorted({it["start"] for it in items if it["start"] is not None})
        for it in items:
            s = it["start"]
            nxt = [x for x in starts if s is not None and x > s]
            it["end_leaf"] = nxt[0] if nxt else len(self.blocks)
        # конец поддерева — следующий пункт того же или более высокого уровня
        for i, it in enumerate(items):
            end = len(self.blocks)
            for j in range(i + 1, len(items)):
                if items[j]["depth"] <= it["depth"] and items[j]["start"] is not None:
                    end = items[j]["start"]
                    break
            it["end"] = end
        return items


def books(path):
    """Все книги файла: для обычного EPUB — одна, для составного — по каждому OPF."""
    z = zipfile.ZipFile(path)
    opfs = sorted([n for n in z.namelist() if n.endswith(".opf")],
                  key=lambda s: [int(x) if x.isdigit() else x for x in re.split(r"(\d+)", s)])
    return [Book(z, o) for o in opfs]
