// Перевірка distributions.js. Запуск: node --test tests/dist.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
const Dist = require("../distributions.js");
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/scipy-dist.json", import.meta.url), "utf8"));

const num = (v) => (v === "inf" ? Infinity : v === "-inf" ? -Infinity : v);

function close(actual, expected, rel, abs, label) {
  expected = num(expected);
  if (expected === null) { assert.ok(actual === null || Number.isNaN(actual), `${label}: очікувано «не існує», отримано ${actual}`); return; }
  if (expected === Infinity) { assert.equal(actual, Infinity, `${label}: очікувано ∞, отримано ${actual}`); return; }
  assert.ok(Number.isFinite(actual), `${label}: отримано ${actual}, очікувано ${expected}`);
  const tol = abs + rel * Math.abs(expected);
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: отримано ${actual}, очікувано ${expected} (допуск ${tol})`);
}

test(`звірка зі scipy ${fixtures.scipy}: ${fixtures.cases.length} наборів параметрів`, () => {
  let points = 0;
  for (const c of fixtures.cases) {
    const D = Dist[c.dist];
    assert.ok(D, "немає розподілу " + c.dist);
    c.x.forEach((x, i) => {
      const label = `${c.name}, x=${x}`;
      const f = c.kind === "discrete" ? D.pmf(x, c.params) : D.pdf(x, c.params);
      close(f, c.f[i], 1e-9, 1e-14, label + " f");
      close(D.cdf(x, c.params), c.cdf[i], 1e-9, 1e-13, label + " F");
      points++;
    });
    // Стьюдента з ν = 1 (Коші): середнє не існує; scipy тут повертає inf, що математично хибно
    const mean = c.dist === "student" && c.params.nu === 1 ? null : c.mean;
    close(D.mean(c.params), mean, 1e-12, 1e-12, c.name + " середнє");
    close(D.variance(c.params), c.var, 1e-12, 1e-12, c.name + " дисперсія");
  }
  console.log(`  перевірено точок: ${points}`);
});

test("дискретні розподіли: сума ймовірностей дорівнює 1", () => {
  const cases = [
    ["binomial", { n: 60, p: 0.37 }], ["poisson", { lam: 12.5 }],
    ["hypergeometric", { N: 80, K: 25, n: 30 }], ["geometric", { p: 0.2 }],
  ];
  for (const [key, P] of cases) {
    const D = Dist[key], sup = D.support(P);
    const hi = Number.isFinite(sup[1]) ? sup[1] : 2000;
    let s = 0;
    for (let k = sup[0]; k <= hi; k++) s += D.pmf(k, P);
    assert.ok(Math.abs(s - 1) < 1e-9, `${key}: сума ${s}`);
  }
});

test("неперервні розподіли: щільність інтегрується в 1", () => {
  const cases = [
    ["normal", { mu: 1, sigma: 2 }, -20, 22], ["exponential", { lam: 0.7 }, 0, 80],
    ["uniform", { a: -1, b: 3 }, -1, 3], ["chisq", { k: 5 }, 0, 120],
    ["student", { nu: 4 }, -400, 400], ["fisher", { d1: 6, d2: 9 }, 0, 2000],
  ];
  for (const [key, P, a, b] of cases) {
    const D = Dist[key], n = 400000, h = (b - a) / n;
    let s = 0;
    for (let i = 0; i < n; i++) s += D.pdf(a + (i + 0.5) * h, P);
    const tol = key === "student" || key === "fisher" ? 5e-3 : 1e-5;
    assert.ok(Math.abs(s * h - 1) < tol, `${key}: інтеграл ${s * h}`);
  }
});

test("функція розподілу не спадає й лежить у [0, 1]", () => {
  const P = { nu: 3 };
  let prev = 0;
  for (let x = -50; x <= 50; x += 0.37) {
    const F = Dist.student.cdf(x, P);
    assert.ok(F >= prev - 1e-15 && F >= 0 && F <= 1);
    prev = F;
  }
});

test("квантилі: F(Q(p)) = p", () => {
  for (const [key, P] of [["normal", { mu: 2, sigma: 3 }], ["chisq", { k: 7 }], ["student", { nu: 2 }], ["fisher", { d1: 4, d2: 3 }], ["exponential", { lam: 2 }]]) {
    for (const p of [0.001, 0.2, 0.5, 0.9, 0.999]) {
      const x = Dist.quantile(Dist[key], P, p);
      assert.ok(Math.abs(Dist[key].cdf(x, P) - p) < 1e-9, `${key} p=${p}`);
    }
  }
  const k = Dist.quantileDiscrete(Dist.binomial, { n: 20, p: 0.5 }, 0.5);
  assert.equal(k, 10);
});

test("гіпергеометричний розподіл при N = 1: дисперсія 0 (scipy тут дає nan через 0/0)", () => {
  assert.equal(Dist.hypergeometric.variance({ N: 1, K: 1, n: 1 }), 0);
  assert.ok(Math.abs(Dist.hypergeometric.pmf(1, { N: 1, K: 1, n: 1 }) - 1) < 1e-12);
  assert.equal(Dist.student.mean({ nu: 1 }), null);
});

test("відомі значення", () => {
  const z = { mu: 0, sigma: 1 };
  assert.ok(Math.abs(Dist.normal.cdf(0, z) - 0.5) < 1e-15);
  assert.ok(Math.abs(Dist.normal.cdf(1.959963984540054, z) - 0.975) < 1e-12);
  assert.ok(Math.abs(Dist.chisq.cdf(3.841458820694124, { k: 1 }) - 0.95) < 1e-12);
  assert.ok(Math.abs(Dist.student.cdf(2.2281388519649385, { nu: 10 }) - 0.975) < 1e-12);
  assert.ok(Math.abs(Dist.fisher.cdf(4.964602743730711, { d1: 1, d2: 10 }) - 0.95) < 1e-12);
  assert.ok(Math.abs(Dist.binomial.pmf(5, { n: 10, p: 0.5 }) - 252 / 1024) < 1e-14);
});

test("critical і meanCI: критичні значення й інтервал збігаються зі scipy", () => {
  const rel = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
  rel(Dist.critical("t", 0.95, 9), 2.262157162798205);
  rel(Dist.critical("t", 0.99, 2), 9.924843200918287);
  rel(Dist.critical("t", 0.8, 29), 1.311433647301551);
  rel(Dist.critical("z", 0.95), 1.959963984540054);
  rel(Dist.critical("z", 0.8), 1.2815515655446004);
  rel(Dist.critical("z", 0.99), 2.5758293035489004);
  const x = [4.1, 5.3, 6.2, 5.8, 4.9, 5.5, 6.0, 5.1];
  const ci = Dist.meanCI(x, 0.95, "t");
  rel(ci.mean, 5.3625); rel(ci.s, 0.6759913355319621); rel(ci.lo, 4.797357100654869); rel(ci.hi, 5.9276428993451304);
  const z = Dist.meanCI(x, 0.95, "z", { sigma: 0.7 });
  rel(z.half, 1.959963984540054 * 0.7 / Math.sqrt(8));
  assert.equal(Dist.meanCI([1], 0.95, "t"), null);
  const one = Dist.meanCI([3], 0.95, "z", { sigma: 2 }); rel(one.lo, 3 - 1.959963984540054 * 2);
  const zs = Dist.meanCI(x, 0.95, "zs"); assert.ok(zs.half < ci.half);
});
