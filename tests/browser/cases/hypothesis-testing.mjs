// Браузерна перевірка сторінки: hypothesis-testing (біноміальний критерій). Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../hypothesis-testing.html", import.meta.url).href;
function ok(c, m) { assert.ok(c, m); }
const num = (t) => parseFloat(t.replace(/\s/g, "").replace("−", "-").replace(",", "."));

export default async function (h) {
  const ctx = await h.browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const txt = (id) => page.textContent("#" + id);
  const setRange = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);

  // Пауль 11 з 13, одностороння: p = 0,0112 (лекція), відхиляємо при α = 0,05
  ok(Math.abs(num(await txt("rP")) - 0.0112) < 5e-5, "Пауль: p = 0,0112");
  ok(/відхиляємо H/.test(await txt("verdict")) && !/не відхиляємо/.test(await txt("verdict")), "Пауль: H₀ відхиляється");
  ok(/k ≥ 10/.test(await txt("critMsg")), "n = 13, α = 0,05: поріг k ≥ 10");

  // Бонд 12 з 16: одностороння 0,0384; двостороння 0,0768
  await page.click('.chip:text-is("Бонд (сліпий тест)")');
  ok(Math.abs(num(await txt("rP")) - 0.0384) < 5e-5, "Бонд, одностороння: 0,0384");
  await page.click('#altSeg button:nth-child(2)');
  ok(Math.abs(num(await txt("rP")) - 0.0768) < 5e-5, "Бонд, двостороння: 0,0768");
  ok(/не відхиляємо/.test(await txt("verdict")), "двостороння при α = 0,05: не відхиляємо");

  // k = n/2 у двосторонній: p = 1
  await setRange("kRange", "8");
  ok(num(await txt("rP")) === 1, "k = n/2: p = 1");

  // мала n: відхилити неможливо
  await setRange("nRange", "3");
  ok(/неможливо/.test(await txt("critMsg")), "n = 3, α = 0,05: відхилення неможливе");

  // експеримент за H₀: частка не перевищує α суттєво
  await page.click('.chip:text-is("Пророк (восьминіг Пауль)")');
  await page.click("#add1000");
  ok(num(await txt("xN")) === 1000, "+1 000 експериментів");
  const f = num(await txt("xFrac"));
  ok(f <= 0.05 + 5 * Math.sqrt(0.05 * 0.95 / 1000), "частка відхилень за H₀ не перевищує α (" + f + ")");
  await page.click("#xReset");
  ok(num(await txt("xN")) === 0, "скидання лічильника");

  // таблиця деталей
  await page.click("#tableBox summary");
  ok((await page.locator("#tbody tr").count()) === 14, "таблиця: n + 1 рядків");

  ok(errors.length === 0, "помилки: " + errors.join("; "));
  await ctx.close();
}
