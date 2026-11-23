// Браузерна перевірка сторінки: monte-carlo. Зерно фіксоване (5); початкові 100 точок + натискання кнопок.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const errors = [];
  for (const [w, dark] of [[375, false], [1280, false], [1280, true]]) {
    const ctx = await h.browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: dark ? "dark" : "light" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto(U("monte-carlo.html"));
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, h1: document.querySelectorAll("h1").length,
      open: document.querySelector("#eTitle ~ details").open }));
    assert.ok(info.over <= 0, `${w}px: горизонтальне прокручування`);
    assert.equal(info.h1, 1); assert.equal(info.open, false, "«Докладніше» має бути згорнутим");

    if (w === 1280 && !dark) {
      const read = async () => Object.fromEntries(await p.$$eval("#dl > div", (ds) => ds.map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])));
      let r = await read();
      assert.equal(r["Кількість точок n"].replace(/\s/g, ""), "100"); assert.equal(r["Точне значення I"], "2,00000");
      const est = r["Оцінка Î"];
      await p.click("#b100"); r = await read();
      assert.equal(r["Кількість точок n"].replace(/\s/g, ""), "200");
      await p.click("#reset"); r = await read();
      assert.equal(r["Оцінка Î"], est, "після скидання результат відтворюється");
      // метод влучання показує частку влучань; точна похибка σ/√n збігається з формулою
      await p.click("#mSeg button:nth-child(2)"); r = await read();
      assert.ok(r["Частка влучань p̂"] !== undefined);
      await p.click("#b100000"); r = await read();
      assert.equal(r["Точна стандартна похибка σ/√n"], "0,00478");
      // 1/√x: метод влучання недоступний, точної похибки немає, є попередження
      await p.click("#chips button:nth-child(6)");
      assert.ok(await p.$eval("#mSeg button:nth-child(2)", (b) => b.disabled));
      r = await read();
      assert.equal(r["Точна стандартна похибка σ/√n"], "не існує");
      assert.ok((await p.textContent("#warn")).includes("нескінченна"));
      // межа кількості точок
      for (let i = 0; i < 10; i++) await p.click("#b100000");
      assert.ok((await p.textContent("#warn")).includes("межі"));
      const text = await p.evaluate(() => document.body.innerText);
      assert.ok(!/NaN|Infinity|undefined/.test(text), "службові слова в тексті");
    }
    await ctx.close();
  }
  assert.deepEqual(errors, []);
}
