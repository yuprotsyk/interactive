"""Генерує еталонні значення зі scipy для тестів статистики.

Запуск: python3 tools/gen_fixtures.py
Результат: tests/fixtures/scipy-cases.json
"""
import json
import pathlib

import numpy as np
from scipy import stats

rng = np.random.default_rng(20261027)
cases = []


def add(name, x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    pr = stats.pearsonr(x, y)
    sr = stats.spearmanr(x, y)
    entry = {
        "name": name,
        "x": [float(v) for v in x],
        "y": [float(v) for v in y],
        "r": float(pr.statistic),
        "p": float(pr.pvalue),
        "rho": float(sr.statistic),
    }
    if len(x) >= 4 and abs(pr.statistic) < 1:
        ci = pr.confidence_interval(0.95)
        entry["ci"] = [float(ci.low), float(ci.high)]
    else:
        entry["ci"] = None
    # лінійна регресія
    lr = stats.linregress(x, y)
    entry["slope"] = float(lr.slope)
    entry["intercept"] = float(lr.intercept)
    cases.append(entry)


# 1. Гауссові пари із заданою кореляцією, різні n
for n in [3, 4, 5, 6, 8, 10, 15, 20, 30, 50, 100, 200]:
    for target in [-0.95, -0.6, -0.2, 0.0, 0.15, 0.5, 0.8, 0.97]:
        z = rng.standard_normal((2, n))
        x = z[0]
        y = target * z[0] + np.sqrt(1 - target**2) * z[1]
        add(f"gauss n={n} r~{target}", x * 17 + 50, y * 17 + 50)

# 2. Цілі значення з багатьма повторами (ранги з однаковими значеннями)
for n in [8, 15, 40, 120]:
    x = rng.integers(0, 6, n)
    y = (x + rng.integers(-2, 3, n)).astype(float)
    if x.std() > 0 and y.std() > 0:
        add(f"integers with ties n={n}", x, y)

# 3. Важкі хвости та викиди
for n in [12, 25, 60]:
    x = rng.standard_t(2, n)
    y = 0.4 * x + rng.standard_t(2, n)
    add(f"heavy tails n={n}", x, y)

# 4. Великі зсуви та малий розкид (перевірка числової стійкості)
for n in [10, 30]:
    x = 1e6 + rng.standard_normal(n) * 1e-2
    y = 1e6 + 0.7 * (x - 1e6) + rng.standard_normal(n) * 1e-2
    add(f"large offset n={n}", x, y)

# 5. Дуже різні масштаби
x = rng.standard_normal(40) * 1e-4
y = 3e5 * x + rng.standard_normal(40) * 20
add("tiny x huge y", x, y)

# 6. Майже ідеальні залежності
x = np.linspace(0, 100, 25)
add("perfect-ish line", x, 2 * x + 1 + rng.standard_normal(25) * 1e-6)
add("monotone nonlinear", x, np.exp(x / 25))

# 7. Квартет Анскомба
ax = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5]
add("anscombe I", ax, [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68])
add("anscombe II", ax, [9.14, 8.14, 8.74, 8.77, 9.26, 8.10, 6.13, 3.10, 9.13, 7.26, 4.74])
add("anscombe III", ax, [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73])
add(
    "anscombe IV",
    [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8],
    [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.50, 5.56, 7.91, 6.89],
)

out = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "scipy-cases.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({"scipy": __import__("scipy").__version__, "cases": cases}, indent=0))
print(f"Записано {len(cases)} випадків у {out}")
