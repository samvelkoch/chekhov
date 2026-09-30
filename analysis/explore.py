"""Шаг 4б. Данные для интерактивов (по образцу «Бродского на просвет»): палитра периодов, карта словаря,
сеть людей в письмах («Круг Чехова») с карточками, карточки имён героев, темы.
Алгоритмы t-SNE, rsvd, k-средних и раскладка «островами» — из samvelkoch/brodsky (style.py, world.py).
Выход: analysis/explore.json. Запуск: python explore.py [--qa]"""
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

import rules
import world_lists as WL
from common import Corpus, snip

HERE = Path(__file__).parent
QA = "--qa" in sys.argv
C = Corpus()
D = C.docs
S = json.load(open(HERE / "stats.json", encoding="utf-8"))
PER = rules.PERIODS
OUT = {"periods": [p[0] for p in PER], "period_names": [p[3] for p in PER]}
W_MASK = np.isin(C.t_dkind, ["story", "play"]) & (C.t_kind <= 2)
L_MASK = (C.t_dkind == "letter") & (C.t_kind == 5)
per_of = lambda y: next((i for i, (_, a, b, _) in enumerate(PER) if a <= y <= b), -1)
t_per = np.array([per_of(y) for y in range(0, 1906)])[np.clip(C.t_year, 0, 1905)]
OUT["per_tokens_works"] = [int((W_MASK & (t_per == i)).sum()) for i in range(len(PER))]
OUT["per_tokens_letters"] = [int((L_MASK & (t_per == i)).sum()) for i in range(len(PER))]

# ------------------------------------------------------------------ алгоритмы (из «Бродского»)
def kmeans(X, k, n_init=30, iters=300, seed=42):
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(n_init):
        cen = [X[rng.integers(len(X))]]
        for _ in range(1, k):
            d = np.min(((X[:, None] - np.array(cen)[None]) ** 2).sum(-1), 1)
            cen.append(X[rng.choice(len(X), p=d / d.sum())])
        cen = np.array(cen)
        for _ in range(iters):
            lab = ((X[:, None] - cen[None]) ** 2).sum(-1).argmin(1)
            new = np.array([X[lab == c].mean(0) if (lab == c).any() else cen[c] for c in range(k)])
            if np.allclose(new, cen):
                break
            cen = new
        inertia = ((X - cen[lab]) ** 2).sum()
        if best is None or inertia < best[0]:
            best = (inertia, lab, cen)
    return best[1], best[2]


def rsvd(M, k, it=5, seed=0):
    rng = np.random.default_rng(seed)
    Q = np.linalg.qr(M @ rng.standard_normal((M.shape[1], k + 10)))[0]
    for _ in range(it):
        Q = np.linalg.qr(M @ (M.T @ Q))[0]
    U, Sv, _ = np.linalg.svd(Q.T @ M, full_matrices=False)
    return (Q @ U)[:, :k], Sv[:k]


def tsne(X, perplexity=15, iters=1200, seed=42):
    rng = np.random.default_rng(seed)
    n = len(X)
    Dd = ((X[:, None] - X[None]) ** 2).sum(-1)
    P = np.zeros((n, n))
    target = np.log(perplexity)
    for i in range(n):
        lo, hi, beta = 1e-20, 1e20, 1.0
        di = np.delete(Dd[i], i)
        for _ in range(60):
            pi = np.exp(-di * beta); sp = pi.sum() + 1e-12
            H = np.log(sp) + beta * (di * pi).sum() / sp
            if abs(H - target) < 1e-5:
                break
            if H > target:
                lo = beta; beta = beta * 2 if hi == 1e20 else (beta + hi) / 2
            else:
                hi = beta; beta = (beta + lo) / 2
        P[i, np.arange(n) != i] = pi / sp
    P = (P + P.T) / (2 * n); P = np.maximum(P, 1e-12)
    Y = rng.standard_normal((n, 2)) * 1e-4
    vel, gains = np.zeros_like(Y), np.ones_like(Y)
    for t in range(iters):
        ex = 12.0 if t < 250 else 1.0
        num = 1 / (1 + ((Y[:, None] - Y[None]) ** 2).sum(-1)); np.fill_diagonal(num, 0)
        Q = np.maximum(num / num.sum(), 1e-12)
        G = 4 * (((ex * P - Q) * num)[:, :, None] * (Y[:, None] - Y[None])).sum(1)
        mom = 0.5 if t < 250 else 0.8
        gains = (gains + 0.2) * ((G > 0) != (vel > 0)) + gains * 0.8 * ((G > 0) == (vel > 0))
        gains = np.maximum(gains, 0.01)
        vel = mom * vel - 200 * gains * G
        Y = Y + vel; Y -= Y.mean(0)
    return Y


def island_layout(cl, tx):
    ids = sorted(set(cl.tolist()) - {-1}, key=lambda c: -int((cl == c).sum()))
    size = {c: int((cl == c).sum()) for c in ids}
    rad = {c: 0.11 * np.sqrt(size[c]) + 0.05 for c in ids}
    tot = sum(2 * rad[c] for c in ids); a = 0.3; cen = {}
    R = max(0.62, tot / (2 * np.pi) * 1.08)
    for c in ids:
        wd = 2 * rad[c] / tot * 2 * np.pi
        cen[c] = R * np.array([np.cos(a + wd / 2), np.sin(a + wd / 2)]); a += wd
    P = np.zeros((len(cl), 2)); golden = 2.39996
    for c in ids:
        mem = sorted((i for i in range(len(cl)) if cl[i] == c), key=lambda i: -tx[i])
        sc = rad[c] / np.sqrt(len(mem) + 0.5)
        for r, i in enumerate(mem):
            P[i] = cen[c] + sc * np.sqrt(r + 0.5) * np.array([np.cos(r * golden), np.sin(r * golden)])
    free = [i for i in range(len(cl)) if cl[i] == -1]
    for r, i in enumerate(free):
        P[i] = 0.28 * np.sqrt((r + 0.5) / max(1, len(free))) * np.array([np.cos(r * golden), np.sin(r * golden)])
    return P / (np.abs(P).max() * 1.04)


# ------------------------------------------------------------------ 1. палитра периодов
COLHEX = {"белый": "#f4f1ea", "черный": "#1d1a17", "красный": "#c43a2c", "синий": "#2c4f9e", "голубой": "#79aee0",
          "зеленый": "#3f8a3c", "желтый": "#e3c23a", "серый": "#8c8a86", "розовый": "#e8a0b4", "лиловый": "#9a6bb3",
          "коричневый": "#7a4e2c", "бурый": "#6d4a2e", "рыжий": "#c96a2b", "золотой": "#c9a227", "серебряный": "#c0c3c7",
          "багровый": "#8e1f1f", "алый": "#e2362e", "фиолетовый": "#6b3fa0", "оранжевый": "#ef8a2b", "малиновый": "#b0194f",
          "сиреневый": "#c3a2d8", "седой": "#d9d6d0", "пестрый": "#a58a5d", "бледный": "#e9e1cf", "румяный": "#e59a86",
          "смуглый": "#a67750", "вишневый": "#7b1e2b", "пурпуровый": "#7d1e5a"}
YO = {"черный": "чёрный", "зеленый": "зелёный", "желтый": "жёлтый", "пестрый": "пёстрый", "вишневый": "вишнёвый"}
col_ids = {w: C.lid(w) for w in COLHEX if C.lid(w) is not None}
pal = {}
for key, m in (("works", W_MASK), ("letters", L_MASK)):
    rows = []
    for p in range(len(PER)):
        mp = m & (t_per == p)
        cnt = np.bincount(C.t_lemma[mp], minlength=len(C.lemmas))
        c = sorted([[YO.get(w, w), COLHEX[w], int(cnt[li])] for w, li in col_ids.items() if cnt[li]], key=lambda r: -r[2])
        # «вишнёвый» в письмах — почти всегда название пьесы: в палитру писем не входит
        if key == "letters":
            c = [r for r in c if r[0] != "вишнёвый"]
        rows.append({"p": PER[p][0], "c": c})
    pal[key] = rows
OUT["palette"] = pal

# ------------------------------------------------------------------ 2. карта словаря (рассказы и пьесы)
KEEP_POS = {"NOUN", "ADJF", "ADJS", "VERB", "INFN", "PRTF", "PRTS", "GRND"}
PRONOUNISH = {"весь", "свой", "сам", "самый", "наш", "ваш", "мой", "твой", "этот", "тот", "такой", "который", "какой",
              "каждый", "никакой", "другой", "иной", "всякий", "чей", "один", "быть", "мочь", "стать", "самое", "его", "ее"}
SHOW = {"черта": "чёрт/черта", "деньга": "деньги", "ее": "её"}
lpos = C.l_pos
okl = np.array([(lpos[i] in KEEP_POS) and not C.l_name[i] and C.lemmas[i] not in PRONOUNISH and len(C.lemmas[i]) > 1
                for i in range(len(C.lemmas))])
idx = np.nonzero(W_MASK & okl[C.t_lemma])[0]
lem_seq = C.t_lemma[idx]
par_seq = C.t_para[idx]
sents = []
cuts = np.nonzero(np.diff(par_seq))[0] + 1
for seg in np.split(lem_seq, cuts):
    for k in range(0, len(seg), 12):
        ch = seg[k:k + 24]
        if len(ch) >= 4:
            sents.append(ch)
freq = Counter(np.concatenate(sents).tolist())
vocab = [w for w, c in freq.most_common() if c >= 8][:6000]
vi = {w: i for i, w in enumerate(vocab)}
Cm = np.zeros((len(vocab), len(vocab)), np.float32)
for ch in sents:
    ids = [vi[w] for w in ch.tolist() if w in vi]
    for x, i in enumerate(ids):
        for j in ids[max(0, x - 5):x]:
            Cm[i, j] += 1; Cm[j, i] += 1
ctx = Cm.sum(0) ** 0.75
pmi = np.log(np.maximum(Cm * ctx.sum() / (Cm.sum(1, keepdims=True) * ctx[None, :] + 1e-9), 1e-9))
ppmi = np.maximum(pmi, 0).astype(np.float32)
U, Sv = rsvd(ppmi, 100)
Wv = U * np.sqrt(Sv)
Wv /= np.linalg.norm(Wv, axis=1, keepdims=True) + 1e-9
LEX = S["lex"]
key_of = lambda li: SHOW.get(C.lemmas[li], C.lemmas[li])
content = [li for li in vocab if key_of(li) in LEX]
top_words = content[:260]
neighbors = {}
for li in content[:1500]:
    sims = Wv @ Wv[vi[li]]
    neighbors[key_of(li)] = [key_of(vocab[j]) for j in np.argsort(-sims)[1:30] if key_of(vocab[j]) in LEX and vocab[j] != li][:6]
Vt = np.array([Wv[vi[li]] for li in top_words])
emb = tsne(Vt)
wl, _ = kmeans(Vt, 8, n_init=15)
wmap = [{"w": YO.get(key_of(li), key_of(li)), "k": key_of(li), "x": round(float(x), 3), "y": round(float(y), 3), "c": int(c),
         "n": int(freq[li])} for li, (x, y), c in zip(top_words, emb, wl)]
groups = []
for c in range(8):
    ws = sorted([m for m in wmap if m["c"] == c], key=lambda m: -m["n"])
    groups.append([m["w"] for m in ws[:4]])
OUT["wmap"] = wmap
OUT["wgroups"] = groups
OUT["neighbors"] = {k: v for k, v in neighbors.items()}

# ------------------------------------------------------------------ 3. сеть людей в письмах
people = S["world"]["people_letters"]
alias_rev = defaultdict(set)
for a, b in WL.PEOPLE_ALIAS.items():
    alias_rev[b].add(a.lower())
L_idx = np.nonzero(L_MASK & C.t_cap)[0]
lem_L = C.t_lemma[L_idx]
paras_by_person = {}
for name, n, adr in people:
    if name in WL.FORCE_PERSON:
        rx = re.compile(r"(?<![А-Яа-яЁё])" + WL.FORCE_PERSON[name])
        ps = {pi for pi in range(len(C.ptext)) if C.p_kind[pi] == 5 and rx.search(C.ptext[pi])}
    else:
        lids = [C.lid(x) for x in {name.lower()} | alias_rev.get(name, set())]
        lids = [x for x in lids if x is not None]
        ps = set(C.t_para[L_idx[np.isin(lem_L, lids)]].tolist())
    if ps:
        paras_by_person[name] = ps
# расширим пул: люди с ≥ 8 письмами из ранжированного списка (он уже очищен), до 120
pool = [p for p in people if p[0] in paras_by_person][:120]
N = len(pool)
names = [p[0] for p in pool]
Wm = np.zeros((N, N))
blk = defaultdict(set)
for i, nm in enumerate(names):
    for pi in paras_by_person[nm]:
        blk[pi].add(i)
for mem in blk.values():
    m = sorted(mem)
    for a in range(len(m)):
        for c in range(a + 1, len(m)):
            Wm[m[a], m[c]] += 1; Wm[m[c], m[a]] += 1
np.fill_diagonal(Wm, 0)
deg = Wm.sum(1) + 1e-9
Sn = Wm / np.sqrt(np.outer(deg, deg))
vals, vecs = np.linalg.eigh(Sn)
K = 7
X = vecs[:, -K:]
X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-9
lab, _ = kmeans(X, K, n_init=20)
sizes = Counter(lab.tolist())
top_cl = [c for c, _ in sizes.most_common() if sizes[c] >= 4][:7]
cl = np.array([top_cl.index(c) if c in top_cl else -1 for c in lab])
tx = np.array([p[1] for p in pool], float)
pos = island_layout(cl, tx)
addr_n = Counter()
for d in D:
    if d["kind"] == "letter":
        addr_n[re.split(r"\s*\(", d["to_nom"])[0].split()[-1]] += 1


def contexts(pis, word, n=3):
    pis = sorted(pis, key=lambda pi: (D[int(C.p_doc[pi])].get("year") or 0))
    step = max(1, len(pis) // n)
    out = []
    stem = re.escape(word[:max(3, len(word) - 2)])
    for pi in pis[::step][:n]:
        t = C.ptext[pi]
        m = re.search(stem, t)
        d = D[int(C.p_doc[pi])]
        s = snip(t, m.start(), m.end(), 230) if m else t[:230]
        out.append({"s": s, "to": d.get("to_nom") or d["title"], "y": d.get("year")})
    return out


nodes = []
for i, (nm, nlet, adr) in enumerate(pool):
    pis = paras_by_person[nm]
    lets = {int(C.p_doc[pi]) for pi in pis}
    per = [sum(1 for di in lets if per_of(D[di]["year"] or 0) == p) for p in range(len(PER))]
    ys = sorted(D[di]["year"] for di in lets if D[di]["year"])
    nb = [(int(j), int(Wm[i, j])) for j in np.argsort(-Wm[i])[:6] if Wm[i, j] > 0]
    nodes.append({"name": nm, "n": len(lets), "np": len(pis), "per": per, "y0": ys[0] if ys else None, "y1": ys[-1] if ys else None,
                  "adr": bool(adr), "wrote": addr_n.get(nm, 0), "cl": int(cl[i]), "x": round(float(pos[i, 0]), 4),
                  "y": round(float(pos[i, 1]), 4), "nb": [[j, w] for j, w in nb], "ctx": contexts(pis, nm)})
keep = {(i, j) for i in range(N) for j in range(i + 1, N) if Wm[i, j] >= 2}
for i in range(N):
    if Wm[i].max() >= 1:
        j = int(np.argmax(Wm[i])); keep.add((min(i, j), max(i, j)))
edges = [[i, j, int(Wm[i, j])] for i, j in sorted(keep)]
clusters = []
for c in range(len(top_cl)):
    mem = sorted((i for i in range(N) if cl[i] == c), key=lambda i: -pool[i][1])
    clusters.append({"names": [pool[i][0] for i in mem[:3]], "n": len(mem)})
OUT["net"] = {"nodes": nodes, "edges": edges, "clusters": clusters, "total": len(people)}

# ------------------------------------------------------------------ 4. имена героев: карточки
names_w = S["world"]["names_works"]
wi = np.nonzero(W_MASK & C.t_cap & ~C.t_sst)[0]
lem_w = C.t_lemma[wi]
hero = {}
for g in ("m", "f"):
    for nm, n in names_w[g]:
        li = C.lid(nm)
        if li is None:
            continue
        pis = set(C.t_para[wi[lem_w == li]].tolist())
        docs = Counter(int(C.p_doc[pi]) for pi in pis)
        per = [sum(1 for di in docs if per_of(D[di]["year"] or 0) == p) for p in range(len(PER))]
        top = [[D[di]["title"], D[di]["year"], k] for di, k in docs.most_common(14)]
        hero[nm] = {"g": g, "n": len(docs), "per": per, "texts": top, "ctx": contexts(pis, nm, 3)}
OUT["heroes"] = hero

# ------------------------------------------------------------------ 5. темы
th = {}
for field, words in rules.THEMES.items():
    ids = C.ids(words)
    is_f = np.isin(C.t_lemma, ids)
    row = {"words": [], "works": [], "letters": []}
    for key, m in (("works", W_MASK), ("letters", L_MASK)):
        row[key] = [round(1000 * int((m & is_f & (t_per == p)).sum()) / max(1, int((m & (t_per == p)).sum())), 3)
                    for p in range(len(PER))]
    cw = Counter(C.lemmas[int(l)] for l in C.t_lemma[W_MASK & is_f])
    cl_ = Counter(C.lemmas[int(l)] for l in C.t_lemma[L_MASK & is_f])
    row["words"] = [[SHOW.get(w, w), cw.get(w, 0), cl_.get(w, 0)] for w, _ in (cw + cl_).most_common(12)]
    # рассказ, где тема громче всего (от 1500 слов)
    st = [i for i, d in enumerate(D) if d["kind"] in ("story", "play")]
    nw = np.bincount(C.t_doc[W_MASK], minlength=len(D))
    nf = np.bincount(C.t_doc[W_MASK & is_f], minlength=len(D))
    best = sorted([i for i in st if nw[i] >= 1500], key=lambda i: -nf[i] / nw[i])[:3]
    row["loud"] = [[D[i]["title"], D[i]["year"], round(1000 * nf[i] / nw[i], 1)] for i in best]
    th[field] = row
OUT["themes"] = th

json.dump(OUT, open(HERE / "explore.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("explore.json", round((HERE / "explore.json").stat().st_size / 1024), "KB")
if QA:
    for k in ("works", "letters"):
        print(k, [(r["p"], [c[0] for c in r["c"][:6]]) for r in pal[k]])
    print("wmap groups:", groups)
    print("соседи:", {k: neighbors.get(k) for k in ["скука", "деньги", "доктор", "сад", "любовь", "жена"]})
    print("сеть:", N, "рёбер", len(edges), "круги:", clusters)
    for f, r in th.items():
        print(f"  {f:22s} {r['works']} | {r['letters']} | {r['loud'][:2]}")
