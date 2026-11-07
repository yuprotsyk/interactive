// Браузерна перевірка сторінки: mean-test (z- і t-критерій для середнього). Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../mean-test.html", import.meta.url).href;
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
  const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} проти ${b}`);

  // вага немовлят: n = 25, x̄ = 3075, μ₀ = 2800, s = 500, двостороння: t = 2,75, p = 0,0111
  near(num(await txt("rStat")), 2.75, 1e-3, "t-статистика");
  near(num(await txt("rP")), 0.0111, 5e-5, "p двостороннє");
  ok((await txt("rDf")).trim() === "24", "24 ступені свободи");
  ok(/відхиляємо/.test(await txt("verdict")) && !/не відхиляємо/.test(await txt("verdict")), "H₀ відхиляється");
  ok(/2869/.test(await txt("ciMsg")) && /3281/.test(await txt("ciMsg")), "довірчий інтервал [2869; 3281]");

  // одностороння альтернатива: p удвічі менше (симетричний нульовий розподіл)
  await page.click('#altSeg button:nth-child(2)');
  near(num(await txt("rP")), 0.00555, 5e-5, "p одностороннє");

  // малий n: t і z дають різні p і різні рішення
  await chip("Мала вибірка (n = 5)");
  near(num(await txt("rP")), 0.0890, 5e-4, "t, n = 5: p");
  ok(/інше рішення/.test(await txt("rCmp")), "z із s дає інше рішення");
  await page.click('#kindSeg button:nth-child(2)');
  near(num(await txt("rP")), 0.0253, 5e-4, "z, n = 5: p");
  ok(await page.locator("#rCmpBox").isHidden(), "для z порівняння з z не показується");

  // z-критерій з відомою σ: фасування, p = 0,0465 (ліва альтернатива)
  await chip("Фасування (σ відома)");
  near(num(await txt("rP")), 0.0465, 5e-4, "фасування: p");
  ok(/\(−∞/.test(await txt("ciMsg")), "одностороння верхня межа");

  // парні вибірки: p = 0,0038
  await chip("Препарат і плацебо: різниці");
  near(num(await txt("rP")), 0.0038, 5e-5, "парні: p");
  ok(await page.locator("#dvBox").isVisible(), "для набору даних видно блок «Дані»");
  await page.click("details.dv summary");
  ok((await page.locator("details.dv tbody tr").count()) >= 24, "у таблиці значення D0, D60 і різниці");
  await chip("Вага до й після: різниці");
  near(num(await txt("rP")), 0.035, 1e-3, "вага до й після: p");

  // експеримент за H₀: t дотримується α, z із s на малому n відхиляє частіше
  await chip("Мала вибірка (n = 5)");
  await page.click("#add1000");
  ok(num(await txt("xN")) === 1000, "+1 000 експериментів");
  const ft = num(await txt("xFrac")), fz = num(await txt("xFrac2"));
  ok(ft <= 0.05 + 5 * Math.sqrt(0.05 * 0.95 / 1000), "частка відхилень t близько α: " + ft);
  ok(fz > 0.08 && fz < 0.17, "частка відхилень z із s близько 0,12: " + fz);
  await page.click("#xReset");
  ok(num(await txt("xN")) === 0, "скидання лічильника");

  // крайній випадок: дуже великий |t| не ламає графік
  await chip("Вага немовлят");
  await setRange("sRange", "100");
  ok(/< 0,0001/.test(await txt("rP")), "дуже мале p показується як «< 0,0001»");

  ok(errors.length === 0, "помилки: " + errors.join("; "));
  await ctx.close();
}
