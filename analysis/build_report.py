"""Собирает самодостаточный HTML «Чехов на просвет»: оформление серии (report.head.html), разметка (report.body.html),
данные (stats.json), ядро графиков (report.lib.js), отчёт (report.app.js), навигация (report.chrome.js).
Запуск: python build_report.py [out.html]"""
import sys
from pathlib import Path

HERE = Path(__file__).parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "docs" / "prosvet.html"
safe = lambda s: s.replace("</", "<\\/")
r = lambda n: (HERE / n).read_text(encoding="utf-8")
page = (r("report.head.html") + "\n" + r("report.body.html") + "\n"
        + '<script type="application/json" id="data-stats">' + safe(r("stats.json")) + "</script>\n"
        + "<script>\nconst D = JSON.parse(document.getElementById('data-stats').textContent);\n"
        + r("report.lib.js") + "\n" + r("report.app.js") + "\n" + r("report.chrome.js") + "\n</script>\n")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding="utf-8")
print(out, round(out.stat().st_size / 1024), "KB")
