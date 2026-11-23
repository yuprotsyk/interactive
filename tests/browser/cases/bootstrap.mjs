// Браузерна перевірка сторінки: bootstrap. Числа відтворювані (зерно 2026): Час ремонту, CLEC, n = 23, B = 1000.
// x̄ = 16,51 і s/√n = 4,067 та t-інтервал [8,075; 24,94] збігаються з scipy; бутстреп-величини перевірено в tests/bootstrap.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const errors = [];
  for (const [w, dark] of [[375, false], [1280, false], [1280, true]]) {
    const ctx = await h.browser.newContext({ viewport: { width: w, height: 900 }, colorScheme: dark ? "dark" : "light" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto(U("bootstrap.html"));
    await p.waitForTimeout(500);
    const info = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, h1: document.querySelectorAll("h1").length,
      open: document.querySelector("#eTitle ~ details").open }));
    assert.ok(info.over <= 0, `${w}px: горизонтальне прокручування`);
    assert.equal(info.h1, 1); assert.equal(info.open, false, "«Докладніше» має бути згорнутим");

    if (w === 1280 && !dark) {
      const read = async () => Object.fromEntries(await p.$$eval("#dl > div", (ds) => ds.map((d) => [d.querySelector("dt").textContent, d.querySelector("dd").textContent])));
      let r = await read();
      assert.equal(r["Обсяг вибірки n"], "23"); assert.equal(r["Вибіркове середнє x̄"], "16,51"); assert.equal(r["Бутстреп-вибірок B"], "1000");
      assert.equal(r["Стандартна похибка s/√n"], "4,067"); assert.equal(r["95 % t-інтервал"], "[8,075; 24,94]");
      assert.equal(r["Бутстреп-оцінка стандартної похибки"], "3,931"); assert.equal(r["95 % процентильний інтервал"], "[10,29; 25,09]");
      assert.ok((await p.textContent("#warn")).includes("покриття"));
      // додавання перевибірок і відтворюваність після скидання
      await p.click("#b10"); assert.equal((await read())["Бутстреп-вибірок B"], "1010");
      await p.click("#b1"); assert.equal((await read())["Бутстреп-вибірок B"], "1011");
      await p.click("#reset"); r = await read();
      assert.equal(r["Бутстреп-вибірок B"], "1000"); assert.equal(r["95 % процентильний інтервал"], "[10,29; 25,09]");
      // рівень довіри змінює інтервал
      await p.click("#levSeg button:nth-child(3)");
      assert.ok(Object.keys(await read()).includes("99 % процентильний інтервал"));
      await p.click("#levSeg button:nth-child(2)");
      // медіана: немає t-інтервалу, є бутстреп-інтервал
      await p.click("#statSeg button:nth-child(2)"); r = await read();
      assert.equal(r["Вибіркова медіана"], "14,33"); assert.equal(r["Бутстреп-оцінка стандартної похибки"], "4,528");
      assert.equal(r["95 % процентильний інтервал"], "[5,8; 20,28]"); assert.equal(r["95 % t-інтервал"], undefined);
      // свої числа
      await p.click("#customBox summary");
      await p.fill("#paste", "1; 2; x"); await p.click("#apply");
      assert.ok(await p.isVisible("#err"), "повідомлення про помилку вводу");
      await p.fill("#paste", "1 2 3 4 5,5"); await p.click("#apply");
      assert.ok(!(await p.isVisible("#err")));
      assert.equal((await read())["Обсяг вибірки n"], "5");
      // n = 5, медіана (обрана раніше): лише значення зі спостережень, тому різних значень мало
      assert.ok((await p.textContent("#warn")).includes("різних значень"), "попередження про дискретність медіани");
      await p.fill("#paste", "7"); await p.click("#apply");
      assert.ok((await p.textContent("#err")).includes("щонайменше 2"));
      const text = await p.evaluate(() => document.body.innerText);
      assert.ok(!/NaN|Infinity|undefined/.test(text), "службові слова в тексті");
    }
    await ctx.close();
  }
  assert.deepEqual(errors, []);
}
