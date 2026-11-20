// Випадкове блукання: повний перебір усіх шляхів і точний розв'язок із Python (tests/fixtures/walk.json).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
const Rand = require("../random.js");
const Walk = require("../walk.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/walk.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(a === b || Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

/** Усі шляхи довжини n з вагами p^(вгору)·q^(вниз). */
function enumerate(n, p, visit) {
  for (let mask = 0; mask < (1 << n); mask++) {
    const s = [0]; let w = 1;
    for (let i = 0; i < n; i++) { const up = (mask >> i) & 1; s.push(s[i] + (up ? 1 : -1)); w *= up ? p : 1 - p; }
    visit(s, w);
  }
}

test("положення після n кроків: перебір усіх шляхів", () => {
  for (const p of [0.5, 0.3, 0.7]) for (const n of [1, 2, 5, 10, 12]) {
    const acc = {};
    enumerate(n, p, (s, w) => { acc[s[n]] = (acc[s[n]] || 0) + w; });
    for (let j = -n; j <= n; j++) near(Walk.positionPmf(n, j, p), acc[j] || 0, 1e-12, `n=${n} j=${j} p=${p}`);
  }
});

test("закон арксинуса: P(L = 2k) = u₂ₖ·u₂ₘ₋₂ₖ збігається з перебором усіх шляхів", () => {
  for (const m of [1, 2, 3, 5, 7]) {
    const acc = new Array(m + 1).fill(0);
    enumerate(2 * m, 0.5, (s, w) => { acc[Walk.leadSteps(s) / 2] += w; });
    const th = Walk.arcsinePmf(m);
    for (let k = 0; k <= m; k++) near(th[k], acc[k], 1e-12, `m=${m} k=${k}`);
    near(th.reduce((a, b) => a + b, 0), 1, 1e-12, "сума ймовірностей");
  }
});

test("без повернень у нуль за 2m кроків: u₂ₘ", () => {
  for (const m of [1, 2, 4, 6]) {
    let c = 0;
    enumerate(2 * m, 0.5, (s, w) => { if (s.slice(1).every((x) => x !== 0)) c += w; });
    near(Walk.noReturn(m), c, 1e-12, `m=${m}`);
  }
  near(Walk.u(50) * Math.sqrt(Math.PI * 50), 1, 0.006, "u₂ₘ ≈ 1/√(πm)");
});

test("розорення гравця й тривалість: точний розв'язок системи (Fraction)", () => {
  for (const c of fx) {
    near(Walk.ruinProb(c.a, c.b, c.p), c.ruin, 1e-12, `ruin a=${c.a} b=${c.b} p=${c.p}`);
    near(Walk.duration(c.a, c.b, c.p), c.dur, 1e-9 * Math.max(1, c.dur), `dur a=${c.a} b=${c.b} p=${c.p}`);
  }
  assert.equal(Walk.ruinProb(0, 5, 0.5), 1);
  assert.equal(Walk.ruinProb(5, 0, 0.5), 0);
  near(Walk.ruinProb(100, 100, 0.4) + (1 - Walk.ruinProb(100, 100, 0.4)), 1, 1e-15, "сума");
  assert.ok(Number.isFinite(Walk.ruinProb(1000, 1000, 0.45)), "стійкість при великому N");
});

test("симуляція з зерном: розорення й час у плюсі близькі до теорії", () => {
  const rng = Rand.create(2026), R = 20000;
  let ruined = 0, steps = 0;
  for (let i = 0; i < R; i++) { const g = Walk.game(rng, 5, 7, 0.5, 100000); ruined += g.ruined ? 1 : 0; steps += g.steps; }
  const pr = Walk.ruinProb(5, 7, 0.5), se = Math.sqrt(pr * (1 - pr) / R);
  assert.ok(Math.abs(ruined / R - pr) < 4 * se, `розорення ${ruined / R} проти ${pr}`);
  assert.ok(Math.abs(steps / R - 35) < 1.0, `тривалість ${steps / R} проти 35`);
  const m = 10, th = Walk.arcsinePmf(m), cnt = new Array(m + 1).fill(0);
  for (let i = 0; i < R; i++) cnt[Walk.leadSteps(Walk.path(rng, 2 * m, 0.5)) / 2]++;
  for (let k = 0; k <= m; k++) assert.ok(Math.abs(cnt[k] / R - th[k]) < 4 * Math.sqrt(th[k] * (1 - th[k]) / R) + 1e-3, `k=${k}`);
});
