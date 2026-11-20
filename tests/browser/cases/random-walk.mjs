// Браузерна перевірка сторінки random-walk. Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../random-walk.html", import.meta.url).href;
function ok(c, m) { assert.ok(c, m); }
const num = (t) => Number(t.replace(/\s/g, "").replace("−", "-").replace(",", "."));

export default async function (h) {
  const ctx = await h.browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: "light" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(500);
  const dd = (label) => page.evaluate((l) => { const t = [...document.querySelectorAll("#dl dt")].find((x) => x.textContent.indexOf(l) === 0); return t ? t.nextElementSibling.textContent : null; }, label);
  const setRange = (id, v) => page.evaluate(([i, val]) => { const e = document.getElementById(i); e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); }, [id, v]);
  const chip = (name) => page.click(`.chip:text-is("${name}")`);
  const nonEmpty = (id) => page.evaluate((i) => { const c = document.getElementById(i), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, bg = [d[0], d[1], d[2]]; for (let k = 0; k < d.length; k += 4) if (d[k] !== bg[0] || d[k + 1] !== bg[1] || d[k + 2] !== bg[2]) return true; return false; }, id);

  // траєкторії: теорія для n = 100, p = 0,5
  ok(num(await dd("Математичне сподівання")) === 0, "E(Sₙ) = 0");
  ok(num(await dd("Стандартне відхилення")) === 10, "SD = 10");
  ok(Math.abs(num(await dd("P(Sₙ > 0)")) - 0.4602) < 1e-4, "P(S₁₀₀ > 0) = 0,4602");
  ok(Math.abs(num(await dd("P(Sₙ = 0)")) - 0.0796) < 1e-4, "P(S₁₀₀ = 0) = 0,0796");
  ok(await nonEmpty("c1") && await nonEmpty("c2"), "обидва графіки намальовано");
  ok(Math.abs(num(await dd("У межах ±2 стандартних відхилень, теорія")) - 0.9648) < 1e-4, "P(|S₁₀₀| ≤ 20) = 0,9648");
  ok(await page.locator("#eTitle ~ details").count() === 1 && !(await page.locator("#eTitle ~ details").evaluate((d) => d.open)), "докладне пояснення згорнуте");
  ok(await page.locator("p[data-modes=ruin]").isHidden() && await page.locator("p[data-modes=paths]").first().evaluate((e) => !e.hidden), "пояснення відповідає темі");
  await setRange("nRange", "400"); await setRange("pRange", "0.6");
  ok(Math.abs(num(await dd("Математичне сподівання")) - 80) < 1e-9, "E(S₄₀₀) = 80 при p = 0,6");
  ok(Math.abs(num(await dd("Стандартне відхилення")) - 19.6) < 0.01, "SD = 19,60");
  ok(Math.abs(num(await dd("У межах ±2 стандартних відхилень, теорія")) - 0.9536) < 1e-4, "p = 0,6, n = 400: 0,9536");
  ok(Math.abs(num(await dd("Вибіркове середнє за")) - 80) < 4, "вибіркове середнє близьке до теорії");
  ok(await page.locator("#pFld").isVisible(), "повзунок p видно");

  // розорення гравця
  await setRange("pRange", "0.5");
  await chip("Розорення гравця");
  ok(Math.abs(num(await dd("P(розорення)")) - 0.5) < 1e-9, "чесна гра: b/(a + b) = 0,5");
  ok(num((await dd("Очікувана тривалість")).replace(" раундів", "")) === 100, "тривалість a·b = 100");
  await setRange("pRange", "0.45");
  ok(Math.abs(num(await dd("P(розорення)")) - 0.8815) < 1e-4, "p = 0,45: розорення 0,8815");
  ok(Math.abs(num((await dd("Очікувана тривалість")).replace(" раундів", "")) - 76.3) < 0.06, "p = 0,45: тривалість 76,3");
  await page.click('.btn:text-is("+1 000 ігор")');
  ok(num(await dd("Зіграно ігор")) >= 1001, "зіграно понад 1000 ігор");
  ok(Math.abs(num(await dd("Частка розорень")) - 0.8815) < 0.05, "симуляція близька до теорії");
  ok(await page.locator("#sec2").isHidden(), "для розорення другого графіка немає");
  ok(await nonEmpty("c1"), "траєкторію гри намальовано");

  // закон арксинуса
  await chip("Час у плюсі");
  await setRange("nRange", "100");
  ok(await page.locator("#pFld").isHidden(), "p не змінюється: монетка чесна");
  ok(Math.abs(num(await dd("Теорія: частка між 0,4 і 0,6")) - 0.1398) < 1e-4, "теорія: 0,1398");
  ok(Math.abs(num(await dd("Теорія: менше 0,1")) - 0.3972) < 1e-4, "теорія: 0,3972");
  await page.click('.btn:text-is("+1 000 траєкторій")');
  ok(num(await dd("Змодельовано траєкторій")) >= 1001, "зіграно понад 1000 траєкторій");
  ok(Math.abs(num(await dd("Симуляція: менше 0,1")) - 0.3972) < 0.06, "симуляція біля 0,3972");
  ok(await nonEmpty("c2"), "гістограму намальовано");

  // крайні значення
  await chip("Траєкторії");
  await setRange("nRange", "1000"); await setRange("cRange", "1000"); await setRange("pRange", "0.3");
  ok(Math.abs(num(await dd("Математичне сподівання")) + 400) < 1e-9, "n = 1000, p = 0,3: E = −400");
  await setRange("cRange", "1");
  ok((await dd("Вибіркове стандартне відхилення за ними")) === "—", "одна траєкторія: вибіркового відхилення немає");
  await chip("Розорення гравця");
  await setRange("aRange", "50"); await setRange("bRange", "50");
  await page.click('.btn:text-is("+1 000 ігор")');
  ok(Math.abs(num(await dd("P(розорення)")) - 0.9999) < 1e-3 || num(await dd("P(розорення)")) > 0.99, "p = 0,3, a = b = 50: розорення майже певне");
  ok(num(await dd("Зіграно ігор")) >= 1001, "екстремальна гра завершується");

  // телефон
  await page.setViewportSize({ width: 375, height: 800 });
  await chip("Траєкторії");
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "немає горизонтальної прокрутки на 375px");
  ok(errors.length === 0, "помилки: " + errors.join("; "));
  await ctx.close();
}
