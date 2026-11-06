// Перевірка normality.js зі scipy. Запуск: node --test tests/normality.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
const Norm = require("../normality.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/normality.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(a === b || Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

test(`критерій Шапіро–Вілка збігається зі scipy ${fx.scipy}`, () => {
  assert.ok(fx.samples.length > 50);
  for (const s of fx.samples) {
    const r = Norm.shapiroWilk(s.x), id = `${s.name}, n=${s.n}`;
    near(r.W, s.W, 2e-5, id + " W");
    near(r.p, s.p, Math.max(2e-4, s.p * 0.02), id + " p");
  }
});

test("хі-квадрат для нормальності збігається з розрахунком у scipy", () => {
  for (const s of fx.samples) for (const c of s.chi) {
    const r = Norm.chiSquare(s.x, c.K, c.mode), id = `${s.name}, n=${s.n}, K=${c.K}, ${c.mode}`;
    assert.deepEqual(r.observed, c.observed, id + " кількості");
    near(r.chi2, c.chi2, 1e-7 * Math.max(1, c.chi2), id + " χ²");
    assert.equal(r.df, c.df, id + " df");
    near(r.p, c.p, 1e-8, id + " p");
    near(r.small, c.small, 1e-12, id + " частка малих");
  }
});

test("квантилі Бломма й опорна пряма Q-Q", () => {
  for (const [n, z] of Object.entries(fx.qq)) { const t = Norm.qqTheoretical(Number(n)); z.forEach((v, i) => near(t[i], v, 1e-9, `n=${n}, i=${i}`)); }
  // для точної прямої x = 5 + 2z опорна пряма має нахил 2 і зсув 5 (квантилі типу 7 дають ≈ точність до інтерполяції)
  const z = Norm.qqTheoretical(101), q = Norm.qq(z.map((v) => 5 + 2 * v));
  near(q.slope, 2, 0.05, "нахил"); near(q.intercept, 5, 0.05, "зсув");
});

test("крайні випадки", () => {
  assert.equal(Norm.shapiroWilk([1, 2]), null);
  assert.equal(Norm.shapiroWilk([4, 4, 4, 4]), null);
  assert.equal(Norm.chiSquare([1, 2, 3], 3, "prob"), null);
  assert.equal(Norm.chiSquare([2, 2, 2, 2], 5, "prob"), null);
  // задані μ і σ: df = K − 1
  assert.equal(Norm.chiSquare([0.1, -0.4, 1.2, 0.3, -1.1, 0.8, 0.0, -0.2], 5, "prob", { mu: 0, sigma: 1 }).df, 4);
});
