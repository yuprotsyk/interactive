// Перевірка probability.js. Запуск: node --test tests/prob.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Prob = require("../probability.js");
const Rand = require("../random.js");
const close = (a, b, e = 1e-12) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const sum = (a) => a.reduce((p, v) => p + v, 0);

test("setWeight: сума 1, решта масштабується пропорційно, межі 0 і 1", () => {
  const w = [0.5, 0.3, 0.2];
  const r = Prob.setWeight(w, 0, 0.8);
  close(sum(r), 1); close(r[0], 0.8); close(r[1] / r[2], 1.5);
  const z = Prob.setWeight(w, 1, 1);
  close(z[0], 0); close(z[2], 0); close(z[1], 1);
  const back = Prob.setWeight(z, 1, 0.4);        // решта була нулями: ділимо порівну
  close(sum(back), 1); close(back[0], 0.3); close(back[2], 0.3);
  const o = Prob.setWeight([0.5, 0.5], 0, 2);     // за межами обрізається
  close(o[0], 1); close(o[1], 0);
});

test("resize: збільшення й зменшення зберігають суму 1", () => {
  for (const [w, k] of [[[0.6, 0.4], 3], [[0.6, 0.4], 4], [[0.5, 0.3, 0.2], 2], [[0.5, 0.3, 0.2, 0], 3], [[1, 0, 0], 2]]) {
    const r = Prob.resize(w, k);
    assert.equal(r.length, k); close(sum(r), 1);
    assert.ok(r.every((x) => x >= 0));
  }
  const g = Prob.resize([0.6, 0.4], 3);
  close(g[2], 1 / 3); close(g[0] / g[1], 1.5);
});

test("повна ймовірність: три заводи", () => {
  close(Prob.total([0.5, 0.3, 0.2], [0.02, 0.03, 0.05]), 0.029);
  close(Prob.total([0.5, 0.5], [1, 0]), 0.5);
});

test("Байєс: медичний тест 1 %, чутливість 0,9, хибнопозитивні 0,09", () => {
  const p = Prob.posterior([0.01, 0.99], [0.9, 0.09], true);
  close(p[0], 0.009 / (0.009 + 0.0891)); close(p[0], 0.0917431, 1e-6);
  const n = Prob.posterior([0.01, 0.99], [0.9, 0.09], false);
  close(n[0], 0.001 / (0.001 + 0.9009));
  close(sum(p), 1); close(sum(n), 1);
});

test("Байєс: Монті Голл дає 1/3 і 2/3", () => {
  const p = Prob.posterior([1 / 3, 1 / 3, 1 / 3], [0.5, 1, 0], true);
  close(p[0], 1 / 3); close(p[1], 2 / 3); close(p[2], 0);
});

test("Байєс: неможлива подія дає null; тотожність P(H|A)·P(A) = P(A|H)·P(H)", () => {
  assert.equal(Prob.posterior([0.5, 0.5], [0, 0], true), null);
  const prior = [0.2, 0.5, 0.3], lik = [0.7, 0.1, 0.4], pa = Prob.total(prior, lik);
  const post = Prob.posterior(prior, lik, true);
  post.forEach((x, i) => close(x * pa, lik[i] * prior[i]));
});

test("послідовність: збігається з одноразовим обчисленням за добутком правдоподібностей", () => {
  const prior = [0.01, 0.99], lik = [0.9, 0.09];
  const seq = Prob.sequence(prior, lik, [true, true, false]);
  assert.equal(seq.length, 4);
  close(seq[0][0], 0.01);
  const num = [0.01 * 0.9 * 0.9 * 0.1, 0.99 * 0.09 * 0.09 * 0.91];
  close(seq[3][0], num[0] / (num[0] + num[1]), 1e-12);
  seq.forEach((s) => close(sum(s), 1));
  // порядок результатів не має значення
  const a = Prob.sequence(prior, lik, [true, false, true])[3], b = Prob.sequence(prior, lik, [false, true, true])[3];
  close(a[0], b[0]);
});

test("counts: сума рівно N, a ≤ h, пропорції близькі до теорії", () => {
  for (const prior of [[0.01, 0.99], [0.5, 0.3, 0.2], [1 / 3, 1 / 3, 1 / 3], [0.001, 0.999], [0.25, 0.25, 0.25, 0.25]]) {
    const lik = prior.map((_, i) => [0.9, 0.09, 0.4, 0.5][i]);
    const c = Prob.counts(prior, lik, 1000);
    assert.equal(sum(c.h), 1000);
    c.h.forEach((n, i) => { assert.ok(c.a[i] <= n && c.a[i] >= 0); assert.ok(Math.abs(n - prior[i] * 1000) < 1); });
  }
  const c = Prob.counts([0.01, 0.99], [0.9, 0.09], 1000);
  assert.deepEqual(c.h, [10, 990]); assert.deepEqual(c.a, [9, 89]);
});

test("симуляція підтверджує формулу Байєса", () => {
  const prior = [0.3, 0.5, 0.2], lik = [0.8, 0.2, 0.5], r = Rand.create(21);
  const hit = [0, 0, 0]; let tot = 0;
  for (let i = 0; i < 400000; i++) {
    const u = r.next(); const h = u < 0.3 ? 0 : u < 0.8 ? 1 : 2;
    if (r.next() < lik[h]) { hit[h]++; tot++; }
  }
  const post = Prob.posterior(prior, lik, true);
  post.forEach((p, i) => assert.ok(Math.abs(hit[i] / tot - p) < 0.01, `${i}: ${hit[i] / tot} vs ${p}`));
  close(tot / 400000, Prob.total(prior, lik), 0.005);
});
