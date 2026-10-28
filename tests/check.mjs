// Перевірка розрахунків із common.js. Запуск: node --test tests/
// Потрібен лише Node 18+, нічого встановлювати не треба.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const Stat = require("../common.js");
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/scipy-cases.json", import.meta.url), "utf8"));

function close(actual, expected, rel, abs, label) {
  assert.notEqual(actual, null, label + ": значення відсутнє");
  const tol = abs + rel * Math.abs(expected);
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: отримано ${actual}, очікувано ${expected}`);
}

test(`звірка зі scipy ${fixtures.scipy}: ${fixtures.cases.length} випадків`, () => {
  for (const c of fixtures.cases) {
    const st = Stat.analyze(c.x.map((x, i) => ({ x, y: c.y[i] })));
    close(st.r, c.r, 1e-9, 1e-10, c.name + " r");
    close(st.rho, c.rho, 1e-9, 1e-10, c.name + " rho");
    close(st.p, c.p, 1e-7, 1e-14, c.name + " p");
    if (c.ci) {
      close(st.ci[0], c.ci[0], 1e-7, 1e-9, c.name + " ci low");
      close(st.ci[1], c.ci[1], 1e-7, 1e-9, c.name + " ci high");
    } else assert.equal(st.ci, null, c.name + " ci");
    close(st.slope, c.slope, 1e-7, 1e-9, c.name + " slope");
    close(st.intercept, c.intercept, 1e-7, 1e-6 * (1 + Math.abs(c.intercept)), c.name + " intercept");
  }
});

test("порожній і одноточковий набір", () => {
  assert.equal(Stat.analyze([]).r, null);
  const one = Stat.analyze([{ x: 1, y: 2 }]);
  assert.equal(one.r, null);
  assert.equal(one.meanX, 1);
});

test("дві точки: r = ±1, але p та інтервал не визначені", () => {
  const up = Stat.analyze([{ x: 0, y: 0 }, { x: 1, y: 5 }]);
  assert.ok(Math.abs(up.r - 1) < 1e-12);
  assert.equal(up.p, null);
  assert.equal(up.ci, null);
});

test("сталий стовпець дає null, а не NaN", () => {
  assert.equal(Stat.pearson([3, 3, 3, 3], [1, 2, 3, 4]), null);
  assert.equal(Stat.pearson([1, 2, 3, 4], [7, 7, 7, 7]), null);
  assert.equal(Stat.pearson([0.1, 0.1, 0.1], [1, 2, 3]), null);
  const st = Stat.analyze([0.1, 0.1, 0.1].map((x, i) => ({ x, y: i })));
  assert.equal(st.slope, null);
});

test("точна лінійна залежність: r = 1, p = 0", () => {
  const st = Stat.analyze([1, 2, 3, 4, 5].map((x) => ({ x, y: 3 * x - 2 })));
  assert.ok(Math.abs(st.r - 1) < 1e-12);
  assert.equal(st.p, 0);
  assert.equal(st.ci, null);
  assert.ok(Math.abs(st.slope - 3) < 1e-12);
  assert.ok(Math.abs(st.intercept + 2) < 1e-12);
});

test("властивості r: симетрія, масштаб, знак, порядок точок", () => {
  const xs = [2.1, 3.4, 5.5, 6.1, 7.9, 8.2, 10.4];
  const ys = [1.0, 2.9, 3.1, 6.2, 5.8, 8.8, 9.1];
  const r = Stat.pearson(xs, ys);
  assert.ok(Math.abs(r - Stat.pearson(ys, xs)) < 1e-14);
  assert.ok(Math.abs(r - Stat.pearson(xs.map((v) => 3 * v + 100), ys.map((v) => 0.01 * v - 5))) < 1e-12);
  assert.ok(Math.abs(r + Stat.pearson(xs, ys.map((v) => -2 * v))) < 1e-12);
  const pts = xs.map((x, i) => ({ x, y: ys[i] }));
  assert.ok(Math.abs(Stat.analyze([...pts].reverse()).p - Stat.analyze(pts).p) < 1e-14);
});

test("ранги та Спірмен", () => {
  assert.deepEqual(Stat.ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(Stat.ranks([5, 5, 5]), [2, 2, 2]);
  const x = [1, 2, 3, 4, 5, 6];
  assert.ok(Math.abs(Stat.spearman(x, x.map(Math.exp)) - 1) < 1e-12);
});

test("спеціальні функції", () => {
  assert.ok(Math.abs(Stat.lgamma(10) - Math.log(362880)) < 1e-12);
  assert.ok(Math.abs(Stat.lgamma(100.5) - 361.43554046777757) < 1e-10); // scipy.special.gammaln
  for (const [a, b, x] of [[1, 1, 0.3], [2.5, 0.5, 0.7], [10, 3, 0.2], [0.5, 0.5, 0.9]]) {
    assert.ok(Math.abs(Stat.betai(a, b, x) + Stat.betai(b, a, 1 - x) - 1) < 1e-12);
  }
  assert.ok(Math.abs(Stat.pValue(0, 20) - 1) < 1e-12);
  assert.ok(Stat.pValue(0.3, 20) > Stat.pValue(0.6, 20));
  const p = Stat.pValue(0.01, 100000);
  assert.ok(p > 0 && p < 1);
  const ci = Stat.fisherCI(0.5, 30), neg = Stat.fisherCI(-0.5, 30);
  assert.ok(ci[0] < 0.5 && ci[1] > 0.5);
  assert.ok(Math.abs(neg[0] + ci[1]) < 1e-14);
});

test("форматування чисел", () => {
  assert.equal(Stat.fmt(0.8164, 3), "0,816");
  assert.equal(Stat.fmt(-0.5, 2), "−0,50");
  assert.equal(Stat.fmt(-0.0004, 3), "0,000");
  assert.equal(Stat.fmt(null), "—");
  assert.equal(Stat.fmtSigned(0.5, 3), "+0,500");
  assert.equal(Stat.fmtSigned(0.0001, 3), "0,000");
  assert.equal(Stat.fmtSig(12345.678), "12350");
  assert.equal(Stat.fmtSig(0.00001234), "1,23e−5");
  assert.equal(Stat.decimalsFor(100), 1);
  assert.equal(Stat.snapToSpan(12.3456, 100), 12.3);
});

test("осі", () => {
  assert.equal(Stat.niceStep(100, 5), 20);
  assert.equal(Stat.niceStep(1, 5), 0.2);
  const t = Stat.ticksFor(0, 100, 5);
  assert.deepEqual(t.major, [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(t.minor, [10, 30, 50, 70, 90]);
  assert.ok(t.major.every((v) => !Object.is(v, -0)));
  const n = Stat.ticksFor(-50, 50, 5);
  assert.deepEqual(n.major, [-40, -20, 0, 20, 40]);
  assert.deepEqual(n.minor, [-50, -30, -10, 10, 30, 50]);
});

test("розбір вставлених даних", () => {
  const r = Stat.parseData("Температура, °C;Продажі, шт\n12;98\n15,5;118,2\nabc\n17\t133");
  assert.deepEqual(r.header, ["Температура, °C", "Продажі, шт"]);
  assert.deepEqual(r.points, [{ x: 12, y: 98 }, { x: 15.5, y: 118.2 }, { x: 17, y: 133 }]);
  assert.equal(r.skipped, 1);
  assert.equal(Stat.parseData("1 2\n3 4\n5 6").points.length, 3);
  assert.deepEqual(Stat.parseData("1,2\n3,4").points, [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.equal(Stat.parseData("x;y\r\n1;2\r\n\r\n3;4\r\n").points.length, 2);
  const h3 = Stat.parseData("Час навчання Бал\n1 2\n3 4");
  assert.equal(h3.header, null);
  assert.equal(h3.points.length, 2);
  assert.deepEqual(Stat.parseData("1;2;99\n3;4;99").points, [{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.equal(Stat.parseData("   \n\n").points.length, 0);
  assert.equal(Stat.toNumber("−3,25"), -3.25);
  assert.equal(Stat.toNumber("Infinity"), null);
});
