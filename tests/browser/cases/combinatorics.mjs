// Браузерна перевірка сторінки combinatorics. Запускається з browser.test.mjs.
import assert from "node:assert";

const PAGE = new URL("../../../combinatorics.html", import.meta.url).href;
function ok(c, m) { assert.ok(c, m); }
const digits = (t) => t.replace(/[^0-9]/g, "");

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

  ok(digits(await txt("rCount")) === "720", "призові місця A(10,3) = 720");
  ok((await page.$$eval("#vars li", (e) => e[0].textContent)) === "ABC", "перший варіант ABC");
  ok(await page.locator("#rowSec").isHidden(), "для розміщень ряду Паскаля немає");
  ok(/10 бігунів/.test(await txt("statement")), "умова містить n");
  await setRange("nRange", "12"); await setRange("kRange", "2");
  ok(/12 бігунів/.test(await txt("statement")) && /перші 2 місця/.test(await txt("statement")), "умова слідує за n і k");
  await setRange("nRange", "10"); await setRange("kRange", "3");

  // той самий вибір без урахування порядку: C(10,3) = 120, і примітка про схему
  ok((await page.locator("#orderSeg button:disabled").count()) === 2 && (await page.locator("#repSeg button:disabled").count()) === 2, "схему задає умова: перемикачі неактивні");
  ok(/Порядок важливий/.test(await page.textContent("#orderSeg")) && /Порядок неважливий/.test(await page.textContent("#orderSeg")), "підписи «важливий / неважливий»");
  await chip("Комісія");
  ok(digits(await txt("rCount")) === "120", "C(10,3) = 120");
  await chip("Призові місця");
  ok((await page.$$eval("#cmpTab tr.cur th", (e) => e.length)) === 1, "виділено поточну схему");

  await chip("Лотерея");
  ok(digits(await txt("rCount")) === "13983816", "C(49,6)");
  ok(/7,15·10⁻⁸/.test(await txt("probTab")), "ймовірність джекпота 7,15·10⁻⁸");
  ok(/0,0177/.test(await txt("viz")), "рівно три номери: 0,0177");
  ok(await page.locator("#rowSec").isVisible(), "для сполучень ряд Паскаля видно");
  await page.click("#viz .btn:text-is(\"Випадковий квиток\")");
  await page.click("#viz .btn:text-is(\"+1 000\")");
  ok(/Тиражів проведено: 1\s000/.test((await txt("viz")).replace(/\u00a0/g, " ")), "1 000 тиражів");
  ok((await page.locator("#viz .vz-grid button[aria-pressed=true]").count()) === 6, "обрано 6 номерів");
  await page.click("#viz .btn:text-is(\"Тираж\")");
  ok((await page.locator("#viz .vz-grid button.drawn").count()) === 6, "у тиражі виділено 6 номерів");

  // клітинки: Призові місця, крок і вибір з пулу
  await chip("Призові місця");
  await page.click("#viz .vz-pool button:text-is(\"C\")");
  await page.click("#viz .btn:text-is(\"Крок\")");
  ok((await page.locator("#viz .vz-cell.filled").count()) === 2, "заповнено дві клітинки");
  ok(/10 · 9 = 90/.test(await txt("viz")), "добуток початків 10 · 9 = 90");
  ok(await page.locator("#viz .vz-pool button:text-is(\"C\")").isDisabled(), "використаний елемент недоступний");
  await page.click("#viz .btn:text-is(\"Заповнити випадково\")");
  ok(/Розміщення: /.test(await txt("vizMsg")), "після заповнення є підсумок");

  // сполучення: набір дає k! впорядкувань
  await chip("Комісія");
  ok((await page.locator("#viz .vz-tiles span").count()) === 6, "3! = 6 впорядкувань набору");
  await page.click("#vars li:nth-child(5) button");
  ok(/720 \/ 6 = 120/.test((await txt("viz")).replace(/\u00a0/g, " ")), "720 / 6 = 120");

  // зірочки й перегородки
  await chip("Тістечка");
  ok((await page.locator("#viz .vz-grp").count()) === 3, "три групи зірочок");
  ok(/C\(7, 2\)/.test(await txt("viz")), "C(7, 2) = 21");

  await chip("Кодовий замок");
  ok(digits(await txt("rCount")) === "10000", "10⁴");
  await chip("Тістечка");
  ok(digits(await txt("rCount")) === "21", "C̃(3,5) = 21");

  await chip("Розсадка в ряд");
  ok(digits(await txt("rCount")) === "720", "6! = 720");
  ok(await page.locator("#kRange").isDisabled(), "k дорівнює n, повзунок заблоковано");
  await setRange("nRange", "8");
  ok(digits(await txt("rCount")) === "40320", "8! = 40320");

  await chip("Круглий стіл");
  ok(digits(await txt("rCount")) === "5040" || digits(await txt("rCount")) === "120", "(n−1)!");
  await setRange("nRange", "6");
  ok(digits(await txt("rCount")) === "120", "(6−1)! = 120");

  await page.click("#viz .btn:text-is(\"Повернути стіл на одне місце\")");
  ok(/720 \/ 6 = 120/.test((await txt("viz")).replace(/\u00a0/g, " ")), "поворот: 720 / 6 = 120");

  await chip("Анаграми слова");
  ok(/24 разів/.test(await txt("viz")), "МАТЕМАТИКА: кожне слово 24 рази");
  await page.click("#viz .btn:text-is(\"Переставити однакові літери між собою\")");
  ok(digits(await txt("rCount")) === "151200", "МАТЕМАТИКА: 151 200");
  await page.fill("#wordInp", "ананас");
  ok(digits(await txt("rCount")) === "60", "АНАНАС: 6!/(3!·2!) = 60");
  ok((await page.inputValue("#wordInp")) === "АНАНАС", "поле переводить літери у великі");

  await chip("Дні народження");
  ok(/0,5073/.test(await txt("probTab")), "23 людини: 0,5073");
  ok(await page.locator("#nFld").isHidden(), "для днів народження повзунка n немає: завжди 365");
  ok(/P\(збіг\) = 1 − A\(365, 23\)/.test(await txt("probF")), "формула ймовірності збігу");
  ok(await page.locator("#rowSec").isVisible(), "для днів народження крива ймовірності");
  await page.click("#viz .btn:text-is(\"+1 000 груп\")");
  ok(/Груп: 1\s000/.test((await txt("viz")).replace(/\u00a0/g, " ")), "1 000 груп");
  ok(await page.locator("#vars").isHidden(), "перелік не показується для величезних чисел");

  await chip("Пароль (IT)");
  ok(digits(await txt("rCount")) === "218340105584896", "62⁸");

  // повзунок n не виводить k за межі, а повторення дозволяють k > n
  await chip("Призові місця");
  await setRange("nRange", "3");
  ok(Number(await page.getAttribute("#kRange", "max")) === 3, "без повторень k ≤ n");
  await chip("Кодовий замок");
  await setRange("nRange", "3");
  ok(Number(await page.getAttribute("#kRange", "max")) === 8, "з повтореннями k до 8 і за малого n");

  // телефон: без горизонтальної прокрутки
  await page.setViewportSize({ width: 375, height: 800 });
  await chip("Лотерея");
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "немає горизонтальної прокрутки на 375px");

  ok(errors.length === 0, "помилки: " + errors.join("; "));
  await ctx.close();
}
