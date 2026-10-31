"""Еталони для tests/approx.mjs: scipy (біноміальний, нормальний, Пуассона).
Запуск: python3 tools/gen_approx_fixtures.py
"""
import json
import numpy as np
from scipy import stats as st

CASES = [(40, .5), (100, .3), (200, .01), (10, .3), (1000, .01), (60, .1), (5, .5), (300, .05)]

def tv_normal(n, p):
    s = np.sqrt(n * p * (1 - p)); m = n * p
    k = np.arange(int(m - 12 * s) - 2, int(m + 12 * s) + 3)
    ex = st.binom.pmf(k, n, p)
    lo = st.norm.pdf((k - m) / s) / s
    return float(0.5 * np.sum(np.abs(ex - lo)))

def tv_pois(n, p):
    k = np.arange(0, n + 1)
    ex = st.binom.pmf(k, n, p); po = st.poisson.pmf(k, n * p)
    return float(0.5 * (np.sum(np.abs(ex - po)) + st.poisson.sf(n, n * p)))

out = {"scipy": __import__("scipy").__version__, "cases": []}
for n, p in CASES:
    s = np.sqrt(n * p * (1 - p)); m = n * p
    a, b = max(0, int(round(m - s))), min(n, int(round(m + s)))
    ks = sorted({0, max(0, int(m) - 2), int(m), min(n, int(m) + 3), n})
    out["cases"].append({
        "n": n, "p": p, "a": a, "b": b, "ks": ks,
        "exactPmf": [float(st.binom.pmf(k, n, p)) for k in ks],
        "localNormal": [float(st.norm.pdf((k - m) / s) / s) for k in ks],
        "poissonPmf": [float(st.poisson.pmf(k, m)) for k in ks],
        "exactProb": float(st.binom.cdf(b, n, p) - (st.binom.cdf(a - 1, n, p) if a > 0 else 0)),
        "normalCC": float(st.norm.cdf((b + .5 - m) / s) - st.norm.cdf((a - .5 - m) / s)),
        "normalNoCC": float(st.norm.cdf((b - m) / s) - st.norm.cdf((a - m) / s)),
        "poissonProb": float(st.poisson.cdf(b, m) - (st.poisson.cdf(a - 1, m) if a > 0 else 0)),
        "tvNormal": tv_normal(n, p), "tvPoisson": tv_pois(n, p),
    })
json.dump(out, open("tests/fixtures/approx.json", "w"), ensure_ascii=False, indent=1)
print("OK", len(out["cases"]))
