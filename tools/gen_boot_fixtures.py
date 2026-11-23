"""Еталони для tests/bootstrap.mjs: numpy. Перевіряємо детерміновані частини (квантиль, ПІ, se, медіана)
на готових масивах бутстреп-значень. Сама перевибірка перевіряється властивостями.
Запуск: python3 tools/gen_boot_fixtures.py"""
import json
import numpy as np

rng = np.random.default_rng(2026)
out = {"numpy": np.__version__, "cases": []}
for B, kind in [(5, "plain"), (50, "plain"), (1000, "skew"), (999, "skew"), (2, "plain")]:
    x = rng.normal(10, 3, B) if kind == "plain" else rng.exponential(4, B)
    x = np.round(x, 4)
    case = {"stats": x.tolist(), "se": float(np.std(x, ddof=1)),
            "q": {str(p): float(np.quantile(x, p)) for p in (0.005, 0.025, 0.05, 0.5, 0.95, 0.975, 0.995)},
            "ci95": np.quantile(x, [0.025, 0.975]).tolist(), "ci90": np.quantile(x, [0.05, 0.95]).tolist(),
            "ci99": np.quantile(x, [0.005, 0.995]).tolist()}
    out["cases"].append(case)
meds = []
for v in ([3, 1, 2], [4, 1, 3, 2], [5], [1, 1, 1, 9], [2.5, 0.5, 7.25, 3, 3, 10]):
    meds.append({"v": v, "median": float(np.median(v)), "mean": float(np.mean(v))})
out["stats"] = meds
json.dump(out, open("tests/fixtures/bootstrap.json", "w"), indent=1)
print("ok")
