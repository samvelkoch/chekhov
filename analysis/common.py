"""Общая загрузка корпуса в массивы (numpy) и помощники для всех модулей подсчёта."""
import pickle
import re
from functools import lru_cache
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
KIND_CODES = {"nar": 0, "dlg": 1, "speech": 2, "stage": 3, "cast": 4, "body": 5}


class Corpus:
    def __init__(self, path=HERE / "corpus.pkl"):
        C = pickle.load(open(path, "rb"))
        self.docs = C["docs"]
        self.ptext = C["para_text"]
        P = C["paras"]
        self.p_doc = np.array([p[0] for p in P], dtype=np.int32)
        self.p_kind = np.array([KIND_CODES[p[1]] for p in P], dtype=np.int8)
        self.p_spk = [p[2] for p in P]
        self.p_nw = np.array([p[3] for p in P], dtype=np.int32)
        self.p_sl = [p[4] for p in P]
        self.forms, self.lemmas = C["forms"], C["lemmas"]
        self.f_lemma, self.f_pos = C["f_lemma"], C["f_pos"]
        self.f_name, self.f_geo, self.f_known = C["f_name"], C["f_geo"], C["f_known"]
        self.t_form, self.t_doc, self.t_para = C["t_form"], C["t_doc"], C["t_para"]
        self.t_cap, self.t_sst = C["t_cap"], C["t_sst"]
        self.t_lemma = self.f_lemma[self.t_form]
        self.t_kind = self.p_kind[self.t_para]
        self.d_kind = np.array([d["kind"] for d in self.docs], dtype=object)
        self.d_year = np.array([d.get("year") or 0 for d in self.docs], dtype=np.int32)
        self.t_dkind = self.d_kind[self.t_doc]
        self.t_year = self.d_year[self.t_doc]
        self.lemma_ix = {l: i for i, l in enumerate(self.lemmas)}
        self.form_ix = {f: i for i, f in enumerate(self.forms)}
        # доля написаний с заглавной для каждой леммы (канон 3.5: ≥ 70% и ≥ 2 раз — имя)
        n_all = np.bincount(self.t_lemma, minlength=len(self.lemmas))
        n_cap_mid = np.bincount(self.t_lemma[self.t_cap & ~self.t_sst], minlength=len(self.lemmas))
        n_mid = np.bincount(self.t_lemma[~self.t_sst], minlength=len(self.lemmas))
        self.l_count = n_all
        self.l_capshare = np.where(n_mid > 0, n_cap_mid / np.maximum(n_mid, 1), 0)
        self.l_pos = np.empty(len(self.lemmas), dtype=object)
        # часть речи леммы — самая частая среди её словоформ
        order = np.argsort(self.f_lemma, kind="stable")
        fl = self.f_lemma[order]
        fcount = np.bincount(self.t_form, minlength=len(self.forms))
        best = {}
        for fi in order:
            li = self.f_lemma[fi]
            if li not in best or fcount[fi] > fcount[best[li]]:
                best[li] = fi
        for li, fi in best.items():
            self.l_pos[li] = self.f_pos[fi]
        l_isname = np.zeros(len(self.lemmas), dtype=bool)
        np.logical_or.at(l_isname, self.f_lemma, self.f_name)
        self.l_name = l_isname | ((self.l_capshare >= 0.7) & (n_mid >= 2))
        l_geo = np.zeros(len(self.lemmas), dtype=bool)
        np.logical_or.at(l_geo, self.f_lemma, self.f_geo)
        self.l_geo = l_geo

    # --- выборки
    def docs_of(self, *kinds):
        return np.array([i for i, d in enumerate(self.docs) if d["kind"] in kinds], dtype=np.int32)

    def tok_mask(self, doc_kinds=None, para_kinds=None):
        m = np.ones(len(self.t_form), dtype=bool)
        if doc_kinds is not None:
            m &= np.isin(self.t_dkind, list(doc_kinds))
        if para_kinds is not None:
            m &= np.isin(self.t_kind, [KIND_CODES[k] for k in para_kinds])
        return m

    def lid(self, word):
        """Ключ словаря — тем же лемматизатором, что и токены (канон 4.11)."""
        w = word.lower().replace("ё", "е")
        if w in self.lemma_ix:
            return self.lemma_ix[w]
        return self.lemma_ix.get(lemkey(w))

    def ids(self, words):
        out = []
        for w in words:
            i = self.lid(w)
            if i is not None:
                out.append(i)
        return np.array(sorted(set(out)), dtype=np.int32)


@lru_cache(maxsize=None)
def _morph():
    import pymorphy3
    return pymorphy3.MorphAnalyzer()


def lemkey(w):
    return _morph().parse(w)[0].normal_form.replace("ё", "е")


def plural(n, one, few, many):
    n = abs(int(n))
    m10, m100 = n % 10, n % 100
    if m10 == 1 and m100 != 11:
        return one
    if 2 <= m10 <= 4 and not 12 <= m100 <= 14:
        return few
    return many


def snip(t, i0, i1, width=170):
    """Отрывок вокруг [i0, i1) не длиннее width знаков, по границам слов."""
    half = max(20, (width - (i1 - i0)) // 2)
    a, b = max(0, i0 - half), min(len(t), i1 + half)
    s = t[a:b]
    if a > 0:
        s = "…" + s[s.find(" ") + 1:] if " " in s[:30] else "…" + s
    if b < len(t):
        s = (s[: s.rfind(" ")] if " " in s[-30:] else s) + "…"
    return s


def r1(x):
    return None if x is None else round(float(x), 1)


def r2(x):
    return None if x is None else round(float(x), 2)
