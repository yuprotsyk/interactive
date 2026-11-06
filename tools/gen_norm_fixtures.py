"""Еталони для normality.js (scipy): Шапіро–Вілк, хі-квадрат для нормальності, квантилі Бломма.
Запуск: python3 tools/gen_norm_fixtures.py  (потрібні numpy і scipy). Результат: tests/fixtures/normality.json"""
import json, numpy as np, scipy
from scipy import stats

rng = np.random.default_rng(20261105)
samples = []
for n in [3, 4, 5, 6, 8, 11, 12, 13, 20, 35, 50, 100, 250, 500, 1000]:
    for name, gen in [("normal", lambda n: rng.normal(10, 3, n)), ("exp", lambda n: rng.exponential(2, n)),
                      ("uniform", lambda n: rng.uniform(0, 5, n)), ("t3", lambda n: rng.standard_t(3, n)),
                      ("lognormal", lambda n: rng.lognormal(0, 0.8, n))]:
        x = np.round(gen(n), 6)
        if len(np.unique(x)) < 3: continue
        w, p = stats.shapiro(x)
        item = {"name": name, "n": n, "x": x.tolist(), "W": float(w), "p": float(p)}
        # хі-квадрат: рівноймовірні й рівні за довжиною інтервали, μ і σ оцінено (σ̂ з діленням на n)
        mu, sg = float(np.mean(x)), float(np.std(x))
        chis = []
        for K in [4, 6, 10]:
            if K >= 4:
                for mode in ["prob", "width"]:
                    if mode == "prob": e = [mu + sg * float(stats.norm.ppf(j / K)) for j in range(1, K)]
                    else: e = [mu + sg * (-3 + 6 * (j - 1) / (K - 2)) for j in range(1, K)]
                    obs = np.zeros(K)
                    for v in x:
                        j = 0
                        while j < K - 1 and v >= e[j]: j += 1
                        obs[j] += 1
                    cdfs = [0.0] + [float(stats.norm.cdf((t - mu) / sg)) for t in e] + [1.0]
                    exp = n * np.diff(cdfs)
                    chi2 = float(np.sum((obs - exp) ** 2 / exp))
                    chis.append({"K": K, "mode": mode, "chi2": chi2, "df": K - 3, "p": float(stats.chi2.sf(chi2, K - 3)),
                                 "observed": obs.tolist(), "small": float(np.mean(exp < 5 - 1e-9))})
        item["chi"] = chis
        samples.append(item)
qq = {str(n): [float(stats.norm.ppf((i - 0.375) / (n + 0.25))) for i in range(1, n + 1)] for n in [3, 7, 20, 101]}
json.dump({"scipy": scipy.__version__, "samples": samples, "qq": qq}, open("tests/fixtures/normality.json", "w"))
print(len(samples), "вибірок")
