// Перевірка montecarlo.js: точні значення за scipy, накопичувач за numpy, властивості оцінок симуляцією.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
globalThis.Rand = require("../random.js");
const Mc = require("../montecarlo.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/montecarlo.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

test("точні I = ∫f, ∫f² і дисперсія збігаються зі scipy.quad", () => {
  for (const fn of Mc.FUNCS) {
    const r = fx.funcs[fn.id];
    near(fn.I, r.I, 1e-12, fn.id + " I");
    if (fn.m2 === Infinity) { assert.equal(r.m2, null); assert.equal(Mc.varMean(fn), Infinity); continue; }
    near(fn.m2, r.m2, 1e-12, fn.id + " ∫f²"); near(Mc.varMean(fn), r.varMean, 1e-12, fn.id + " σ²");
  }
});

test("інтеграли й ∫f² збігаються з числовим інтегруванням Сімпсона", () => {
  for (const fn of Mc.FUNCS) {
    if (fn.id === "invsqrt") continue;
    const N = 200000, h = (fn.b - fn.a) / N; let s1 = 0, s2 = 0;
    for (let i = 0; i <= N; i++) { const w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2, y = fn.f(fn.a + i * h); s1 += w * y; s2 += w * y * y; }
    near(s1 * h / 3, fn.I, 1e-8, fn.id + " ∫f"); near(s2 * h / 3, fn.m2, 1e-8, fn.id + " ∫f²");
  }
});

test("накопичувач Велфорда збігається з numpy", () => {
  for (const c of fx.acc) {
    const a = Mc.acc(); c.v.forEach((v) => Mc.add(a, v));
    near(a.mean, c.mean, 1e-10, "середнє"); near(Mc.sd(a), c.sd, 1e-10, "sd"); near(Mc.se(a), c.se, 1e-10, "se");
  }
  assert.equal(Mc.sd(Mc.add(Mc.acc(), 4)), null); assert.equal(Mc.ci(Mc.acc(), 0.95), null);
});

test("точна дисперсія методу влучання не менша, ніж середнього значення (для обмежених f)", () => {
  for (const fn of Mc.FUNCS) {
    if (fn.M === null) { assert.equal(Mc.varHit(fn), null); continue; }
    assert.ok(Mc.varMean(fn) <= Mc.varHit(fn) + 1e-12, fn.id);
  }
});

test("оцінки незміщені, а вибіркова дисперсія доданка збігається з точною", () => {
  for (const id of ["sin", "sq", "gauss", "circle", "atan"]) for (const method of ["mean", "hit"]) {
    const fn = Mc.byId(id), rng = Rand.create(11), a = Mc.acc(), n = 300000;
    for (let i = 0; i < n; i++) Mc.add(a, Mc.draw(fn, method, rng).v);
    const exact = method === "hit" ? Mc.varHit(fn) : Mc.varMean(fn);
    near(a.mean, fn.I, 5 * Math.sqrt(exact / n), `${id}/${method}: середнє`);
    near(Mc.sd(a) ** 2, exact, 0.03 * exact, `${id}/${method}: σ²`);
  }
});

test("довірчий інтервал Î ± z·s/√n накриває I приблизно у 95 % випадків", () => {
  const fn = Mc.byId("gauss"); let cover = 0, R = 1000; const rng = Rand.create(21);
  for (let r = 0; r < R; r++) {
    const a = Mc.acc(); for (let i = 0; i < 400; i++) Mc.add(a, Mc.draw(fn, "mean", rng).v);
    const c = Mc.ci(a, 0.95); if (c[0] <= fn.I && fn.I <= c[1]) cover++;
  }
  near(cover / R, 0.95, 0.025, "покриття");
});

test("випробування: x у (a; b], y у (0; M], відтворюваність, 1/√x не дає Infinity, точна se", () => {
  const rng = Rand.create(3);
  for (const fn of Mc.FUNCS) for (let i = 0; i < 2000; i++) {
    const d = Mc.draw(fn, fn.M === null ? "mean" : "hit", rng);
    assert.ok(d.x > fn.a && d.x <= fn.b); assert.ok(Number.isFinite(d.v));
    if (fn.M !== null) assert.ok(d.y > 0 && d.y <= fn.M);
  }
  const A = Mc.draw(Mc.byId("sq"), "mean", Rand.create(1)), B = Mc.draw(Mc.byId("sq"), "mean", Rand.create(1));
  assert.deepEqual(A, B);
  near(Mc.seExact(Mc.byId("sq"), "mean", 100), Math.sqrt(0.0888888888888889 / 100), 1e-12, "se");
  assert.equal(Mc.seExact(Mc.byId("invsqrt"), "mean", 100), null); assert.equal(Mc.seExact(Mc.byId("invsqrt"), "hit", 100), null);
});
