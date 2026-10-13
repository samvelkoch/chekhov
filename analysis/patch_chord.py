"""Сеть имён («Персонажи», «Круг Чехова», «Круг Гари») → хордовая диаграмма.

Правит исходник отчёта и/или собранную страницу naprosvet: вставляет chordNet() (chord_net.js рядом),
заменяет drawNet() и отрисовку в ntApply()/ppApply(), переписывает пояснения. Повторный запуск ничего не меняет.

    python patch_chord.py chekhov analysis/report.ui.js ../naprosvet/chekhov/index.html
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHORD = (HERE / "chord_net.js").read_text(encoding="utf-8")

CFG = {
    "chekhov": dict(S="NT", NODES="NN", EDGES="NE", CNT="ntCount", APPLY="ntApply", CARD="ntCard",
                    PICK="if(NT.sel!=null&&matchMedia('(max-width:999px)').matches) nearScroll($('#pp-card'));"),
    "gary": dict(S="NT", NODES="NN", EDGES="NE", CNT="ntCount", APPLY="ntApply", CARD="ntCard",
                 PICK="if(NT.sel!=null&&matchMedia('(max-width:999px)').matches) nearScroll($('#pp-card'));"),
    "brodsky": dict(S="PP", NODES="PN", EDGES="PPL.edges", CNT="ppCount", APPLY="ppApply", CARD="ppCard", PICK=""),
}

TEXT = {
    "chekhov": [
        ("Размер кружка — в скольких письмах назван человек; линия — два имени названы в одном абзаце письма; цвет — круг имён, которые чаще встречаются вместе.",
         "Имена стоят по кругу, цвет — круг имён, которые чаще встречаются вместе. Лента между двумя именами значит, что они названы в одном абзаце письма; чем шире лента, тем чаще. Длина дуги — сколько у имени таких общих абзацев."),
        ("Нажмите на кружок в сети или найдите человека по имени. Размер кружка — в скольких письмах он назван; цвет — круг имён, которые чаще встречаются вместе; линии — имена из одного абзаца.",
         "Нажмите на имя на круге или найдите человека по имени. Цвет — круг имён, которые чаще встречаются вместе; ленты — имена из одного абзаца, чем шире, тем чаще."),
    ],
    "gary": [
        ("Размер кружка — в скольких книгах назван человек; линия — два имени встречаются в одном абзаце; цвет — круг имён, которые чаще стоят рядом.",
         "Имена стоят по кругу, цвет — круг имён, которые чаще стоят рядом. Лента между двумя именами значит, что они встречаются в одном абзаце; чем шире лента, тем чаще. Длина дуги — сколько у имени таких общих абзацев."),
        ("Нажмите на кружок в сети или найдите человека по имени.", "Нажмите на имя на круге или найдите человека по имени."),
    ],
    "brodsky": [
        ("Нажмите на кружок в сети или найдите человека по имени. Размер кружка — в скольких текстах он назван. Цвет — круг имён, которые чаще встречаются вместе. Линии — общая строфа или абзац.",
         "Нажмите на имя на круге или найдите человека по имени. Цвет — круг имён, которые чаще встречаются вместе. Ленты — общая строфа или абзац: чем шире лента, тем чаще. Длина дуги — сколько у имени таких общих мест."),
        ("Линия между двумя именами значит, что они названы в одной строфе или в одном абзаце.",
         "Имена стоят по кругу. Лента между двумя именами значит, что они названы в одной строфе или в одном абзаце; чем шире лента, тем чаще."),
    ],
}


def block_end(s, i):
    """Конец функции, начатой в позиции i: первая строка '}' в начале строки."""
    j = s.index("\n}\n", i)
    return j + 3


def patch(src, who):
    c = CFG[who]
    S, NODES, EDGES, CNT, APPLY = c["S"], c["NODES"], c["EDGES"], c["CNT"], c["APPLY"]
    if "function chordNet(" not in src and "function drawNet(){" in src:
        i = src.index("function drawNet(){")
        # подсказка для кружка — из старого кода, с той же формулировкой
        m = re.search(r"o\.c\.setAttribute\('data-tip',(`.*?`)\); \}\);", src[i:], re.S)
        tip = m.group(1).replace("o.n.", f"{NODES}[i].").replace("o.n)", f"{NODES}[i])").replace("cnt[i]", f"{CNT}({NODES}[i])")
        new_draw = (f"function drawNet(){{\n"
                    f"  {S}.N=chordNet($('#c-net'),{NODES},{EDGES},{{pick:i=>{{ {S}.sel=(i==null||{S}.sel===i)?null:i; {APPLY}(); {c['PICK']} }},hover:i=>{{ {S}.hov=i; {APPLY}(); }}}});\n"
                    f"  {APPLY}();\n}}\n")
        j = block_end(src, i)
        src = src[:i] + CHORD.rstrip() + "\n" + new_draw + src[j:]
        k = src.index(f"function {APPLY}(){{")
        a = src.index(f"  if({S}.N){{", k)
        b = src.index(f"  {c['CARD']}();", a)
        on = f"i=>{CNT}({NODES}[i])>0&&({S}.cl<0||{NODES}[i].cl==={S}.cl)"
        body = (f"  if({S}.N){{ const foc={S}.hov!=null?{S}.hov:{S}.sel;\n"
                f"    {S}.N.apply({{foc,sel:{S}.sel,on:{on},tip:i=>{tip}}}); }}\n")
        src = src[:a] + body + src[b:]
    for old, new in TEXT[who]:
        src = src.replace(old, new)
    return src


if __name__ == "__main__":
    who, *files = sys.argv[1:]
    for f in files:
        p = Path(f)
        s = p.read_text(encoding="utf-8")
        t = patch(s, who)
        if t != s:
            p.write_text(t, encoding="utf-8")
        print(p, "изменён" if t != s else "без изменений")
