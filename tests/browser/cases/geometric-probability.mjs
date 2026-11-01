// Браузерна перевірка сторінки: geometric-probability. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;
const PAGE = U("geometric-probability.html");
function ok(c, m) { assert.ok(c, m); }
const num = (t) => parseFloat(t.replace(/\s/g, "").replace("−", "-").replace(",", "."));

export default async function (h) {
  const browser = h.browser;
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const txt = (id) => page.textContent("#" + id);
  const chip = (name) => page.click(`.chip:text-is("${name}")`);
  const setRange = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);
  const within = (f, p, n, label) => ok(Math.abs(f - p) <= 5 * Math.sqrt(p * (1 - p) / n), `${label}: частка ${f} далеко від точного ${p} (n=${n})`);

  // старт: точка в крузі r = 0,3
  ok(num(await txt("rN")) === 0, "старт: n = 0");
  ok(num(await txt("rExact")) > 0.28 && num(await txt("rExact")) < 0.283, "круг r = 0,3: P = π·0,09 ≈ 0,2827");
  await page.click("#add10000");
  ok(num(await txt("rN")) === 10000, "+10 000: n = 10 000");
  within(num(await txt("rFrac")), Math.PI * 0.09, 10000, "круг");
  ok(!(await page.locator("#capMsg").isHidden()), "після 6 000 дослідів є примітка про обмеження точок на моделі");
  ok(await page.locator("#rPiBox").isHidden(), "для круга оцінки π немає");

  // зміна параметра скидає лічильники
  await setRange("rRange", "0.5");
  ok(num(await txt("rN")) === 0, "зміна радіуса скидає n");
  ok(Math.abs(num(await txt("rExact")) - Math.PI / 4) < 1e-3, "r = 0,5: P = π/4");

  // чверть круга й оцінка π
  await page.selectOption("#regionSel", "quarter");
  ok(await page.locator("#rFld").isHidden(), "для чверті радіус прихований");
  await page.click("#add10000");
  ok(!(await page.locator("#rPiBox").isHidden()), "для чверті є оцінка π");
  ok(Math.abs(num(await txt("rPi")) - Math.PI) < 0.1, "оцінка π за 10 000 точок");

  // зустріч
  await chip("Зустріч");
  ok(!(await page.locator("#tauFld").isHidden()) && (await page.locator("#regionFld").isHidden()), "для зустрічі видно τ");
  ok(Math.abs(num(await txt("rExact")) - 0.4375) < 1e-4, "τ = 15, T = 60: P = 7/16");
  await setRange("tauRange", "30");
  ok(Math.abs(num(await txt("rExact")) - 0.75) < 1e-4, "τ = 30: P = 0,75");
  await page.click("#add10000");
  within(num(await txt("rFrac")), 0.75, 10000, "зустріч");
  await setRange("tauRange", "60");
  ok(num(await txt("rExact")) === 1, "τ = 60: P = 1");
  await page.click("#add100");
  ok(num(await txt("rFrac")) === 1, "τ = 60: всі зустрілися");

  // голка Бюффона
  await chip("Голка Бюффона");
  ok(!(await page.locator("#floorBox").isHidden()), "видно картинку з голками");
  ok(Math.abs(num(await txt("rExact")) - 2 / Math.PI) < 1e-4, "l = d: P = 2/π");
  await setRange("lRange", "0.5");
  ok(Math.abs(num(await txt("rExact")) - 1 / Math.PI) < 1e-4, "l = d/2: P = 1/π");
  await page.click("#add10000");
  within(num(await txt("rFrac")), 1 / Math.PI, 10000, "Бюффон");
  ok(!(await page.locator("#rPiBox").isHidden()) && Math.abs(num(await txt("rPi")) - Math.PI) < 0.3, "оцінка π за голкою");

  // Бертран
  await chip("Парадокс Бертрана");
  ok((await page.locator("#floorBox").isHidden()) && !(await page.locator("#bertBox").isHidden()), "для Бертрана видно таблицю способів");
  await page.click("#add10000");
  const rows = await page.$$eval("#bertBody tr", (tr) => tr.map((r) => [...r.children].map((c) => c.textContent)));
  ok(rows.length === 3, "три способи в таблиці");
  [1 / 3, 1 / 2, 1 / 4].forEach((p, i) => {
    ok(Math.abs(num(rows[i][2]) - p) < 1e-4, `спосіб ${i + 1}: точне значення`);
    within(num(rows[i][1]), p, 10000, `спосіб ${i + 1}`);
  });
  await page.click("#methodSeg button:nth-child(2)");
  ok(Math.abs(num(await txt("rExact")) - 0.5) < 1e-4, "обрано спосіб 2: P = 1/2");
  ok((await txt("rFracL")).includes("спосіб 2"), "підпис показує обраний спосіб");
  ok(num(await txt("rN")) === 10000, "перемикання способу не скидає дослідів");

  // запуск і пауза
  await page.click("#play");
  await page.waitForTimeout(500);
  await page.click("#play");
  ok(num(await txt("rN")) > 10000, "запуск додає досліди");
  ok((await txt("play")).includes("Запустити"), "після паузи кнопка знову «Запустити»");

  // відтворюваність: однакове зерно дає ті самі числа
  async function frac() {
    const p = await ctx.newPage();
    await p.goto(PAGE);
    await p.waitForTimeout(300);
    await p.click("#add1000");
    const v = await p.textContent("#rFrac");
    await p.close();
    return v;
  }
  ok((await frac()) === (await frac()), "те саме зерно: ті самі числа");

  // нова симуляція змінює результат
  await page.reload();
  await page.waitForTimeout(300);
  await page.click("#add1000");
  await page.click("#fresh");
  await page.click("#add1000");
  ok(num(await txt("rN")) === 1000, "нова симуляція починається з нуля");

  // телефон: без горизонтального прокручування
  await page.setViewportSize({ width: 360, height: 800 });
  for (const t of ["Точка в області", "Зустріч", "Голка Бюффона", "Парадокс Бертрана"]) {
    await chip(t);
    await page.click("#add1000");
    ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `360 px: ${t} без горизонтального прокручування`);
  }
  ok(errors.length === 0, "немає помилок у консолі: " + errors.join("; "));
  await ctx.close();
}
