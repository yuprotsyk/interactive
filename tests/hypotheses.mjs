// Перевірка hypotheses.js зі scipy. Запуск: node --test tests/hypotheses.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
const Hyp = require("../hypotheses.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/hypotheses.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(a === b || Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);
const lim = (v, inf) => (v === null ? inf : v);

test(`критичні значення, потужність і p-значення звірені зі scipy ${fx.scipy}`, () => {
  for (const c of fx.cases) {
    const id = `${c.tail}, α=${c.alpha}, n=${c.n}`;
    const z = Hyp.critical(c.alpha, c.tail), m = Hyp.criticalMean(c.mu0, c.sigma, c.n, c.alpha, c.tail);
    near(z.lo, lim(c.z[0], -Infinity), 1e-8, id + " z lo"); near(z.hi, lim(c.z[1], Infinity), 1e-8, id + " z hi");
    near(m.lo, lim(c.mean[0], -Infinity), 1e-7, id + " x̄ lo"); near(m.hi, lim(c.mean[1], Infinity), 1e-7, id + " x̄ hi");
    for (const q of c.powers) near(Hyp.power(q.mu, c.mu0, c.sigma, c.n, c.alpha, c.tail), q.p, 1e-9, `${id}, μ=${q.mu} потужність`);
  }
  for (const q of fx.pvalues) near(Hyp.pValue(q.z, q.tail), q.p, 1e-9, `p-значення z=${q.z}, ${q.tail}`);
});

test("при μ = μ₀ потужність дорівнює α, а рішення збігається з порівнянням p і α", () => {
  for (const tail of ["two", "right", "left"]) for (const a of [0.01, 0.05, 0.1]) {
    near(Hyp.power(100, 100, 15, 25, a, tail), a, 1e-9, `${tail}, α=${a}`);
    for (const z of [-3, -1.7, -0.2, 0, 0.9, 1.7, 2.6]) {
      assert.equal(Hyp.reject(z, a, tail), Hyp.pValue(z, tail) < a, `${tail}, α=${a}, z=${z}`);
    }
  }
});

test("статистика, альтернатива й монотонність потужності", () => {
  near(Hyp.zStat(103, 100, 15, 25), 1, 1e-12, "z");
  assert.equal(Hyp.inAlternative(101, 100, "two"), true);
  assert.equal(Hyp.inAlternative(100, 100, "two"), false);
  assert.equal(Hyp.inAlternative(99, 100, "right"), false);
  assert.equal(Hyp.inAlternative(99, 100, "left"), true);
  let prev = 0;
  for (const n of [1, 4, 9, 25, 100, 400]) { const p = Hyp.power(105, 100, 15, n, 0.05, "right"); assert.ok(p > prev); prev = p; }
  assert.ok(Hyp.power(105, 100, 15, 25, 0.01, "two") < Hyp.power(105, 100, 15, 25, 0.1, "two"), "більший α: більша потужність");
  near(Hyp.power(110, 100, 15, 25, 0.05, "two") + 0, Hyp.power(90, 100, 15, 25, 0.05, "two"), 1e-12, "двостороння симетрична");
});

test(`біноміальний критерій: p-значення звірені зі scipy.stats.binomtest ${fx.scipy}`, () => {
  for (const c of fx.binom.pvalues) {
    const id = `n=${c.n}, k=${c.k}`;
    near(Hyp.binomPValue(c.n, c.k, "right"), c.right, 1e-12, id + " одностороння (правий хвіст)");
    near(Hyp.binomPValue(c.n, c.k, "left"), c.left, 1e-12, id + " одностороння (лівий хвіст)");
    near(Hyp.binomPValue(c.n, c.k, "two"), c.two, 1e-12, id + " двостороння");
  }
});

test("біноміальний критерій: числа з лекції (Бонд, Пауль)", () => {
  near(Hyp.binomPValue(16, 12, "right"), 0.0384, 5e-5, "12 із 16, одностороння");
  near(Hyp.binomPValue(16, 11, "right"), 0.1051, 5e-5, "11 із 16, одностороння");
  near(Hyp.binomPValue(16, 12, "two"), 0.0768, 5e-5, "12 із 16, двостороння");
  near(Hyp.binomPValue(16, 13, "two"), 0.0213, 5e-5, "13 із 16, двостороння");
  near(Hyp.binomPValue(13, 11, "right"), 0.0112, 5e-5, "Пауль, 11 із 13");
});

test("біноміальний критерій: межа рішення й справжній рівень помилки I роду", () => {
  for (const c of fx.binom.critical) {
    const id = `n=${c.n}, α=${c.alpha}`;
    for (const alt of ["right", "two"]) {
      const r = Hyp.binomCritical(c.n, c.alpha, alt), e = c[alt];
      if (e === null) { assert.equal(r, null, id + " " + alt + ": відхилити неможливо"); continue; }
      assert.equal(r.k, e[0], id + " " + alt + ": k");
      near(r.size, e[1], 1e-12, id + " " + alt + ": ймовірність відхилити істинну H₀");
      assert.ok(r.size <= c.alpha + 1e-12, id + ": не більше α");
    }
    const l = Hyp.binomCritical(c.n, c.alpha, "left"), r = Hyp.binomCritical(c.n, c.alpha, "right");
    if (r === null) assert.equal(l, null); else { assert.equal(l.k, c.n - r.k, id + " ліва межа симетрична"); near(l.size, r.size, 1e-12, id + " ліва: розмір"); }
  }
  const r = Hyp.binomCritical(16, 0.05, "right");
  near(r.size, 0.0384, 5e-5, "n = 16, α = 0,05: справжній рівень 0,0384, а не 0,05");
});

test("біноміальний критерій: рішення збігається з p ≤ α, хвіст екстремальних значень", () => {
  for (const alt of ["right", "left", "two"]) for (const k of [0, 3, 8, 10, 12, 16]) {
    let s = 0;
    for (let j = 0; j <= 16; j++) if (Hyp.binomExtreme(16, k, j, alt)) s += Hyp.binomPmf(16, j);
    near(Math.min(1, s), Hyp.binomPValue(16, k, alt), 1e-12, `${alt}, k=${k}: сума екстремальних стовпчиків дорівнює p`);
  }
});
