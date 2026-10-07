"""Страница сайта naprosvet-site/chekhov/index.html: сборка отчёта (docs/prosvet.html) в обёртке сайта.

Обёртка (theme.js, favicon, OG-теги, Яндекс.Метрика — всё до «</head><body>») берётся из уже опубликованного
index.html, чтобы не расходиться с сайтом. docs/prosvet.html — это сам результат build_report.py, без обёртки.
На сайте нет строки @media (hover:none)…: её даёт theme.js.

    python wrap_site.py                       # docs/prosvet.html -> ../../naprosvet-site/chekhov/index.html
    python wrap_site.py --build X --site Y    # свои пути (например, для проверки в песочнице)
    python wrap_site.py --check               # только сверить с уже лежащей страницей сайта, ничего не писать
"""
import argparse
from pathlib import Path

HERE = Path(__file__).parent
CUT = "</head><body>"
HOVER = "@media (hover:none) and (pointer:coarse){input[type=search],input[type=text],select,textarea{font-size:16px!important}}\n"


def wrap_site(build, old_site):
    assert build.count(HOVER) == 1, "в сборке должна быть ровно одна строка @media (hover:none)…"
    return old_site[:old_site.index(CUT) + len(CUT)] + "\n" + build.replace(HOVER, "", 1) + "\n</body></html>"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--build", default=str(HERE.parent / "docs" / "prosvet.html"))
    ap.add_argument("--site", default=str(HERE.parent.parent / "naprosvet-site" / "chekhov" / "index.html"))
    ap.add_argument("--prefix", help="файл, из которого берётся обёртка (по умолчанию — сам --site)")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    new = wrap_site(Path(a.build).read_text(encoding="utf-8"), Path(a.prefix or a.site).read_text(encoding="utf-8"))
    if a.check:
        same = new == Path(a.site).read_text(encoding="utf-8")
        print("сайт совпадает:", same)
        raise SystemExit(0 if same else 1)
    Path(a.site).parent.mkdir(parents=True, exist_ok=True)
    Path(a.site).write_text(new, encoding="utf-8")
    print(a.site, round(len(new.encode("utf-8")) / 1024), "KB")


if __name__ == "__main__":
    main()
