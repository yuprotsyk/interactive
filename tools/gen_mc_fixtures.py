"""Еталони для tests/montecarlo.mjs: scipy.integrate.quad (I = ∫f, m2 = ∫f²), numpy (середнє й sd).
Запуск: python3 tools/gen_mc_fixtures.py"""
import json
import numpy as np
from scipy import integrate

F = {
    "sin": (np.sin, 0, np.pi), "sq": (lambda x: x ** 2, 0, 1), "gauss": (lambda x: np.exp(-x * x), 0, 1),
    "circle": (lambda x: np.sqrt(1 - x * x), 0, 1), "atan": (lambda x: 1 / (1 + x * x), 0, 1),
}
out = {"funcs": {}, "acc": []}
for k, (f, a, b) in F.items():
    I = integrate.quad(f, a, b, epsabs=1e-13, epsrel=1e-13)[0]
    m2 = integrate.quad(lambda x: f(x) ** 2, a, b, epsabs=1e-13, epsrel=1e-13)[0]
    out["funcs"][k] = {"I": I, "m2": m2, "varMean": (b - a) * m2 - I * I}
# 1/√x на (0; 1]: I = 2, ∫f² розбігається (∫dx/x)
out["funcs"]["invsqrt"] = {"I": integrate.quad(lambda x: x ** -0.5, 0, 1)[0], "m2": None, "varMean": None}
rng = np.random.default_rng(5)
for n in (2, 3, 10, 1000):
    v = np.round(rng.normal(3, 2, n), 6)
    out["acc"].append({"v": v.tolist(), "mean": float(v.mean()), "sd": float(v.std(ddof=1)), "se": float(v.std(ddof=1) / np.sqrt(n))})
json.dump(out, open("tests/fixtures/montecarlo.json", "w"), indent=1)
print("ok")
