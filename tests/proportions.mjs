// Перевірка критеріїв для часток (hypotheses.js) за scipy. Запуск: node --test tests/proportions.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
const Hyp = require("../hypotheses.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/proportions.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

test(`одна частка: z, p-значення й точний біноміальний p збігаються зі scipy ${fx.scipy}`, () => {
  for (const c of fx.one) {
    const id = `n=${c.n}, x=${c.x}, p0=${c.p0}`;
    for (const tail of ["two", "right", "left"]) {
      const r = Hyp.propZ(c.x, c.n, c.p0, tail);
      near(r.phat, c.phat, 1e-12, id + " p̂"); near(r.se, c.se, 1e-12, id + " se"); near(r.z, c.z, 1e-10, id + " z");
      near(r.p, c["p_" + tail], 1e-9, id + " p " + tail);
      near(Hyp.propExactP(c.x, c.n, c.p0, tail), c["exact_" + tail], 1e-9, id + " точний " + tail);
    }
  }
});

test("точний критерій при p₀ = ½ збігається з binomPValue", () => {
  for (const [n, k] of [[16, 12], [20, 5], [13, 11], [40, 20]])
    for (const alt of ["right", "left", "two"]) near(Hyp.propExactP(k, n, 0.5, alt), Hyp.binomPValue(n, k, alt), 1e-12, `n=${n}, k=${k}, ${alt}`);
});

test(`дві частки: z, p-значення, інтервал Вальда; z² дорівнює хі-квадрат Пірсона (scipy ${fx.scipy})`, () => {
  for (const c of fx.two) {
    const id = `${c.x1}/${c.n1} проти ${c.x2}/${c.n2}`;
    for (const tail of ["two", "right", "left"]) {
      const r = Hyp.twoPropZ(c.x1, c.n1, c.x2, c.n2, tail);
      near(r.pooled, c.pooled, 1e-12, id + " p̂"); near(r.se, c.se, 1e-12, id + " se"); near(r.z, c.z, 1e-10, id + " z");
      near(r.p, c["p_" + tail], 1e-9, id + " p " + tail);
    }
    const ci95 = Hyp.twoPropCI(c.x1, c.n1, c.x2, c.n2, 0.95), ci90 = Hyp.twoPropCI(c.x1, c.n1, c.x2, c.n2, 0.9);
    near(ci95[0], c.ci95[0], 1e-8, id + " CI95 lo"); near(ci95[1], c.ci95[1], 1e-8, id + " CI95 hi");
    near(ci90[0], c.ci90[0], 1e-8, id + " CI90 lo"); near(ci90[1], c.ci90[1], 1e-8, id + " CI90 hi");
  }
});

test("крайні випадки: недопустимий вхід, p₁ = p₂ = 0, орієнтир npq ≥ 10", () => {
  assert.equal(Hyp.propZ(5, 0, 0.5, "two"), null);
  assert.equal(Hyp.propZ(11, 10, 0.5, "two"), null);
  assert.equal(Hyp.propZ(5, 10, 0, "two"), null);
  assert.equal(Hyp.propZ(5, 10, 1, "two"), null);
  assert.equal(Hyp.twoPropZ(1, 0, 2, 5, "two"), null);
  const z0 = Hyp.twoPropZ(0, 10, 0, 12, "two");
  assert.equal(z0.z, null); assert.equal(z0.p, null);
  assert.equal(Hyp.twoPropCI(3, 10, 4, 5, 0.95).length, 2);
  assert.equal(Hyp.propRuleOk(40, 0.5), true); assert.equal(Hyp.propRuleOk(39, 0.5), false);
  assert.equal(Hyp.twoPropRuleOk(10, 20, 10, 20), true); assert.equal(Hyp.twoPropRuleOk(9, 20, 10, 20), false); assert.equal(Hyp.twoPropRuleOk(10, 20, 10, 19), false);
  near(Hyp.propZ(50, 100, 0.5, "two").p, 1, 1e-12, "p̂ = p₀: p = 1");
});
