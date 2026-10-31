// Перевірка approximations.js зі scipy. Запуск: node --test tests/approx.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
const Approx = require("../approximations.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/approx.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

test(`наближення Bin(n, p) звірені зі scipy ${fx.scipy}`, () => {
  for (const c of fx.cases) {
    const id = `n=${c.n}, p=${c.p}`;
    c.ks.forEach((k, i) => {
      near(Approx.exactPmf(c.n, c.p, k), c.exactPmf[i], 1e-12, id + " точна pmf");
      near(Approx.localNormal(c.n, c.p, k), c.localNormal[i], 1e-12, id + " локальна теорема");
      near(Approx.poissonPmf(c.n * c.p, k), c.poissonPmf[i], 1e-12, id + " Пуассон");
    });
    near(Approx.exactProb(c.n, c.p, c.a, c.b), c.exactProb, 1e-10, id + " точна ймовірність");
    near(Approx.normalProb(c.n, c.p, c.a, c.b, true), c.normalCC, 1e-10, id + " Лаплас з поправкою");
    near(Approx.normalProb(c.n, c.p, c.a, c.b, false), c.normalNoCC, 1e-10, id + " Лаплас без поправки");
    near(Approx.poissonProb(c.n * c.p, c.a, c.b), c.poissonProb, 1e-10, id + " Пуассон, подія");
    near(Approx.tvNormal(c.n, c.p), c.tvNormal, 1e-9, id + " відстань, Лаплас");
    near(Approx.tvPoisson(c.n, c.p), c.tvPoisson, 1e-9, id + " відстань, Пуассон");
  }
});

test("відомі властивості: поправка на неперервність зменшує похибку; Пуассон гірший при великому p", () => {
  // n = 40, p = 0,5: npq = 10
  const ex = Approx.exactProb(40, 0.5, 15, 25);
  assert.ok(Math.abs(Approx.normalProb(40, 0.5, 15, 25, true) - ex) < Math.abs(Approx.normalProb(40, 0.5, 15, 25, false) - ex));
  // n = 100, p = 0,3 (np = 30): нормальне набагато краще за Пуассона
  assert.ok(Approx.tvNormal(100, 0.3) < Approx.tvPoisson(100, 0.3) / 3);
  // n = 200, p = 0,01 (λ = 2): Пуассон набагато краще за нормальне
  assert.ok(Approx.tvPoisson(200, 0.01) < Approx.tvNormal(200, 0.01) / 3);
});

test("крайні випадки без NaN: σ = 0 і вікно графіка", () => {
  assert.equal(Approx.localNormal(10, 0, 0), null);
  assert.equal(Approx.normalProb(10, 1, 0, 10, true), null);
  assert.equal(Approx.tvNormal(10, 0), null);
  for (const [n, p] of [[1, 0.5], [3, 0.001], [1000, 0.999], [50, 0.02]]) {
    const w = Approx.window(n, p);
    assert.ok(w[0] >= 0 && w[1] <= n && w[0] <= w[1], `вікно ${n} ${p}: ${w}`);
    assert.ok(Number.isFinite(Approx.tvPoisson(n, p)));
  }
  assert.deepEqual(Approx.rules(40, 0.5), { npq: 10, laplace: true, poisson: false });
});
