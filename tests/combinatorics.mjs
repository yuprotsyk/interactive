// Комбінаторика: точні значення проти math.comb / math.perm (tests/fixtures/combinatorics.json), узгодженість переліків із формулами.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const Comb = require("../combinatorics.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/combinatorics.json", import.meta.url), "utf8"));

test("A, n^k, C, C з повтореннями: точні значення збігаються з Python", () => {
  for (const kind of ["A", "Arep", "C", "Crep"]) {
    for (const [n, k, v] of fx[kind]) assert.equal(Comb.count(kind, n, k).toString(), v, `${kind}(${n}, ${k})`);
  }
});

test("мультиноміальний коефіцієнт і відомі значення", () => {
  for (const [c, v] of fx.multi) assert.equal(Comb.multinomial(c).toString(), v, JSON.stringify(c));
  assert.equal(Comb.comb(49, 6).toString(), "13983816");
  assert.equal(Comb.fact(20).toString(), "2432902008176640000");
  assert.equal(Comb.multinomial([2, 3, 2, 1, 1, 1]).toString(), "151200"); // МАТЕМАТИКА
});

test("ймовірності: дні народження й лотерея", () => {
  for (const [n, k, p] of fx.birthday) assert.ok(Math.abs(Comb.birthdayDistinct(n, k) - p) < 1e-14, `birthday ${n},${k}`);
  for (const [N, K, m, p] of fx.lottery) assert.ok(Math.abs(Comb.lotteryExact(N, K, m) - p) <= 1e-12 * Math.max(1, p) + 1e-15, `lottery ${N},${K},${m}`);
  const s = [0, 1, 2, 3, 4, 5, 6].reduce((a, m) => a + Comb.lotteryExact(49, 6, m), 0);
  assert.ok(Math.abs(s - 1) < 1e-12, "сума ймовірностей лотереї дорівнює 1");
});

test("переліки: кількість, унікальність, лексикографічний порядок", () => {
  for (const kind of ["A", "Arep", "C", "Crep"]) {
    for (const [n, k] of [[4, 2], [5, 3], [3, 3], [4, 0], [2, 4], [6, 2]]) {
      const all = Comb.list(kind, n, k, 100000), expected = Number(Comb.count(kind, n, k));
      assert.equal(all.length, expected, `${kind}(${n}, ${k}) кількість`);
      const keys = all.map((a) => a.join(","));
      assert.equal(new Set(keys).size, keys.length, `${kind}(${n}, ${k}) унікальні`);
      for (let i = 1; i < all.length; i++) {
        const a = all[i - 1], b = all[i]; let j = 0;
        while (j < a.length && a[j] === b[j]) j++;
        assert.ok(j < a.length && a[j] < b[j], `${kind}(${n}, ${k}) порядок`);
      }
    }
  }
  assert.equal(Comb.list("A", 10, 3, 60).length, 60, "обмеження limit");
  assert.equal(Comb.list("C", 5, 2, 100).map((a) => a.join("")).join(" "), "01 02 03 04 12 13 14 23 24 34");
});

test("перестановки з повторами: перелік збігається з n!/∏mᵢ!", () => {
  for (const counts of [[2, 1], [2, 2, 1], [3, 2, 1], [1, 1, 1]]) {
    const all = Comb.listMulti(counts, 100000);
    assert.equal(all.length, Number(Comb.multinomial(counts)), JSON.stringify(counts));
    assert.equal(new Set(all.map((a) => a.join(","))).size, all.length);
  }
});

test("форматування: розряди й наукова форма", () => {
  assert.equal(Comb.group(Comb.comb(49, 6)), "13 983 816");
  const s = Comb.sci(Comb.permRep(62, 8));
  assert.equal(s.e, 14); assert.ok(Math.abs(s.m - 2.18340105584896) < 1e-12);
});
