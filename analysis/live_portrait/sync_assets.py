"""Файлы «живого портрета» Чехова: подпись, биография, финальный ролик.

    python sync_assets.py bio       # naprosvet/chekhov-live/{bio,signature} -> bio.json, signature.svg (лежат в репозитории)
    python sync_assets.py final     # naprosvet/chekhov-live/video-v2/final -> final/ (poster.* -> portrait-poster.*) (постер в git, ролик в .gitignore); без полного набора падает
    python sync_assets.py deploy    # final/portrait.{mp4,webm} -> docs/ и naprosvet-site/chekhov/ (рядом со страницами)

Сборка (build_report.py) берёт постер и проверяет ролик только в final/; без него падает.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parent.parent
WORK = REPO.parent
GL = WORK / "naprosvet" / "chekhov-live"
SRC = GL / "video-v2" / "final"
FINAL = HERE / "final"
# имя в источнике -> имя в final/ (у Чехова постер в источнике называется poster.*)
NEED = {"portrait.mp4": "portrait.mp4", "portrait.webm": "portrait.webm", "poster.webp": "portrait-poster.webp", "poster.jpg": "portrait-poster.jpg"}


def die(msg):
    sys.exit("ОШИБКА: " + msg)


def cmd_bio(_):
    shutil.copyfile(GL / "bio" / "bio.json", HERE / "bio.json")
    shutil.copyfile(GL / "signature" / "signature.svg", HERE / "signature.svg")
    print("bio.json:", len(json.load(open(HERE / "bio.json", encoding="utf-8"))["bio"]["paragraphs"]), "абзацев; signature.svg скопирована")


def probe(path):
    ff = shutil.which("ffprobe") or "/opt/anaconda3/bin/ffprobe"
    out = subprocess.run([ff, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height",
                          "-show_entries", "format=duration", "-of", "json", str(path)], capture_output=True, text=True)
    if out.returncode:
        die(f"ffprobe не открыл {path}: {out.stderr.strip()}")
    j = json.loads(out.stdout)
    return {**j["streams"][0], "duration": j["format"]["duration"]}


def cmd_final(_):
    missing = [n for n in NEED if not (SRC / n).is_file() or (SRC / n).stat().st_size == 0]
    if missing:
        die(f"нет финального ролика: в {SRC} не хватает {', '.join(missing)}.")
    mp4, webm = probe(SRC / "portrait.mp4"), probe(SRC / "portrait.webm")
    if mp4["codec_name"] != "h264" or webm["codec_name"] != "vp9":
        die(f"ожидались h264 и vp9, получено {mp4['codec_name']} и {webm['codec_name']}")
    if (mp4["width"], mp4["height"], webm["width"], webm["height"]) != (640, 640, 640, 640):
        die(f"ожидался квадрат 640x640, получено {mp4['width']}x{mp4['height']} и {webm['width']}x{webm['height']}")
    FINAL.mkdir(exist_ok=True)
    for src, dst in NEED.items():
        shutil.copyfile(SRC / src, FINAL / dst)
    print("final/ обновлён:", {d: (FINAL / d).stat().st_size for d in NEED.values()})
    print("mp4", mp4["width"], "x", mp4["height"], mp4["duration"], "с; webm", webm["width"], "x", webm["height"], webm["duration"], "с")


def cmd_deploy(a):
    missing = [n for n in NEED.values() if not (FINAL / n).is_file()]
    if missing:
        die(f"в {FINAL} не хватает {', '.join(missing)}: сначала `sync_assets.py final`")
    for d in (Path(a.docs), Path(a.site)):
        d.mkdir(parents=True, exist_ok=True)
        for n in ("portrait.mp4", "portrait.webm"):
            shutil.copyfile(FINAL / n, d / n)
        print("ролик ->", d)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="c", required=True)
    sp.add_parser("bio").set_defaults(f=cmd_bio)
    sp.add_parser("final").set_defaults(f=cmd_final)
    d = sp.add_parser("deploy"); d.set_defaults(f=cmd_deploy)
    d.add_argument("--docs", default=str(REPO / "docs"))
    d.add_argument("--site", default=str(WORK / "naprosvet-site" / "chekhov"))
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
