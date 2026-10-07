"""Собирает самодостаточный HTML «Чехов на просвет»: оформление серии (report.head.html), разметка (report.body.html),
данные (stats.json, explore.json), ядро графиков (report.lib.js), отчёт (report.app.js), интерактив (report.ui.js), навигация (report.chrome.js).
Запуск: python build_report.py [out.html]"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "live_portrait"))
import portrait_block as lp   # живой портрет и карточка биографии: live_portrait/ (без final/ сборка падает)

HERE = Path(__file__).parent
out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "docs" / "prosvet.html"
safe = lambda s: s.replace("</", "<\\/")
r = lambda n: (HERE / n).read_text(encoding="utf-8")
body = (r("report.body.html").replace("{{PORTRAIT}}", lp.portrait_block(), 1).replace("{{PORTRAIT_JS}}", lp.portrait_js(), 1)
        .replace("{{BIO_CARD}}", lp.bio_card(), 1))
assert "{{" not in body, "в разметке остались неподставленные места"
page = (r("report.head.html") + "\n" + body + "\n"
        + '<script type="application/json" id="data-stats">' + safe(r("stats.json")) + "</script>\n"
        + '<script type="application/json" id="data-explore">' + safe(r("explore.json")) + "</script>\n"
        + "<script>\nconst D = JSON.parse(document.getElementById('data-stats').textContent);\n"
        + "const EX = JSON.parse(document.getElementById('data-explore').textContent);\n"
        + r("report.lib.js") + "\n" + r("report.app.js") + "\n" + r("report.ui.js") + "\n" + r("report.chrome.js") + "\n</script>\n")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding="utf-8")
print(out, round(out.stat().st_size / 1024), "KB")
