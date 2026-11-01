"""Еталони для tests/geometry.mjs: площі областей, обчислені числовим інтегруванням (scipy.integrate.quad).
Запуск: python3 tools/gen_geom_fixtures.py
"""
import json
import numpy as np
from scipy import integrate

def meeting(T, tau):
    # площа {(x, y) ∈ [0, T]² : |x − y| ≤ τ} / T²
    f = lambda x: min(T, x + tau) - max(0.0, x - tau)
    return integrate.quad(f, 0, T, points=[tau, T - tau] if 0 < tau < T else None)[0] / T**2

def buffon(l, d):
    # площа під кривою x = (l/2) sin θ у прямокутнику θ ∈ [0, π/2], x ∈ [0, d/2]
    area = integrate.quad(lambda t: (l / 2) * np.sin(t), 0, np.pi / 2)[0]
    return area / ((np.pi / 2) * (d / 2))

def circle(r):
    # площа круга радіуса r усередині квадрата одиничної площі (r ≤ ½)
    return integrate.quad(lambda x: 2 * np.sqrt(max(r * r - x * x, 0)), -r, r)[0]

def quarter():
    return integrate.quad(lambda x: np.sqrt(1 - x * x), 0, 1)[0]

out = {
    "scipy": __import__("scipy").__version__,
    "meeting": [{"T": T, "tau": tau, "p": meeting(T, tau)} for T, tau in [(60, 15), (60, 5), (60, 30), (60, 60), (1, .25), (120, 20), (60, 0)]],
    "buffon": [{"l": l, "d": d, "p": buffon(l, d)} for l, d in [(1, 1), (.5, 1), (.3, 1), (2, 3), (.9, 1), (.1, 1)]],
    "circle": [{"r": r, "p": circle(r)} for r in [.5, .25, .1, .4, .05]],
    "quarter": quarter(),
}
json.dump(out, open("tests/fixtures/geometry.json", "w"), ensure_ascii=False, indent=1)
print("ok")
