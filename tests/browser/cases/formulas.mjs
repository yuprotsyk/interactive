// Формули KaTeX: динамічні блоки перемальовуються без помилок, а без CDN лишається простий запис.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

async function open(h, page, katex, errors) {
  h.browser.katex = katex;
  const ctx = await h.browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${page}: ${e}`));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_|integrity|Failed to load/.test(m.text())) errors.push(`${page}: ${m.text()}`); });
  await p.goto(U(page));
  return p;
}
const settled = (p) => p.waitForFunction(() => !document.querySelector(".tex:not([data-done])"), null, { timeout: 8000 });
const state = (p) => p.evaluate(() => ({
  total: document.querySelectorAll(".tex").length,
  ok: document.querySelectorAll(".tex .katex").length,
  err: [...document.querySelectorAll('.tex[data-done="err"]')].map((e) => e.getAttribute("data-src"))
}));
const tex = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s + " annotation")].map((a) => a.textContent), sel);

export default async function (h) {
  const errors = [];

  // Байєс: розрахунок перемальовується при зміні прикладу
  let p = await open(h, "bayes.html", true, errors);
  await settled(p);
  let a = await tex(p, "#formula");
  assert.ok(a.length >= 4, "розрахунок Байєса має кілька рядків-формул");
  assert.ok(a.some((t) => t.includes("\\mid")), "умовна ймовірність записана як P(A∣B)");
  await p.click("#chips .chip:nth-child(2)");
  await settled(p);
  assert.deepEqual((await state(p)).err, []);
  assert.equal((await state(p)).ok, (await state(p)).total, "bayes: усі формули намальовано після зміни");

  // Розподіли: формула кожного розподілу розбирається KaTeX, ключові фрагменти на місці
  p = await open(h, "distributions.html", true, errors);
  await settled(p);
  const chips = await p.$$eval("#chipsDiscrete button, #chipsContinuous button", (els) => els.length);
  assert.ok(chips >= 10, "кнопки розподілів знайдено");
  const buttons = await p.$$("#chipsDiscrete button, #chipsContinuous button");
  const seen = [];
  for (const b of buttons) {
    await b.click(); await settled(p);
    const st = await state(p);
    assert.deepEqual(st.err, [], "формули розподілу");
    seen.push((await tex(p, "#formula"))[0] || "");
  }
  assert.ok(seen.some((t) => t.includes("\\binom")), "біноміальний: C(n, k)");
  assert.ok(seen.some((t) => t.includes("\\sigma\\sqrt{2\\pi}")), "нормальний: 1/(σ√(2π))");
  assert.ok(seen.some((t) => t.includes("\\Gamma")), "хі-квадрат і Стьюдент: Γ");
  assert.ok(seen.every((t) => t.length > 5), "формула є в кожного розподілу");

  // Статистика: детальні обчислення
  for (const page of ["discrete-summaries.html", "continuous-summaries.html"]) {
    p = await open(h, page, true, errors);
    await settled(p);
    await p.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));
    await settled(p);
    const st = await state(p);
    assert.deepEqual(st.err, [], page);
    assert.equal(st.ok, st.total, page + ": усі формули намальовано");
    assert.ok((await tex(p, ".formula")).some((t) => t.includes("\\bar{x}")), page + ": x̄ у розрахунку");
  }

  // Умовна ймовірність і довірчі інтервали
  for (const page of ["conditional.html", "confidence-intervals.html"]) {
    p = await open(h, page, true, errors);
    await settled(p);
    const st = await state(p);
    assert.deepEqual(st.err, [], page);
    assert.equal(st.ok, st.total, page);
  }

  // Без CDN: простий запис на місці, помилок немає
  p = await open(h, "conditional.html", false, errors);
  await p.waitForTimeout(800);
  const plain = await p.evaluate(() => [...document.querySelectorAll(".tex")].map((e) => e.textContent).join(" | "));
  assert.ok(plain.includes("P(A ∩ B)"), "без KaTeX лишається простий запис");
  assert.equal((await state(p)).ok, 0);

  assert.deepEqual(errors, []);
}
