// Браузерна перевірка сторінки: errors-power (помилки I і II роду та потужність). Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../errors-power.html", import.meta.url).href;
const num = (t) => parseFloat(t.replace(/\s/g, "").replace("−", "-").replace(",", "."));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} проти ${b}`);

export default async function (h) {
  const ctx = await h.browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#eTitle ~ details").count(), 1);
  assert(!(await page.locator("#eTitle ~ details").evaluate((d) => d.open)), "докладне пояснення згорнуте");
  const txt = (id) => page.textContent("#" + id);
  const rd = async (label) => page.evaluate((l) => {
    const dt = [...document.querySelectorAll("#rd dt")].find((x) => x.textContent.startsWith(l));
    return dt ? dt.nextElementSibling.textContent : null;
  }, label);
  const setRange = (id, v) => page.evaluate(([i, val]) => { const r = document.getElementById(i); r.value = String(val); r.dispatchEvent(new Event("input")); }, [id, v]);
  const chip = (name) => page.click(`.chip:text-is("${name}")`);

  // «Малий ефект»: μ = 103, μ₀ = 100, σ = 15, n = 25, α = 0,05, права: λ = 1, потужність = 1 − Φ(1,645 − 1) = 0,2595
  near(num(await txt("rVal")), 0.2595, 1e-4, "потужність");
  near(num(await rd("Помилка II роду")), 0.7405, 1e-4, "β");
  assert.equal(await rd("Потрібне n"), "155", "n для потужності 0,8");
  assert.match(await rd("Відхиляємо H₀, якщо"), /104,93/);

  // «Ефекту немає»: μ = μ₀, потужність = α, помилки II роду немає
  await chip("Ефекту немає");
  near(num(await txt("rVal")), 0.05, 1e-9, "μ = μ₀: потужність = α");
  assert.equal(await rd("Помилка II роду"), "—");
  assert.equal(await rd("Потрібне n"), "—");

  // «Інший бік»: μ поза альтернативою — потужність менша за α, помилки II роду немає
  await chip("Інший бік");
  assert.ok(num(await txt("rVal")) < 0.05, "μ поза H₁: ймовірність відхилити < α");
  assert.equal(await rd("Помилка II роду"), "—");
  assert.match(await page.textContent("#rNote"), /помилки II роду немає/);

  // збільшення n підвищує потужність; більший ефект теж
  await chip("Малий ефект");
  const p25 = num(await txt("rVal"));
  await setRange("nRange", 100);
  assert.ok(num(await txt("rVal")) > p25, "більше n — більша потужність");
  await setRange("nRange", 25);
  await setRange("muRange", 112);
  assert.ok(num(await txt("rVal")) > p25, "більший ефект — більша потужність");

  // двостороння альтернатива: μ = 105, σ = 10, n = 32 → потужність ≥ 0,8, n = 31 → менше (див. tests/hypotheses.mjs)
  await chip("Малий ефект");
  await page.click('[data-alt="two"]'); await setRange("muRange", 105); await setRange("sRange", 10);
  assert.equal(await rd("Потрібне n"), "32", "двостороння: n для потужності 0,8");

  // експеримент: 1 000 повторів, частка відхилень близька до теорії (допуск 5 стандартних відхилень частки)
  await chip("Малий ефект");
  await page.click("#run1k");
  const frac = await page.evaluate(() => { const dds = [...document.querySelectorAll("#xd dd")].map((d) => d.textContent); return dds; });
  assert.equal(frac[0], "1000");
  const typeII = num(frac[2]), theory = num(frac[3]), sd = num(frac[4]);
  near(typeII, theory, 5 * sd, "частота помилок II роду проти теорії");
  await page.click("#runReset");
  assert.equal((await page.textContent("#xd dd")), "0");

  // темна тема й вузький екран: без горизонтального прокручування
  const ctx2 = await h.browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: "dark" });
  const p2 = await ctx2.newPage();
  await p2.goto(PAGE); await p2.waitForTimeout(400);
  assert.ok(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "375px: горизонтальне прокручування");
  await ctx2.close();

  assert.deepEqual(errors, []);
  await ctx.close();
}
