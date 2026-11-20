#!/usr/bin/env python3
"""Еталон для tests/walk.mjs: розорення гравця й тривалість гри з точного розв'язку лінійної системи (Fraction)."""
import json, os
from fractions import Fraction as F
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def solve(N, p):
    """Повертає (win[i], dur[i]) для i = 0..N: win це ймовірність дійти до N раніше за 0, dur очікувана тривалість."""
    q = 1 - p
    n = N - 1  # невідомі i = 1..N-1
    def gauss(A, b):
        m = len(A)
        M = [row[:] + [b[i]] for i, row in enumerate(A)]
        for c in range(m):
            piv = next(r for r in range(c, m) if M[r][c] != 0)
            M[c], M[piv] = M[piv], M[c]
            M[c] = [x / M[c][c] for x in M[c]]
            for r in range(m):
                if r != c and M[r][c] != 0:
                    f = M[r][c]; M[r] = [x - f * y for x, y in zip(M[r], M[c])]
        return [M[i][m] for i in range(m)]
    # w_i = p w_{i+1} + q w_{i-1}; w_0 = 0, w_N = 1
    A = [[F(0)] * n for _ in range(n)]; bw = [F(0)] * n; bd = [F(1)] * n
    for i in range(1, N):
        r = i - 1
        A[r][r] = F(1)
        if i + 1 < N: A[r][i] = -p
        else: bw[r] += p
        if i - 1 >= 1: A[r][i - 2] = -q
    w = [F(0)] + gauss(A, bw) + [F(1)]
    d = [F(0)] + gauss(A, bd) + [F(0)]
    return w, d

out = []
for p in [F(1, 2), F(11, 20), F(2, 5), F(7, 10), F(9, 20)]:
    for a, b in [(1, 1), (3, 7), (5, 5), (10, 3), (2, 18), (20, 20)]:
        w, d = solve(a + b, p)
        out.append({"p": float(p), "a": a, "b": b, "ruin": float(1 - w[a]), "dur": float(d[a])})
json.dump(out, open(os.path.join(root, "tests/fixtures/walk.json"), "w"))
print(len(out))
