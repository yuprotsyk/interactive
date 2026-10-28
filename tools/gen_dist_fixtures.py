"""Еталонні значення розподілів зі scipy для тестів distributions.js.

Запуск: python3 tools/gen_dist_fixtures.py
Результат: tests/fixtures/scipy-dist.json
"""
import json
import math
import pathlib

import numpy as np
from scipy import stats


def clean(v):
    """nan -> null, ±inf -> рядок, щоб файл був коректним JSON."""
    v = float(v)
    if math.isnan(v):
        return None
    if math.isinf(v):
        return "inf" if v > 0 else "-inf"
    return v


cases = []


def discrete(name, key, params, frozen):
    lo, hi = frozen.support()
    lo = int(lo)
    hi = int(min(hi, lo + 400)) if np.isfinite(hi) else lo + 400
    ks = list(range(lo - 1, hi + 2))
    cases.append({
        "dist": key, "name": name, "kind": "discrete", "params": params,
        "x": ks,
        "f": [clean(frozen.pmf(k)) for k in ks],
        "cdf": [clean(frozen.cdf(k)) for k in ks],
        "mean": clean(frozen.mean()), "var": clean(frozen.var()),
    })


def continuous(name, key, params, frozen, extra=()):
    ps = [1e-6, 1e-4, 1e-3, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.999, 1 - 1e-6]
    xs = [float(frozen.ppf(p)) for p in ps] + [-3.0, -1.0, 0.0, 0.5, 1.0, 2.5, 7.0] + list(extra)
    xs = sorted(set(x for x in xs if np.isfinite(x)))
    f = []
    for x in xs:
        v = frozen.pdf(x)
        f.append(clean(v) if np.isfinite(v) else "inf")
    cases.append({
        "dist": key, "name": name, "kind": "continuous", "params": params,
        "x": xs, "f": f, "cdf": [clean(frozen.cdf(x)) for x in xs],
        "mean": clean(frozen.mean()), "var": clean(frozen.var()),
    })


for n, p in [(1, 0.5), (10, 0.3), (20, 0.5), (50, 0.1), (100, 0.9), (100, 0.5), (7, 0.01), (30, 0.0), (30, 1.0)]:
    discrete(f"binomial n={n} p={p}", "binomial", {"n": n, "p": p}, stats.binom(n, p))

for p in [0.02, 0.1, 0.25, 0.5, 0.95, 1.0]:
    discrete(f"geometric p={p}", "geometric", {"p": p}, stats.geom(p))

for lam in [0.1, 1, 4.5, 10, 30, 50]:
    discrete(f"poisson lam={lam}", "poisson", {"lam": lam}, stats.poisson(lam))

for N, K, n in [(50, 10, 5), (100, 30, 20), (100, 100, 10), (20, 0, 5), (10, 5, 10), (100, 50, 100), (30, 15, 10), (2, 1, 1), (60, 40, 30)]:
    # scipy: hypergeom(M=N, n=K, N=n)
    discrete(f"hypergeometric N={N} K={K} n={n}", "hypergeometric", {"N": N, "K": K, "n": n}, stats.hypergeom(N, K, n))

for mu, s in [(0, 1), (3, 0.5), (-5, 4), (10, 0.2)]:
    continuous(f"normal mu={mu} sigma={s}", "normal", {"mu": mu, "sigma": s}, stats.norm(mu, s),
               extra=[mu - 8 * s, mu + 8 * s])

for lam in [0.1, 0.5, 1, 5]:
    continuous(f"exponential lam={lam}", "exponential", {"lam": lam}, stats.expon(scale=1 / lam))

for a, b in [(0, 1), (-3, 4.5), (2, 2.3)]:
    continuous(f"uniform a={a} b={b}", "uniform", {"a": a, "b": b}, stats.uniform(loc=a, scale=b - a),
               extra=[a, b, a - 0.1, b + 0.1])

for k in [1, 2, 3, 10, 30, 50]:
    continuous(f"chisq k={k}", "chisq", {"k": k}, stats.chi2(k), extra=[1e-3, 20, 60])

for nu in [1, 2, 3, 10, 30, 100]:
    continuous(f"student nu={nu}", "student", {"nu": nu}, stats.t(nu), extra=[-10, 10])

for d1, d2 in [(1, 1), (2, 5), (5, 2), (10, 10), (4, 30), (100, 100), (3, 3), (6, 4)]:
    continuous(f"fisher d1={d1} d2={d2}", "fisher", {"d1": d1, "d2": d2}, stats.f(d1, d2), extra=[1e-3, 20, 60])

out = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "scipy-dist.json"
out.write_text(json.dumps({"scipy": __import__("scipy").__version__, "cases": cases}))
print(f"Записано {len(cases)} наборів у {out}")
