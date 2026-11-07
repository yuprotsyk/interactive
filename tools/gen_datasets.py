#!/usr/bin/env python3
"""Генерує datasets.js (набори даних для сторінок) і tests/fixtures/datasets.json (n, x̄, s за numpy).
Запуск: python3 tools/gen_datasets.py <каталог із вихідними txt-файлами>
Файли: ADHD.txt, weight.txt, verizon.txt, water.txt, banknotes.txt, seattle.txt (з префіксами-хешами теж підходить)."""
import glob, json, os, sys
import numpy as np

src = sys.argv[1] if len(sys.argv) > 1 else "."
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def path(name):
    hits = glob.glob(os.path.join(src, "*" + name + ".txt")) + glob.glob(os.path.join(src, name + ".txt"))
    assert hits, name
    return hits[0]

def rows(name):
    return [l.split() for l in open(path(name), encoding="utf-8") if l.strip()]

def num(x):
    f = float(x)
    return int(f) if f == int(f) and "." not in x else f

D = {}
r = rows("ADHD")[1:]
D["adhd"] = {"D0": [num(a[0]) for a in r], "D60": [num(a[1]) for a in r]}
r = rows("weight")[1:]
D["weight"] = {"Before": [num(a[0]) for a in r], "After": [num(a[1]) for a in r]}
r = rows("verizon")[1:]
D["verizon"] = {g: [num(a[0]) for a in r if a[1] == g] for g in ["CLEC", "ILEC"]}
r = rows("water")[1:]
D["water"] = {"North": [num(a[-2]) for a in r if a[0] == "North"], "South": [num(a[-2]) for a in r if a[0] == "South"]}
r = rows("banknotes")[1:]
D["banknotes"] = {"real1": [num(a[3]) for a in r if a[6] == "1"], "real0": [num(a[3]) for a in r if a[6] == "0"]}
r = rows("seattle")[1:]
D["seattle"] = {"y2002": [num(a[0]) for a in r if a[1] == "2002"], "y2001": [num(a[0]) for a in r if a[1] == "2001"]}

out = ["/* ============================================================",
       "   datasets.js: набори даних для сторінок (глобальний об'єкт Data). Згенеровано tools/gen_datasets.py,",
       "   вручну не редагувати. Data[id] = { стовпець: [значення, ...], ... }. Від DOM не залежить.",
       "   Складені назви: banknotes.real1 / real0 це змінна X4 для real = 1 / 0 (за файлом); water: mortality за групами North / South;",
       "   seattle: Price за роками. Значення збережено так, як у вихідних файлах.",
       "   ============================================================ */",
       "var Data = " + json.dumps(D, separators=(",", ":")).replace("},", "},\n  ").replace('{"', '{\n  "', 1) + ";",
       "",
       'if (typeof module !== "undefined" && module.exports) module.exports = Data;', ""]
open(os.path.join(root, "datasets.js"), "w", encoding="utf-8").write("\n".join(out))
fx = {k: {c: {"n": len(v), "mean": float(np.mean(v)), "sd": float(np.std(v, ddof=1))} for c, v in d.items()} for k, d in D.items()}
json.dump(fx, open(os.path.join(root, "tests/fixtures/datasets.json"), "w"), indent=1)
print({k: {c: len(v) for c, v in d.items()} for k, d in D.items()})
