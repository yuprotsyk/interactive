// Перевірка geometry.js: формули зі scipy, будова хорд Бертрана, відтворюваність. Запуск: node --test tests/geometry.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const Geom = require("../geometry.js");
const Rand = require("../random.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/geometry.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);

test(`точні ймовірності звірені зі scipy ${fx.scipy}`, () => {
  for (const c of fx.meeting) near(Geom.meetingProb(c.T, c.tau), c.p, 1e-9, `зустріч T=${c.T}, τ=${c.tau}`);
  for (const c of fx.buffon) near(Geom.buffonProb(c.l, c.d), c.p, 1e-9, `Бюффон l=${c.l}, d=${c.d}`);
  for (const c of fx.circle) near(Geom.circleProb(c.r), c.p, 1e-9, `круг r=${c.r}`);
  near(Geom.quarterProb(), fx.quarter, 1e-9, "чверть круга");
});

test("крайні й недопустимі значення", () => {
  assert.equal(Geom.meetingProb(60, 0), 0);
  assert.equal(Geom.meetingProb(60, 60), 1);
  assert.equal(Geom.meetingProb(0, 1), null);
  assert.equal(Geom.buffonProb(2, 1), null, "l > d не підтримується");
  assert.equal(Geom.buffonProb(1, 0), null);
  assert.equal(Geom.circleProb(0), 0);
  assert.equal(Geom.bertrandProb(4), null);
  assert.equal(Geom.piFromBuffon(1, 1, 0, 100), null);
  assert.equal(Geom.piFromQuarter(0, 0), null);
  assert.equal(Geom.se(0.5, 0), null);
});

test("Бертран: точні значення 1/3, 1/2, 1/4", () => {
  assert.equal(Geom.bertrandProb(1), 1 / 3);
  assert.equal(Geom.bertrandProb(2), 1 / 2);
  assert.equal(Geom.bertrandProb(3), 1 / 4);
});

test("Бертран: хорда лежить на колі, середина перпендикулярна до хорди", () => {
  const rng = Rand.create(7);
  for (const m of [1, 2, 3]) for (let i = 0; i < 500; i++) {
    const c = Geom.bertrandChord(m, rng.next(), rng.next());
    near(Math.hypot(c.x1, c.y1), 1, 1e-12, `спосіб ${m}: кінець 1 на колі`);
    near(Math.hypot(c.x2, c.y2), 1, 1e-12, `спосіб ${m}: кінець 2 на колі`);
    near((c.x1 + c.x2) / 2, c.mx, 1e-12, "середина x");
    near((c.y1 + c.y2) / 2, c.my, 1e-12, "середина y");
    // довжина хорди = 2√(1 − |m|²)
    near(c.len, 2 * Math.sqrt(Math.max(0, 1 - c.mx * c.mx - c.my * c.my)), 1e-9, `спосіб ${m}: довжина`);
  }
});

test("Бертран: частка довгих хорд на густій сітці (u, v) збігається з точним значенням", () => {
  const N = 800;
  for (const m of [1, 2, 3]) {
    let k = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (Geom.bertrandChord(m, (i + .5) / N, (j + .5) / N).long) k++;
    }
    near(k / (N * N), Geom.bertrandProb(m), 3e-3, `спосіб ${m}`);
  }
});

test("симуляція з зерном збігається з точним значенням у межах 5σ і відтворюється", () => {
  const N = 40000;
  function run(seed) {
    const r = Rand.create(seed);
    const h = { circle: 0, quarter: 0, meet: 0, buffon: 0 };
    for (let i = 0; i < N; i++) {
      const x = r.next(), y = r.next();
      if (Geom.circleHit(0.3, x, y)) h.circle++;
      if (Geom.quarterHit(x, y)) h.quarter++;
      if (Geom.meetingHit(15, x * 60, y * 60)) h.meet++;
      if (Geom.buffonHit(0.5, x / 2, y * Math.PI / 2)) h.buffon++;
    }
    return h;
  }
  const h = run(2026), again = run(2026);
  assert.deepEqual(h, again, "той самий seed дає той самий результат");
  const cases = [["circle", Geom.circleProb(0.3)], ["quarter", Geom.quarterProb()],
    ["meet", Geom.meetingProb(60, 15)], ["buffon", Geom.buffonProb(0.5, 1)]];
  for (const [k, p] of cases) near(h[k] / N, p, 5 * Geom.se(p, N), k);
  const est = Geom.piFromQuarter(h.quarter, N);
  near(est, Math.PI, 0.05, "оцінка π за чвертю круга");
  near(Geom.piFromBuffon(0.5, 1, h.buffon, N), Math.PI, 0.15, "оцінка π за голкою");
});
