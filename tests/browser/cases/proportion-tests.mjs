// Браузерна перевірка сторінки: proportion-tests. Еталони: scipy (norm, binomtest), див. tests/proportions.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const errors = [];
  for (const [w, dark] of [[375, false], [1280, false], [1280, true]]) {
    const ctx = await h.browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: dark ? "dark" : "light" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto(U("proportion-tests.html"));
    await p.waitForTimeout(400);
    const info = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, h1: document.querySelectorAll("h1").length,
      open: document.querySelector("#eTitle ~ details").open }));
    assert.ok(info.over <= 0, `${w}px: горизонтальне прокручування`);
    assert.equal(info.h1, 1); assert.equal(info.open, false, "«Докладніше» має бути згорнутим");

    if (w === 1280 && !dark) {
      const read = async () => Object.fromEntries(await p.$$eval("#dl > div", (ds) => ds.map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])));
      let r = await read();
      assert.equal(r["p-значення"], "0,0455"); assert.equal(r["Статистика z"], "2,000");
      assert.equal(r["Точний біноміальний p"], "0,0569"); assert.equal(r["Вибіркова частка p̂"], "0,6000");
      assert.ok((await p.textContent("#verdict")).includes("відхиляємо H₀"));
      assert.equal((await p.textContent("#warn")).trim(), "");
      // права альтернатива: p = 1 − Φ(2) = 0,0228
      await p.click("#altSeg button:nth-child(2)");
      assert.equal((await read())["p-значення"], "0,0228");
      // «Брак»: орієнтир не виконано, p за нормальним і точним різні
      await p.click("#chips button:has-text('Брак')");
      r = await read();
      assert.equal(r["p-значення"], "0,0047"); assert.equal(r["Точний біноміальний p"], "0,0121");
      assert.ok((await p.textContent("#warn")).includes("Орієнтир"), "попередження про орієнтир");
      // недопустимий ввід
      await p.fill("#x0", "500");
      assert.ok(await p.isVisible("#err"), "повідомлення про помилку");
      assert.equal((await read())["p-значення"], "—");
      await p.fill("#x0", "18");
      assert.ok(!(await p.isVisible("#err")));
      // дві частки
      await p.click("#modeSeg button:has-text('Дві частки')");
      r = await read();
      assert.equal(r["p-значення"], "0,0099"); assert.equal(r["Статистика z"], "−2,578");
      assert.equal(r["Різниця p̂₁ − p̂₂"], "−0,0400");
      assert.equal(r["95 % довірчий інтервал для p₁ − p₂"], "[−0,0704; −0,0096]");
      await p.click("#alphaSeg button:nth-child(3)");
      assert.ok((await p.textContent("#verdict")).includes("відхиляємо"), "0,0099 ≤ 0,01");
      assert.equal((await read())["99 % довірчий інтервал для p₁ − p₂"] !== undefined, true);
      await p.click("#chips button:has-text('Малі групи')");
      assert.ok((await p.textContent("#warn")).includes("менше 10"));
      // однакові групи без успіхів: z не визначено
      await p.fill("#x1", "0"); await p.fill("#x2", "0");
      assert.ok((await p.textContent("#err")).includes("не визначено"));
      const text = await p.evaluate(() => document.body.innerText);
      assert.ok(!/NaN|Infinity|undefined/.test(text), "службові слова в тексті");
    }
    await ctx.close();
  }
  assert.deepEqual(errors, []);
}
