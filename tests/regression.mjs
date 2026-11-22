// Перевірка regression.js за numpy/scipy. Запуск: node --test tests/regression.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
globalThis.Stat = require("../common.js");
globalThis.Dist = require("../distributions.js");
const Reg = require("../regression.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/regression.json", import.meta.url), "utf8"));
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} проти ${b}`);
const pts = (c) => c.pts.map(([x, y]) => ({ x, y }));

test(`нахил, вільний член, R², похибки, залишки, важіль і відстань Кука збігаються зі scipy ${fx.scipy}`, () => {
  for (const c of fx.cases) {
    const m = Reg.fit(pts(c)), id = c.name;
    near(m.b, c.b, 1e-10, id + " b"); near(m.a, c.a, 1e-10, id + " a"); near(m.r2, c.r2, 1e-10, id + " R²");
    near(m.s, c.s, 1e-10, id + " s"); near(m.seB, c.seB, 1e-10, id + " se(b)"); near(m.seA, c.seA, 1e-10, id + " se(a)");
    near(m.sse, c.sse, 1e-9, id + " SSE"); near(m.sst, c.sst, 1e-9, id + " SST");
    const ci = Reg.slopeCI(m, 0.95);
    near(ci[0], c.ciB[0], 1e-6, id + " CI lo"); near(ci[1], c.ciB[1], 1e-6, id + " CI hi");
    for (let i = 0; i < c.n; i++) {
      near(m.res[i], c.res[i], 1e-10, `${id} e${i}`); near(m.h[i], c.h[i], 1e-10, `${id} h${i}`);
      near(m.stdres[i], c.stdres[i], 1e-8, `${id} r${i}`); near(m.cook[i], c.cook[i], 1e-8, `${id} D${i}`);
    }
    const w = Reg.without(pts(c), c.without.i);
    near(w.b, c.without.b, 1e-10, id + " b без точки"); near(w.a, c.without.a, 1e-10, id + " a без точки");
    near(w.r2, c.without.r2, 1e-10, id + " R² без точки");
  }
});

test("властивості: Σe = 0, Σh = 2, SST = SSR + SSE, R² дорівнює r² Пірсона", () => {
  for (const c of fx.cases) {
    const m = Reg.fit(pts(c));
    near(m.res.reduce((s, v) => s + v, 0), 0, 1e-9, "Σe");
    near(m.h.reduce((s, v) => s + v, 0), 2, 1e-9, "Σh");
    near(m.sst, m.ssr + m.sse, 1e-9, "SST");
    const r = Stat.pearson(pts(c).map((p) => p.x), pts(c).map((p) => p.y));
    near(m.r2, r * r, 1e-10, "R² = r²");
  }
});

test("крайні випадки: n < 2, однакові x, n = 2, однакові y, точна пряма", () => {
  assert.equal(Reg.fit([]), null);
  assert.equal(Reg.fit([{ x: 1, y: 2 }]), null);
  assert.equal(Reg.fit([{ x: 3, y: 1 }, { x: 3, y: 5 }]), null);
  const two = Reg.fit([{ x: 0, y: 1 }, { x: 2, y: 5 }]);
  near(two.b, 2, 1e-12, "b"); near(two.a, 1, 1e-12, "a");
  assert.equal(two.s, null); assert.equal(Reg.slopeCI(two, 0.95), null);
  const flat = Reg.fit([{ x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }]);
  near(flat.b, 0, 1e-12, "b плоска"); assert.equal(flat.r2, null);
  const exact = Reg.fit([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
  near(exact.r2, 1, 1e-12, "R²"); assert.equal(exact.stdres[0], null); assert.equal(exact.cook[0], null);
});
