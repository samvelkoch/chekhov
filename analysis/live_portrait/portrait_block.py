"""Блоки «живого портрета» Чехова: портрет на первом экране и карточка биографии в «Хронологии».

build_report.py подставляет их в report.body.html вместо {{PORTRAIT}}, {{PORTRAIT_JS}}, {{BIO_CARD}}.
Читает только то, что лежит в репозитории:
  signature.svg  — подпись (Wikimedia Commons, public domain; заливка currentColor);
  bio.json       — биография, строка дат и строка источника (из naprosvet/chekhov-live/bio, обновляется `sync_assets.py bio`);
  final/         — финальный постер и ролик (кладёт `sync_assets.py final`).
Стили — в report.head.html (правила .lp*, .bio*), поведение — portrait.js.

Без final/ сборка падает: заглушки молча не подставляются.
"""
import base64
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
FINAL = HERE / "final"
KICKER, TITLE = "Коротко об авторе", "Антон Чехов"
BIO = json.load(open(HERE / "bio.json", encoding="utf-8"))["bio"]


def _check_final():
    need = ["portrait.mp4", "portrait.webm", "portrait-poster.webp"]
    miss = [n for n in need if not (FINAL / n).is_file() or (FINAL / n).stat().st_size == 0]
    if miss:
        sys.exit(f"ОШИБКА: нет финального ролика, в {FINAL} не хватает: {', '.join(miss)}. "
                 "Выполните `python live_portrait/sync_assets.py final` (читает naprosvet/chekhov-live/video-v2/final/); "
                 "заглушки молча не подставляются.")


def signature_svg():
    svg = (HERE / "signature.svg").read_text(encoding="utf-8")
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    w, h = vb.split()[2:]
    d = re.search(r' d="([^"]+)"', svg).group(1)
    return (f'<svg class="lp-sig" viewBox="{vb}" style="aspect-ratio:{w}/{h}" role="img" aria-label="Подпись Антона Чехова">'
            f'<path fill="currentColor" d="{d}"/></svg>')


def portrait_block():
    _check_final()
    poster = "data:image/webp;base64," + base64.b64encode((FINAL / "portrait-poster.webp").read_bytes()).decode("ascii")
    # ролик лежит в <template>: пока скрипт его не достанет, браузер ничего не качает
    # (при prefers-reduced-motion скрипт его не достаёт, и остаётся только постер)
    video = ('<template id="lp-video"><video class="lp-video" muted playsinline preload="auto" aria-hidden="true" tabindex="-1">'
             '<source src="portrait.webm" type="video/webm; codecs=vp9"><source src="portrait.mp4" type="video/mp4">'
             '</video></template>')
    return f'''<aside class="hero-portrait">
        <figure class="lp" id="lp">
          <div class="lp-sheet"><div class="lp-art"><img class="lp-poster" src="{poster}" width="640" height="640" alt="Антон Чехов с таксой, портрет, рисунок">{video}</div></div>
        </figure>
        {signature_svg()}
        <p class="lp-dates">{html.escape(BIO["dates_line"], quote=False)}</p>
      </aside>'''


def portrait_js():
    return "<script>\n" + (HERE / "portrait.js").read_text(encoding="utf-8") + "</script>"


def bio_card():
    paras = "\n".join(f"    <p>{html.escape(t, quote=False)}</p>" for t in BIO["paragraphs"])
    return f'''<aside class="bio" aria-labelledby="bio-t">
    <div class="bio-k">{KICKER}</div>
    <h3 class="bio-t" id="bio-t">{TITLE}</h3>
{paras}
    <p class="bio-src">{html.escape(BIO["credits"][0], quote=False)}</p>
  </aside>'''
