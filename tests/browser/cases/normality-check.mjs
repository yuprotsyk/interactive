// Браузерна перевірка сторінки: normality-check (перевірка нормальності). Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../normality-check.html", import.meta.url).href;
function ok(c, m) { assert.ok(c, m); }
const num = (t) => parseFloat(t.replace(/\s/g, "").replace("−", "-").replace(",", ".").replace("<", ""));

export default async function (h) {
  const ctx = await h.browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const txt = (id) => page.textContent("#" + id);
  const chip = (name) => page.click(`.chip:text-is("${name}")`);
  const setRange = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);

  // початковий стан: усі показники обчислені, ступені свободи K − 3
  const w0 = num(await txt("swW"));
  ok(w0 > 0 && w0 <= 1, "W у (0; 1]: " + w0);
  ok((await txt("chDf")).trim() === "5", "df = K − 3 = 5");
  const p0 = num(await txt("swP"));
  ok(p0 >= 0 && p0 <= 1, "p у [0; 1]");

  // скошена вибірка великого обсягу: нормальність відхиляється обома критеріями
  await chip("Скошений (експоненційний)");
  await setRange("nRange", 500);
  ok(num(await txt("swP")) < 0.001, "Шапіро–Вілк відхиляє експоненційну вибірку n = 500");
  ok(num(await txt("chP")) < 0.001, "χ² відхиляє експоненційну вибірку n = 500");
  ok(/відхиляємо/.test(await txt("swVerdict")) && !/не відхиляємо/.test(await txt("swVerdict")), "вердикт: відхиляємо");

  // K змінює df; рівної довжини інтервали дають малі очікувані частоти в хвостах
  await setRange("kRange", 12);
  ok((await txt("chDf")).trim() === "9", "df = 9 при K = 12");
  await page.click("#modeSeg button:nth-child(2)");
  ok((await page.locator("#tbl tbody tr").count()) === 12, "у таблиці 12 інтервалів");

  // мала вибірка: повідомлення про малі очікувані частоти
  await setRange("nRange", 20);
  ok(/Очікувана частота менша за 5/.test(await txt("chWarn")), "попередження про малі очікувані частоти");

  // експеримент за істинної H₀: частка відхилень близька до α
  await chip("Нормальний");
  await setRange("nRange", 100);
  await setRange("kRange", 8);
  await page.click("#modeSeg button:nth-child(1)");
  await page.click("#add1000");
  ok(num(await txt("xN")) === 1000, "+1 000 вибірок");
  const fs = num(await txt("xSw")), fc = num(await txt("xCh"));
  ok(fs > 0.02 && fs < 0.09, "Шапіро–Вілк: частка близько 0,05: " + fs);
  ok(fc > 0.02 && fc < 0.10, "χ²: частка близько 0,05: " + fc);
  await page.click("#xReset");
  ok(num(await txt("xN")) === 0, "скидання лічильника");

  // потужність Шапіро–Вілка зростає з n (t₁₀)
  await chip("Майже нормальний (t₁₀)");
  await setRange("nRange", 20); await page.click("#add100");
  const low = num(await txt("xSw"));
  await setRange("nRange", 500); await page.click("#add100");
  const high = num(await txt("xSw"));
  ok(high > low + 0.15, `потужність зростає з n: ${low} → ${high}`);

  // нова вибірка змінює результат
  const before = await txt("swW");
  await page.click("#newSample");
  ok((await txt("swW")) !== before, "нова вибірка змінює W");

  // горизонтального прокручування немає (телефон)
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "немає горизонтального прокручування на 375px");

  ok(errors.length === 0, "помилок у консолі немає: " + errors.join("; "));
  await ctx.close();
}
