"""Еталони для regression.js: numpy і scipy. Запуск: python3 tools/gen_reg_fixtures.py"""
import json
import numpy as np
import scipy
from scipy import stats

sets = {
    "simple": [(1, 2.1), (2, 3.9), (3, 6.2), (4, 7.8), (5, 10.1), (6, 12.2), (7, 13.8), (8, 16.1)],
    "outlier_y": [(1, 2.1), (2, 3.9), (3, 6.2), (4, 7.8), (5, 25.0), (6, 12.2), (7, 13.8), (8, 16.1)],
    "leverage": [(1, 2.0), (2, 2.4), (3, 1.8), (4, 2.6), (5, 2.2), (6, 2.5), (20, 12.0)],
    "anscombe_I": list(zip([10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5],
                           [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68])),
    "three_points": [(0, 1), (1, 3), (2, 2)],
}
out = {"scipy": scipy.__version__, "numpy": np.__version__, "cases": []}
for name, pts in sets.items():
    x = np.array([p[0] for p in pts], float); y = np.array([p[1] for p in pts], float)
    n = len(x)
    lr = stats.linregress(x, y)
    X = np.column_stack([np.ones(n), x])
    H = X @ np.linalg.inv(X.T @ X) @ X.T
    h = np.diag(H)
    e = y - (lr.intercept + lr.slope * x)
    sse = float(e @ e); sst = float(((y - y.mean()) ** 2).sum())
    s = (sse / (n - 2)) ** 0.5
    std = e / (s * np.sqrt(1 - h))
    cook = e ** 2 * h / (2 * s ** 2 * (1 - h) ** 2)
    t = stats.t.ppf(0.975, n - 2)
    case = {
        "name": name, "pts": [[float(a), float(b)] for a, b in pts], "n": n,
        "b": lr.slope, "a": lr.intercept, "r2": lr.rvalue ** 2, "seB": lr.stderr, "seA": lr.intercept_stderr,
        "s": s, "sse": sse, "sst": sst, "t975": t,
        "ciB": [lr.slope - t * lr.stderr, lr.slope + t * lr.stderr],
        "h": h.tolist(), "stdres": std.tolist(), "cook": cook.tolist(), "res": e.tolist(),
    }
    # без точки з найбільшою відстанню Кука
    k = int(np.argmax(cook))
    lr2 = stats.linregress(np.delete(x, k), np.delete(y, k))
    case["without"] = {"i": k, "b": lr2.slope, "a": lr2.intercept, "r2": lr2.rvalue ** 2}
    out["cases"].append(case)
json.dump(out, open("tests/fixtures/regression.json", "w"), indent=1)
print("ok", len(out["cases"]))
