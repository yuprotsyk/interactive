// Перевірка random.js. Запуск: node --test tests/random.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
const Dist = require("../distributions.js");
const Rand = require("../random.js");

/** Статистика Колмогорова–Смирнова: найбільша відстань між емпіричною та теоретичною F. */
function ks(sample, cdf) {
  const xs = [...sample].sort((a, b) => a - b), n = xs.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const F = cdf(xs[i]);
    d = Math.max(d, Math.abs(F - i / n), Math.abs(F - (i + 1) / n));
  }
  return d;
}
const N = 20000;
// критичне значення при рівні 1 %: 1,63 / √n
const KS_CRIT = 1.63 / Math.sqrt(N);

function draw(seed, f) {
  const r = Rand.create(seed);
  return Array.from({ length: N }, () => f(r));
}

test("той самий seed дає ту саму послідовність, різні дають різні", () => {
  const a = Rand.create(7), b = Rand.create(7), c = Rand.create(8);
  const sa = Array.from({ length: 50 }, () => a.next());
  const sb = Array.from({ length: 50 }, () => b.next());
  const sc = Array.from({ length: 50 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
});

test("next() лежить у [0, 1) і має середнє 1/2, дисперсію 1/12", () => {
  const s = draw(1, (r) => r.next());
  assert.ok(s.every((v) => v >= 0 && v < 1));
  const m = s.reduce((p, v) => p + v, 0) / N;
  const v = s.reduce((p, x) => p + (x - m) ** 2, 0) / N;
  assert.ok(Math.abs(m - 0.5) < 0.01, "середнє " + m);
  assert.ok(Math.abs(v - 1 / 12) < 0.003, "дисперсія " + v);
  assert.ok(ks(s, (x) => x) < KS_CRIT);
});

test("нормальний розподіл: KS проти Dist.normal", () => {
  const s = draw(2, (r) => r.normal());
  const d = ks(s, (x) => Dist.normal.cdf(x, { mu: 0, sigma: 1 }));
  assert.ok(d < KS_CRIT, `D = ${d} ≥ ${KS_CRIT}`);
});

test("показниковий розподіл: KS проти Dist.exponential", () => {
  for (const rate of [1, 2.5]) {
    const s = draw(3, (r) => r.exp(rate));
    assert.ok(s.every((v) => v >= 0));
    const d = ks(s, (x) => Dist.exponential.cdf(x, { lam: rate }));
    assert.ok(d < KS_CRIT, `rate ${rate}: D = ${d}`);
  }
});

test("Коші: KS проти Dist.student(ν = 1)", () => {
  const s = draw(4, (r) => r.cauchy());
  const d = ks(s, (x) => Dist.student.cdf(x, { nu: 1 }));
  assert.ok(d < KS_CRIT, `D = ${d}`);
});

test("кубик (int) і монета (bernoulli): частоти", () => {
  const r = Rand.create(5), counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 60000; i++) counts[r.int(6)]++;
  counts.forEach((c) => assert.ok(Math.abs(c / 60000 - 1 / 6) < 0.01, "частоти " + counts));
  const q = Rand.create(6);
  let heads = 0;
  for (let i = 0; i < 60000; i++) heads += q.bernoulli(0.3);
  assert.ok(Math.abs(heads / 60000 - 0.3) < 0.01);
});

test("серії за seedFor незалежні: кореляція близька до нуля", () => {
  const a = Rand.create(Rand.seedFor(2026, 0)), b = Rand.create(Rand.seedFor(2026, 1));
  const xs = [], ys = [];
  for (let i = 0; i < N; i++) { xs.push(a.normal()); ys.push(b.normal()); }
  const r = Stat.pearson(xs, ys);
  assert.ok(Math.abs(r) < 0.03, "r = " + r);
  assert.notEqual(Rand.seedFor(2026, 0), Rand.seedFor(2026, 1));
});

test("середнє середніх: закон великих чисел на практиці", () => {
  const r = Rand.create(9);
  let s = 0;
  const n = 200000;
  for (let i = 0; i < n; i++) s += r.exp(1);
  assert.ok(Math.abs(s / n - 1) < 0.01, "середнє " + s / n);
});
