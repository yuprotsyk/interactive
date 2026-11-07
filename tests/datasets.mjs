// Набори даних: обсяги, середні й стандартні відхилення збігаються з numpy (tests/fixtures/datasets.json),
// а підсумки, які бачить користувач (Summ), дають ті самі числа.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const Data = require("../datasets.js");
const Summ = require("../summary.js");
const DataView = require("../dataview.js");
const fx = JSON.parse(readFileSync(new URL("./fixtures/datasets.json", import.meta.url), "utf8"));

test("набори даних: n, середнє, s збігаються з numpy", () => {
  for (const [id, cols] of Object.entries(fx)) {
    for (const [c, e] of Object.entries(cols)) {
      const v = Data[id][c];
      assert.equal(v.length, e.n, `${id}.${c} n`);
      assert.ok(Math.abs(Summ.mean(v) - e.mean) <= 1e-9 * Math.max(1, Math.abs(e.mean)), `${id}.${c} середнє`);
      assert.ok(Math.abs(Summ.sd(v, 1) - e.sd) <= 1e-9 * Math.max(1, e.sd), `${id}.${c} s`);
    }
  }
});

test("набори даних: відомі підсумки з прикладів", () => {
  const d = Data.adhd.D60.map((x, i) => x - Data.adhd.D0[i]);
  assert.ok(Math.abs(Summ.mean(d) - 4.958333) < 1e-5 && Math.abs(Summ.sd(d, 1) - 7.5382) < 1e-3, "ADHD: різниці");
  assert.equal(Data.verizon.CLEC.length, 23); assert.equal(Data.verizon.ILEC.length, 1664);
  assert.equal(Data.water.North.length, 35); assert.equal(Data.water.South.length, 26);
});

test("CSV: заголовок, порожні клітинки для коротшого стовпця, десяткова крапка", () => {
  const t = DataView.csv([{ name: "A", values: [1, 2.5, 3] }, { name: "B", values: [7] }]);
  assert.equal(t, '"A","B"\n1,7\n2.5,\n3,\n');
  const v = DataView.csv([{ name: "CLEC", values: Data.verizon.CLEC }, { name: "ILEC", values: Data.verizon.ILEC }]).trim().split("\n");
  assert.equal(v.length, 1 + 1664);
});
