"""Еталони для tests/proportions.mjs: scipy (norm, binomtest, chi2_contingency).
Одна частка: z і p-значення за формулою, точний p за binomtest. Дві частки: z² збігається з хі-квадрат
Пірсона без поправки (chi2_contingency, correction=False), p двостороннє збігається з його p-значенням.
Запуск: python3 tools/gen_prop_fixtures.py"""
import json
import numpy as np
import scipy
from scipy.stats import norm, binomtest, chi2_contingency

def pv(z, tail):
    return float(norm.sf(z) if tail == "right" else norm.cdf(z) if tail == "left" else 2 * norm.sf(abs(z)))

out = {"scipy": scipy.__version__, "one": [], "two": []}
for n, x, p0 in [(100, 60, 0.5), (200, 18, 0.05), (400, 212, 0.5), (50, 10, 0.3), (1000, 480, 0.5), (30, 3, 0.2), (80, 0, 0.1), (80, 80, 0.9)]:
    phat = x / n; se = (p0 * (1 - p0) / n) ** 0.5; z = (phat - p0) / se
    case = {"n": n, "x": x, "p0": p0, "phat": phat, "se": se, "z": z}
    for tail in ["two", "right", "left"]:
        case["p_" + tail] = pv(z, tail)
        case["exact_" + tail] = float(binomtest(x, n, p0, alternative={"two": "two-sided", "right": "greater", "left": "less"}[tail]).pvalue)
    out["one"].append(case)
for x1, n1, x2, n2 in [(120, 1000, 150, 1000), (30, 100, 45, 120), (5, 40, 9, 35), (200, 500, 180, 450), (1, 20, 8, 25)]:
    p1, p2 = x1 / n1, x2 / n2; pool = (x1 + x2) / (n1 + n2)
    se = (pool * (1 - pool) * (1 / n1 + 1 / n2)) ** 0.5; z = (p1 - p2) / se
    table = np.array([[x1, n1 - x1], [x2, n2 - x2]])
    chi2, pchi, _, _ = chi2_contingency(table, correction=False)
    assert abs(chi2 - z * z) < 1e-9 and abs(pchi - pv(z, "two")) < 1e-12
    se2 = (p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2) ** 0.5
    out["two"].append({"x1": x1, "n1": n1, "x2": x2, "n2": n2, "p1": p1, "p2": p2, "pooled": pool, "se": se, "z": z,
        "p_two": pv(z, "two"), "p_right": pv(z, "right"), "p_left": pv(z, "left"),
        "ci95": [p1 - p2 - norm.ppf(0.975) * se2, p1 - p2 + norm.ppf(0.975) * se2],
        "ci90": [p1 - p2 - norm.ppf(0.95) * se2, p1 - p2 + norm.ppf(0.95) * se2]})
json.dump(out, open("tests/fixtures/proportions.json", "w"), indent=1)
print("ok")
