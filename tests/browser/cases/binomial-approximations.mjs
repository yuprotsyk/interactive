// Наближення біноміального розподілу: ключові числа, режими, крайні значення.
import assert from "node:assert";

const PAGE = new URL("../../../binomial-approximations.html", import.meta.url).href;
const num = (s) => parseFloat(s.replace(/\s/g, "").replace(",", ".").replace("−", "-"));

export default async function (h) {
  const errors = [];
  const ctx = await h.browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
  await p.goto(PAGE);
  await p.waitForSelector("#chips .chip");

  const q = () => p.evaluate(() => ({
    d: [...document.querySelectorAll(".qd")].map((e) => e.textContent),
    verdict: document.getElementById("verdict").textContent,
    n: document.getElementById("nOut").textContent,
    v: document.getElementById("vOut").textContent,
    rows: [...document.querySelectorAll("#eBody tr")].map((r) => [...r.children].map((c) => c.textContent)),
    text: document.body.innerText
  }));
  const bad = (t, label) => assert.ok(!/NaN|Infinity|undefined|null/.test(t), label + ": " + (t.match(/.{15}(NaN|Infinity|undefined|null).{15}/) || [""])[0]);

  // типовий стан: монета n = 40, p = 0,5 (еталони зі scipy: d для нормального 0,0030, для Пуассона 0,1668)
  let s = await q();
  assert.equal(s.n, "40"); assert.equal(s.v, "0,500");
  assert.ok(Math.abs(num(s.d[0]) - 0.0030) < 0.0006, "d нормального " + s.d[0]);
  assert.ok(Math.abs(num(s.d[1]) - 0.1668) < 0.001, "d Пуассона " + s.d[1]);
  assert.match(s.verdict, /Нормальне наближає краще/);
  assert.equal(s.rows.length, 4);
  // поправка на неперервність наближає краще, ніж без неї
  const err = (r) => Math.abs(num(r[2]));
  assert.ok(err(s.rows[1]) < err(s.rows[2]), "з поправкою похибка менша");

  // приклади: рідкісна подія — Пуассон кращий; n = 100, p = 0,3 — нормальне краще
  await p.click("#chips .chip:nth-child(2)");
  s = await q(); assert.match(s.verdict, /Пуассон наближає краще/);
  await p.click("#chips .chip:nth-child(3)");
  s = await q(); assert.match(s.verdict, /Нормальне наближає краще/); assert.equal(s.n, "100");
  await p.click("#chips .chip:nth-child(5)");
  s = await q(); assert.match(s.verdict, /Обидва наближення грубі/);

  // режим «λ = np»: при зміні n значення np лишається сталим
  await p.click("#chips .chip:nth-child(4)");
  await p.click("#lockL");
  const lam0 = await p.evaluate(() => document.getElementById("derived").textContent);
  await p.fill("#nRange", "250"); await p.dispatchEvent("#nRange", "input");   // n ≈ 316, p = λ/n
  const lam1 = await p.evaluate(() => document.getElementById("derived").textContent);
  const np = (t) => t.match(/np\s*=\s*([\d,]+)/)[1];
  assert.equal(np(lam0), np(lam1), "np сталe: " + lam0 + " → " + lam1);

  // подія a ≤ X ≤ b: переставлення меж, вихід за межі n
  await p.click("#lockP");
  await p.click("#chips .chip:nth-child(1)");
  await p.fill("#aIn", "30"); await p.fill("#bIn", "10");
  s = await q();
  await p.fill("#aIn", "-5"); await p.fill("#bIn", "999");
  await p.dispatchEvent("#bIn", "change"); await p.dispatchEvent("#aIn", "change");
  s = await q(); assert.ok(Math.abs(num(s.rows[0][1]) - 1) < 1e-4, "P(0 ≤ X ≤ n) = 1: " + s.rows[0][1]);
  bad(s.text, "подія");

  // крайні значення без NaN і помилок
  for (const [pos, v] of [[0, 0.001], [0, 0.999], [300, 0.001], [300, 0.999], [100, 0.5]]) {
    await p.fill("#nRange", String(pos)); await p.dispatchEvent("#nRange", "input");
    await p.fill("#vRange", String(v)); await p.dispatchEvent("#vRange", "input");
    await p.waitForTimeout(50);
    s = await q(); bad(s.text, `n-позиція ${pos}, p ${v}`);
  }
  await p.click("#showN"); await p.click("#showP"); await p.click("#showN"); await p.click("#showP");

  // анімація: n зростає, потім зупинка
  await p.click("#chips .chip:nth-child(5)");
  await p.click("#play");
  await p.waitForTimeout(500);
  const n1 = Number((await q()).n);
  assert.ok(n1 > 10, "n зростає під час анімації: " + n1);
  await p.click("#play");
  const n2 = Number((await q()).n); await p.waitForTimeout(300);
  assert.equal(Number((await q()).n), n2, "після зупинки n не змінюється");

  // таблиця значень відкривається й не містить NaN
  await p.click(".tablebox summary");
  bad((await q()).text, "таблиця");
  assert.deepEqual(errors, []);
  await ctx.close();
}
