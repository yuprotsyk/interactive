// Браузерна перевірка сторінки: two-samples (порівняння середніх двох вибірок). Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../two-samples.html", import.meta.url).href;
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
  const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} проти ${b}`);

  // робота неповний день: різниця 2,57 год, p ≈ 0,027, інтервал [0,29; 4,85]
  near(num(await txt("rDiff")), 2.57, 1e-9, "різниця");
  near(num(await txt("rP")), 0.02707, 6e-4, "p двостороннє");
  near(num(await txt("rDf")), 231.7, 0.2, "ν Велча");
  ok(/0,29/.test(await txt("ciMsg")) && /4,85/.test(await txt("ciMsg")), "інтервал [0,29; 4,85]");
  ok(/відхиляємо/.test(await txt("verdict")) && !/не відхиляємо/.test(await txt("verdict")), "H₀ відхиляється");

  // z-критерій з відомими σ: два автомати, z = −2,175, p = 0,0296
  await chip("Два автомати (σ відомі)");
  near(num(await txt("rStat")), -2.175, 1e-3, "z-статистика");
  near(num(await txt("rP")), 0.0296, 5e-4, "z: p");
  ok(await page.locator("#rCmpBox").isHidden(), "для z порівняння з об'єднаною дисперсією не показується");

  // малі вибірки: t Велча і z дають різне p
  await chip("Малі вибірки");
  const pt = num(await txt("rP"));
  await page.click("#kindSeg button:nth-child(2)");
  ok(num(await txt("rP")) < pt, "z дає менше p, ніж t Велча");

  // різні дисперсії й обсяги: Велч тримає α, об'єднаний t відхиляє істинну H₀ значно частіше
  await chip("Різні дисперсії й обсяги");
  ok(/занадто часто/.test(await txt("kindNote")), "підказка про небезпечне співвідношення n і s");
  await page.click("#add1000");
  ok(num(await txt("xN")) === 1000, "+1 000 експериментів");
  const fw = num(await txt("xFrac")), fp = num(await txt("xFrac2"));
  ok(fw <= 0.05 + 5 * Math.sqrt(0.05 * 0.95 / 1000), "Велч: частка близько α: " + fw);
  ok(fp > 0.15, "t з об'єднаною дисперсією відхиляє занадто часто: " + fp);
  await page.click("#xReset");
  ok(num(await txt("xN")) === 0, "скидання лічильника");

  // набір verizon, p Велча (праве) = 0,030, p об'єднаного t = 0,0045
  await chip("Ремонт: клієнти CLEC і ILEC");
  near(num(await txt("rP")), 0.030, 1.5e-3, "Verizon: p Велча");
  ok(/p = 0,00[45]/.test(await txt("rCmp")), "Verizon: об'єднаний t дає значно менше p: " + await txt("rCmp"));
  // блок «Дані»: підсумок збігається з повзунками, значення видно, CSV завантажується, ящик з вусами намальовано
  ok(await page.locator("#dvBox").isVisible(), "для набору даних видно блок «Дані»");
  await page.click("details.dv summary");
  ok((await page.locator("details.dv tbody tr").count()) >= 1664, "у таблиці всі значення набору (1664 рядки й підсумок)");
  const sumRow = (await page.locator("details.dv table").first().locator("tbody tr").first().innerText()).replace(/\s+/g, " ");
  ok(/23/.test(sumRow) && /16,51/.test(sumRow) && /19,50/.test(sumRow), "підсумок CLEC: n, x̄, s: " + sumRow);
  const dl = page.waitForEvent("download");
  await page.click("details.dv button:text-is('Завантажити CSV')");
  const file = await dl;
  ok(file.suggestedFilename() === "verizon.csv", "ім'я файлу CSV");
  ok(await page.locator("#boxSec").isVisible(), "ящик з вусами видно");
  ok(await page.evaluate(() => { const c = document.getElementById("c3"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) n++; return n > 500; }), "ящик з вусами не порожній");
  await page.evaluate(() => { const e = document.getElementById("m1Range"); e.value = 12; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.click("#resetData");
  near(num(await txt("m1Out")), 16.51, 1e-9, "повернення x̄₁ до даних");
  await chip("Ремонт: клієнти CLEC і ILEC");
  await chip("Банкноти: справжні й підроблені");
  ok(/< 0,0001/.test(await txt("rP")), "банкноти: p < 0,0001");

  // крайній випадок: дуже велике |t| не ламає графік
  await chip("Робота неповний день (1974 і 2014)");
  await page.evaluate(() => { const e = document.getElementById("m1Range"); e.value = e.max; e.dispatchEvent(new Event("input", { bubbles: true })); });
  ok(num(await txt("rStat")) > 2, "після зсуву x̄₁ статистика велика й сторінка працює");

  // телефон: без горизонтального прокручування
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "немає горизонтального прокручування на 375px");
  ok(errors.length === 0, "помилок у консолі немає: " + errors.join("; "));
  await ctx.close();
}
