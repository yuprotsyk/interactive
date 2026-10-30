"""Еталонні значення для tests/summary.mjs.
Сирі дані: numpy (середнє, медіана, дисперсії); квартилі й мода обчислені окремою, простою реалізацією.
Інтервальний ряд: точна арифметика (Fraction) за формулами з підручника.
Запуск: python3 tools/gen_summary_fixtures.py
"""
import json, random
from collections import Counter
from fractions import Fraction as Fr
import numpy as np

def med(xs):
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2

def quart(xs):
    xs = sorted(xs); n = len(xs)
    if n < 2: return None
    h = n // 2
    return med(xs[:h]), med(xs[n - h:])

def mode(xs):
    c = Counter(xs); mx = max(c.values()); modes = sorted(k for k, v in c.items() if v == mx)
    if len(c) > 1 and (mx == 1 or len(modes) == len(c)): return None
    return modes

def group(xs, start, h):
    xs = [Fr(str(x)) for x in xs]; start = Fr(str(start)); h = Fr(str(h))
    mn, mx = min(xs), max(xs)
    k = (mn - start) // h
    start = start + k * h
    m = max(1, int(-((start - mx) // h)))
    f = [0] * m
    for x in xs: f[min(m - 1, int((x - start) // h))] += 1
    return start, h, f

def gstats(start, h, f, ddof):
    n = sum(f); m = len(f)
    mids = [start + (i + Fr(1, 2)) * h for i in range(m)]
    mean = sum(fi * mi for fi, mi in zip(f, mids)) / n
    var = sum(fi * (mi - mean) ** 2 for fi, mi in zip(f, mids)) / (n - ddof) if n - ddof > 0 else None
    def quant(p):
        t = Fr(p) * n; cum = 0
        for i in range(m):
            if f[i] and cum + f[i] >= t:
                return float(start + i * h + h * (t - cum) / f[i])
            cum += f[i]
    mx = max(f); cands = [i for i in range(m) if f[i] == mx]
    modes = None
    if not (m > 1 and len(cands) == m):
        modes = []
        for i in cands:
            fm = f[i - 1] if i > 0 else 0; fp = f[i + 1] if i < m - 1 else 0
            d1, d2 = mx - fm, mx - fp
            modes.append(None if d1 + d2 == 0 else float(start + i * h + h * Fr(d1, d1 + d2)))
    return dict(mean=float(mean), var=None if var is None else float(var),
                median=quant(Fr(1, 2)), q1=quant(Fr(1, 4)), q3=quant(Fr(3, 4)), modes=modes)

rng = random.Random(7)
cases = []
for t in range(40):
    n = rng.choice([1, 2, 3, 4, 5, 8, 11, 20, 37, 60])
    kind = t % 4
    if kind == 0: xs = [rng.randint(1, 12) for _ in range(n)]
    elif kind == 1: xs = [round(rng.gauss(50, 12), 1) for _ in range(n)]
    elif kind == 2: xs = [rng.choice([2, 2, 3, 7, 7, 8, 15]) for _ in range(n)]
    else: xs = [round(rng.expovariate(0.1), 1) for _ in range(n)]
    a = np.array(xs, dtype=float)
    c = dict(data=xs, mean=float(a.mean()), median=float(np.median(a)),
             var0=float(a.var(ddof=0)), var1=float(a.var(ddof=1)) if n > 1 else None, mode=mode(xs),
             quart=quart(xs))
    h = rng.choice([1, 2, 2.5, 5, 10]); start = rng.choice([0, 0.5, -3, 7, 100])
    st, hh, f = group(xs, start, h)
    c["group"] = dict(start=float(st), h=float(hh), f=f, input=[start, h],
                      ddof0=gstats(st, hh, f, 0), ddof1=gstats(st, hh, f, 1))
    cases.append(c)
json.dump(cases, open("tests/fixtures/summary-cases.json", "w"), ensure_ascii=False)
print(len(cases), "наборів")
