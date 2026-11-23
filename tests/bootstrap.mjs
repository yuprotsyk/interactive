// Перевірка bootstrap.js. Запуск: node --test tests/bootstrap.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
globalThis.Rand = require("../random.js");
const Boot = require("../bootstrap.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/bootstrap.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

test(`квантилі, процентильні інтервали й стандартна похибка збігаються з numpy ${fx.numpy}`, () => {
  for (const c of fx.cases) {
    const s = c.stats.slice().sort((a, b) => a - b);
    for (const [p, v] of Object.entries(c.q)) near(Boot.quantileSorted(s, Number(p)), v, 1e-10, `q${p}, B=${c.stats.length}`);
    for (const [lev, key] of [[0.95, "ci95"], [0.9, "ci90"], [0.99, "ci99"]]) {
      const ci = Boot.percentileCI(c.stats, lev);
      near(ci[0], c[key][0], 1e-10, `${key} lo`); near(ci[1], c[key][1], 1e-10, `${key} hi`);
    }
    near(Boot.se(c.stats), c.se, 1e-10, `se, B=${c.stats.length}`);
  }
});

test("середнє й медіана збігаються з numpy", () => {
  for (const c of fx.stats) { near(Boot.stat(c.v, "median"), c.median, 1e-12, "медіана " + c.v); near(Boot.stat(c.v, "mean"), c.mean, 1e-12, "середнє " + c.v); }
});

test("перевибірка: індекси в межах, сума повторів = n, відтворюється за зерном", () => {
  const rng = Rand.create(7), n = 25;
  for (let k = 0; k < 200; k++) {
    const idx = Boot.indices(n, rng), c = Boot.counts(n, idx);
    assert.equal(idx.length, n); assert.ok(idx.every((i) => Number.isInteger(i) && i >= 0 && i < n));
    assert.equal(c.reduce((s, v) => s + v, 0), n);
  }
  const a = Boot.run([1, 2, 3, 4, 5, 9], "mean", 50, Rand.create(11)), b = Boot.run([1, 2, 3, 4, 5, 9], "mean", 50, Rand.create(11));
  assert.deepEqual(a, b);
});

test("властивості бутстреп-розподілу: центр біля x̄, se біля s/√n·√((n−1)/n), частка потрапляння ≈ 1 − 1/e", () => {
  const x = Rand.create(3), data = Array.from({ length: 40 }, () => 50 + 10 * x.normal());
  const n = data.length, m = Boot.stat(data, "mean");
  const s = Math.sqrt(data.reduce((t, v) => t + (v - m) ** 2, 0) / (n - 1));
  const st = Boot.run(data, "mean", 20000, Rand.create(5));
  near(st.reduce((t, v) => t + v, 0) / st.length, m, 0.1, "центр");
  // для середнього теоретичне значення бутстреп-se: sqrt((n − 1)/n)·s/√n
  near(Boot.se(st), Math.sqrt((n - 1) / n) * s / Math.sqrt(n), 0.03, "se");
  let inSample = 0, trials = 4000; const rng = Rand.create(9);
  for (let t = 0; t < trials; t++) { const c = Boot.counts(n, Boot.indices(n, rng)); inSample += c.filter((v) => v > 0).length / n; }
  near(inSample / trials, 1 - Math.pow(1 - 1 / n, n), 0.01, "частка спостережень у перевибірці");
});

test("крайні випадки: порожній масив, B = 1, всі значення однакові, n = 1", () => {
  assert.equal(Boot.percentileCI([], 0.95), null); assert.equal(Boot.se([1]), null); assert.equal(Boot.quantileSorted([], 0.5), null);
  const st = Boot.run([4, 4, 4], "median", 10, Rand.create(1));
  assert.ok(st.every((v) => v === 4)); assert.equal(Boot.se(st), 0); assert.equal(Boot.distinct(st), 1);
  assert.deepEqual(Boot.run([7], "mean", 3, Rand.create(1)), [7, 7, 7]);
});
