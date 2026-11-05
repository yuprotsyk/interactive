"""Еталони для tests/hypotheses.mjs: scipy.stats.norm (z-критерій для середнього, σ відоме)
і scipy.stats.binomtest/binom (біноміальний критерій, H0: p = 1/2).
Запуск: python3 tools/gen_hyp_fixtures.py
"""
import json
from scipy.stats import norm, binom, binomtest, t as tdist

def crit(alpha, tail):
    if tail == "right": return [None, norm.ppf(1 - alpha)]
    if tail == "left": return [-norm.ppf(1 - alpha), None]
    c = norm.ppf(1 - alpha / 2)
    return [-c, c]

def power(mu, mu0, sigma, n, alpha, tail):
    lam = (mu - mu0) / (sigma / n ** 0.5)
    lo, hi = crit(alpha, tail)
    p = 0.0
    if hi is not None: p += norm.sf(hi - lam)
    if lo is not None: p += norm.cdf(lo - lam)
    return float(p)

def pval(z, tail):
    if tail == "right": return float(norm.sf(z))
    if tail == "left": return float(norm.cdf(z))
    return float(2 * norm.sf(abs(z)))

cases = []
for tail in ["two", "right", "left"]:
    for alpha in [0.01, 0.05, 0.1]:
        for n in [1, 9, 25, 100]:
            lo, hi = crit(alpha, tail)
            se = 15 / n ** 0.5
            cases.append({
                "tail": tail, "alpha": alpha, "n": n, "mu0": 100, "sigma": 15,
                "z": [None if v is None else float(v) for v in (lo, hi)],
                "mean": [None if v is None else float(100 + v * se) for v in (lo, hi)],
                "powers": [{"mu": mu, "p": power(mu, 100, 15, n, alpha, tail)} for mu in [70, 90, 99.5, 100, 103, 110, 125]],
            })
def binom_block():
    res = {"pvalues": [], "critical": []}
    for n in [1, 3, 5, 13, 16, 20, 50, 100]:
        for k in range(n + 1):
            res["pvalues"].append({
                "n": n, "k": k,
                "right": float(binomtest(k, n, .5, alternative="greater").pvalue),
                "left": float(binomtest(k, n, .5, alternative="less").pvalue),
                "two": float(binomtest(k, n, .5).pvalue)})
        for alpha in [0.01, 0.05, 0.1]:
            # незалежно від коду сторінки: перебираємо k і дивимось на хвости біноміального розподілу
            right = next(((k, float(binom.sf(k - 1, n, .5))) for k in range(n + 1) if binom.sf(k - 1, n, .5) <= alpha), None)
            two = next(((k, float(binom.sf(k - 1, n, .5) + binom.cdf(n - k, n, .5))) for k in range((n + 1) // 2, n + 1)
                        if 2 * binom.sf(k - 1, n, .5) <= alpha and k > n / 2), None)
            res["critical"].append({"n": n, "alpha": alpha, "right": right, "two": two})
    return res

def mean_block():
    """z- і t-критерій у єдиному записі: p-значення, критичні межі, довірчі межі (σ або s = scale)."""
    res = []
    for kind, ns in [("z", [1, 9, 25]), ("t", [2, 5, 10, 25, 100])]:
        dist = norm if kind == "z" else None
        for n in ns:
            d = norm if kind == "z" else tdist(n - 1)
            q = (lambda p: float(norm.ppf(p))) if kind == "z" else (lambda p: float(tdist.ppf(p, n - 1)))
            F = (lambda x: float(norm.cdf(x))) if kind == "z" else (lambda x: float(tdist.cdf(x, n - 1)))
            for tail in ["two", "right", "left"]:
                for alpha in [0.01, 0.05, 0.1]:
                    if tail == "right": crit = [None, q(1 - alpha)]
                    elif tail == "left": crit = [-q(1 - alpha), None]
                    else: crit = [-q(1 - alpha / 2), q(1 - alpha / 2)]
                    c = crit[1] if tail != "left" else -crit[0]
                    xbar, scale = 103.0, 12.0
                    se = scale / n ** 0.5
                    bound = [None if tail == "left" else xbar - c * se, None if tail == "right" else xbar + c * se]
                    res.append({"kind": kind, "n": n, "tail": tail, "alpha": alpha, "crit": crit,
                                "xbar": xbar, "scale": scale, "bound": bound})
                for stat in [-3.1, -1.2, 0, 0.8, 2.2, 4.5]:
                    p = F(stat) if tail == "left" else (1 - F(stat) if tail == "right" else min(1.0, 2 * (1 - F(abs(stat)))))
                    res.append({"kind": kind, "n": n, "tail": tail, "stat": stat, "p": p})
    return res

out = {"scipy": __import__("scipy").__version__, "cases": cases,
       "binom": binom_block(), "mean": mean_block(),
       "pvalues": [{"z": z, "tail": t, "p": pval(z, t)} for z in [-3, -1.96, -0.5, 0, 0.7, 1.645, 2.5] for t in ["two", "right", "left"]]}
json.dump(out, open("tests/fixtures/hypotheses.json", "w"), indent=1)
print("ok", len(cases))
