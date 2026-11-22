// Браузерна перевірка сторінки: linear-regression. Запускається з browser.test.mjs.
// Еталон: набір «Важіль із впливом»: пряма y = 23,28 + 0,2753·x, R² = 0,2128, h = 0,4015, D = 3,5323 (numpy/scipy).
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;
const num = (t) => parseFloat(t.replace("−", "-").replace(",", "."));

export default async function (h) {
  const errors = [];
  for (const [w, dark] of [[375, false], [1280, false], [1280, true]]) {
    const ctx = await h.browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: dark ? "dark" : "light" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto(U("linear-regression.html"));
    await p.waitForTimeout(400);
    const info = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, h1: document.querySelectorAll("h1").length,
      open: document.querySelector("#eTitle ~ details").open }));
    assert.ok(info.over <= 0, `${w}px: горизонтальне прокручування`);
    assert.equal(info.h1, 1); assert.equal(info.open, false, "«Докладніше» має бути згорнутим");

    if (w === 1280 && !dark) {
      // стартовий набір «Важіль із впливом»
      assert.equal((await p.textContent("#eq")).trim(), "y = 23,28 + 0,2753·x");
      const stats = async () => Object.fromEntries(await p.$$eval("#stats > div", (ds) => ds.map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])));
      let s = await stats();
      assert.equal(s["Кількість точок, n"], "13");
      assert.ok(Math.abs(num(s["Коефіцієнт детермінації R²"]) - 0.2130) < 1e-3, "R² " + s["Коефіцієнт детермінації R²"]);
      const pv = async () => Object.fromEntries(await p.$$eval("#pBody dl > div", (ds) => ds.map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])));
      let q = await pv();
      assert.ok(Math.abs(num(q["Важіль h"]) - 0.4020) < 1e-3, "важіль " + q["Важіль h"]);
      assert.ok(Math.abs(num(q["Відстань Кука D"]) - 3.532) < 2e-3, "D " + q["Відстань Кука D"]);
      assert.ok((await p.textContent("#pBody")).includes("D > 1"), "підказка про вплив");
      // видалення виділеної точки повертає пряму без неї
      await p.click("#pBody button:has-text('Видалити точку')");
      assert.equal((await p.textContent("#eq")).trim(), "y = 10,61 + 0,6568·x");
      assert.equal((await stats())["Кількість точок, n"], "12");
      await p.click("#undoBtn");
      assert.equal((await stats())["Кількість точок, n"], "13");
      // клацання по полю додає точку; клавіатура рухає її
      const box = await p.locator("#c1").boundingBox();
      await p.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.3);
      assert.equal((await stats())["Кількість точок, n"], "14");
      await p.keyboard.press("ArrowUp");
      await p.keyboard.press("Delete");
      assert.equal((await stats())["Кількість точок, n"], "13");
      // «Важіль без впливу»: D < 1
      await p.click("#chips button:has-text('Важіль без впливу')");
      q = await pv();
      assert.ok(num(q["Відстань Кука D"]) < 1, "D для важеля без впливу < 1: " + q["Відстань Кука D"]);
      // порожній стан і дві точки
      await p.click("#clearBtn");
      assert.equal((await p.textContent("#eq")).trim(), "—");
      assert.ok((await p.textContent("#rNote")).includes("щонайменше дві"));
      await p.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await p.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
      assert.ok((await p.textContent("#eq")).startsWith("y ="), "пряма через дві точки");
      assert.ok((await p.textContent("#rNote")).includes("рівно одна пряма"));
      const text = await p.evaluate(() => document.body.innerText);
      assert.ok(!/NaN|Infinity|undefined/.test(text), "службові слова в тексті");
    }
    await ctx.close();
  }
  assert.deepEqual(errors, []);
}
