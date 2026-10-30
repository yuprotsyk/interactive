// Перевірка summary.js. Запуск: node --test tests/summary.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const Summ = require("../summary.js");
const cases = JSON.parse(readFileSync(new URL("./fixtures/summary-cases.json", import.meta.url)));
const close = (a, b, e = 1e-9, m = "") => assert.ok(Math.abs(a - b) <= e * Math.max(1, Math.abs(b)), `${m} ${a} ≠ ${b}`);

test("сирі дані: середнє, медіана, дисперсії проти numpy", () => {
  for (const c of cases) {
    close(Summ.mean(c.data), c.mean, 1e-12, "mean");
    close(Summ.median(c.data), c.median, 1e-12, "median");
    close(Summ.variance(c.data, 0), c.var0, 1e-9, "var0");
    if (c.var1 === null) assert.equal(Summ.variance(c.data, 1), null);
    else close(Summ.variance(c.data, 1), c.var1, 1e-9, "var1");
  }
});

test("сирі дані: квартилі й мода проти незалежної реалізації", () => {
  for (const c of cases) {
    const q = Summ.quartiles(c.data);
    if (c.quart === null) assert.equal(q, null);
    else { close(q.q1, c.quart[0], 1e-12, "q1"); close(q.q3, c.quart[1], 1e-12, "q3"); }
    const m = Summ.modeRaw(c.data);
    if (c.mode === null) assert.equal(m.none, true, JSON.stringify(c.data));
    else assert.deepEqual(m.modes, c.mode);
  }
});

test("інтервальний ряд: частоти, початок, середнє, дисперсія, медіана, квартилі, мода проти точної арифметики", () => {
  for (const c of cases) {
    const g = Summ.group(c.data, c.group.input[0], c.group.input[1]);
    assert.deepEqual(g.iv.map((r) => r.f), c.group.f, JSON.stringify(c.group.input));
    close(g.start, c.group.start, 1e-12, "start");
    for (const [ddof, key] of [[0, "ddof0"], [1, "ddof1"]]) {
      const e = c.group[key];
      close(Summ.gMean(g), e.mean, 1e-12, "gmean");
      const v = Summ.gVariance(g, ddof);
      if (e.var === null) assert.equal(v, null); else close(v, e.var, 1e-9, "gvar");
    }
    const e = c.group.ddof0;
    close(Summ.gQuantile(g, 0.5).value, e.median, 1e-12, "gmedian");
    close(Summ.gQuantile(g, 0.25).value, e.q1, 1e-12, "gq1");
    close(Summ.gQuantile(g, 0.75).value, e.q3, 1e-12, "gq3");
    const m = Summ.gMode(g);
    if (e.modes === null) assert.equal(m.none, true);
    else {
      assert.equal(m.cands.length, e.modes.length);
      m.cands.forEach((cd, i) => { if (e.modes[i] === null) assert.equal(cd.mode, null); else close(cd.mode, e.modes[i], 1e-12, "gmode"); });
    }
  }
});

test("підручниковий приклад: n = 50, h = 10: мода ≈ 30,909, медіана 28, середнє 27", () => {
  const data = [];
  [[5, 5], [8, 15], [15, 25], [16, 35], [6, 45]].forEach(([f, mid]) => { for (let i = 0; i < f; i++) data.push(mid); });
  const g = Summ.group(data, 0, 10);
  assert.deepEqual(g.iv.map((r) => r.f), [5, 8, 15, 16, 6]);
  close(Summ.gMean(g), 27, 1e-12);
  close(Summ.gQuantile(g, 0.5).value, 28, 1e-12);
  const m = Summ.gMode(g);
  assert.equal(m.cands.length, 1);
  close(m.cands[0].mode, 30 + 10 / 11, 1e-12);
  assert.equal(m.cands[0].d1, 1); assert.equal(m.cands[0].d2, 10);
});

test("межі інтервалів [a; b): значення на межі йде в правий інтервал", () => {
  const g = Summ.group([0, 10, 10, 19.9, 25], 0, 10);
  assert.deepEqual(g.iv.map((r) => r.f), [1, 3, 1]);
  const h = Summ.group([0.1, 0.2, 0.3, 0.4], 0, 0.1);   // похибка 0,3 / 0,1 не ламає розподіл
  assert.deepEqual(h.iv.map((r) => r.f), [1, 1, 2]);   // 0,4 на верхній межі останнього інтервалу
});

test("максимум на верхній межі потрапляє в останній інтервал [a; b], зайвого інтервалу немає", () => {
  let g = Summ.group([0, 10, 10, 19.9, 20], 0, 10);
  assert.deepEqual(g.iv.map((r) => r.f), [1, 4]);
  assert.equal(g.n, 5); assert.equal(g.iv[g.m - 1].cum, 5);
  g = Summ.group([5, 5, 5], 0, 10); assert.equal(g.m, 1); assert.deepEqual(g.iv.map((r) => r.f), [3]);
  g = Summ.group([10, 10], 0, 10); assert.equal(g.m, 1); assert.equal(g.start, 10);
});

test("початок зсувається, щоб перший інтервал містив мінімум", () => {
  assert.equal(Summ.group([23, 25, 41], 0, 10).start, 20);
  assert.equal(Summ.group([23, 25, 41], 30, 10).start, 20);
  assert.equal(Summ.group([23, 25, 41], 21, 10).start, 21);
  assert.equal(Summ.group([23, 25, 41], 25.5, 10).start, 15.5);
});

test("особливі випадки інтервальної моди", () => {
  // модальний інтервал крайній: частота за межею вважається нульовою
  let g = Summ.group([1, 1, 1, 12, 13], 0, 10), m = Summ.gMode(g);
  assert.equal(m.cands[0].i, 0); assert.equal(m.cands[0].fm, 0);
  close(m.cands[0].mode, 0 + 10 * 3 / (3 + 1), 1e-12);
  // кілька однакових максимумів: кілька кандидатів
  g = Summ.group([1, 2, 11, 12, 21], 0, 10); m = Summ.gMode(g);
  assert.equal(m.cands.length, 2);
  // усі інтервали однакові: моди немає
  g = Summ.group([5, 15, 25], 0, 10); assert.equal(Summ.gMode(g).none, true);
  // плато з трьох: d1 + d2 = 0 лише коли обидва сусіди рівні (середній із трьох однакових у 3 з 5 інтервалів)
  g = Summ.group([5, 15, 15, 15, 25, 25, 25, 25, 35, 35, 35, 35, 45, 45, 45, 45, 55, 55, 55, 55, 65], 0, 10);
  const mm = Summ.gMode(g);
  assert.ok(mm.cands.some((cd) => cd.mode === null), "плато дає undefined");
});

test("модa окремих значень: кілька мод, без моди, одне значення", () => {
  assert.deepEqual(Summ.modeRaw([1, 2, 2, 3, 3, 4]).modes, [2, 3]);
  assert.equal(Summ.modeRaw([1, 2, 3]).none, true);
  assert.equal(Summ.modeRaw([1, 1, 2, 2]).none, true);
  assert.deepEqual(Summ.modeRaw([5, 5, 5]).modes, [5]);
  assert.equal(Summ.modeRaw([]).none, true);
  assert.equal(Summ.modeRaw([7]).none, false);
});

test("ящик з вусами: межі Тьюкі, вуса, викиди", () => {
  const b = Summ.box([1, 2, 3, 4, 5, 6, 7, 8, 9, 50]);
  assert.equal(b.med, 5.5); assert.equal(b.q1, 3); assert.equal(b.q3, 8);
  assert.deepEqual(b.outliers, [50]); assert.equal(b.whi, 9); assert.equal(b.wlo, 1);
  assert.deepEqual(Summ.box([3]).outliers, []);
  assert.equal(Summ.box([]), null);
});

test("варіаційний ряд: частоти й накопичені частоти", () => {
  assert.deepEqual(Summ.series([3, 1, 3, 2, 3]), [{ x: 1, f: 1, cum: 1 }, { x: 2, f: 1, cum: 2 }, { x: 3, f: 3, cum: 5 }]);
});

test("стійкість: викид зсуває середнє, але не медіану", () => {
  const base = [10, 11, 12, 13, 14], out = [10, 11, 12, 13, 100];
  assert.ok(Summ.mean(out) - Summ.mean(base) > 15);
  assert.equal(Summ.median(out), Summ.median(base));
});

test("table(): з готових частот дає той самий ряд і ті самі характеристики, що group()", () => {
  for (const c of cases) {
    const g = Summ.group(c.data, c.group.input[0], c.group.input[1]);
    const t = Summ.table(g.start, g.h, g.iv.map((r) => r.f));
    assert.equal(t.n, g.n); assert.equal(t.m, g.m);
    assert.deepEqual(t.iv, g.iv);
    close(Summ.gMean(t), Summ.gMean(g)); close(Summ.gQuantile(t, 0.5).value, Summ.gQuantile(g, 0.5).value);
  }
  assert.equal(Summ.table(0, 10, [0, 0, 0]), null);
  assert.equal(Summ.table(0, 10, []), null);
  const t2 = Summ.table(0, 10, [0, 5, 0]);       // нулі на краях не заважають
  assert.equal(t2.n, 5); close(Summ.gQuantile(t2, 0.5).value, 15);
});
