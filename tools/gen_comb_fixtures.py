#!/usr/bin/env python3
"""Еталон для tests/combinatorics.mjs: точні значення з math.comb / math.perm / math.factorial."""
import json, math, os
from fractions import Fraction
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {"A": [], "Arep": [], "C": [], "Crep": [], "multi": [], "birthday": [], "lottery": []}
for n in [0, 1, 2, 5, 10, 26, 49, 62, 100]:
    for k in [0, 1, 2, 3, 6, 8, 20, 30]:
        out["A"].append([n, k, str(math.perm(n, k)) if k <= n else "0"])
        out["Arep"].append([n, k, str(n ** k)])
        out["C"].append([n, k, str(math.comb(n, k)) if k <= n else "0"])
        out["Crep"].append([n, k, str(math.comb(n + k - 1, k)) if n > 0 else ("1" if k == 0 else "0")])
for counts in [[1], [2, 3, 2, 1, 1, 1], [3, 2, 1], [2, 2, 2, 1, 1, 1, 2, 1, 1, 1], [5], [1, 1, 1, 1]]:
    out["multi"].append([counts, str(math.factorial(sum(counts)) // math.prod(math.factorial(c) for c in counts))])
for n, k in [(365, 23), (365, 50), (365, 2), (100, 10), (12, 12)]:
    p = Fraction(math.perm(n, k), n ** k) if k <= n else Fraction(0)
    out["birthday"].append([n, k, float(p)])
for N, K, m in [(49, 6, 6), (49, 6, 3), (49, 6, 0), (36, 5, 4), (49, 6, 2)]:
    out["lottery"].append([N, K, m, float(Fraction(math.comb(K, m) * math.comb(N - K, K - m), math.comb(N, K)))])
json.dump(out, open(os.path.join(root, "tests/fixtures/combinatorics.json"), "w"))
print({k: len(v) for k, v in out.items()})
