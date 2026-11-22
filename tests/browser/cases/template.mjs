// Шаблон нової сторінки (templates/template.html): відкривається без помилок, без горизонтального прокручування,
// у світлій і темній темі, «Докладніше» згорнуте, повзунок оновлює результат.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const errors = [];
  for (const [w, dark] of [[360, false], [1280, false], [1280, true]]) {
    const ctx = await h.browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: dark ? "dark" : "light" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
    await p.goto(U("templates/template.html"));
    await p.waitForTimeout(300);
    const info = await p.evaluate(() => ({
      over: document.documentElement.scrollWidth - innerWidth,
      h1: document.querySelectorAll("h1").length,
      open: document.querySelector("#eTitle ~ details").open,
      live: !!document.querySelector('[aria-live="polite"]')
    }));
    assert.ok(info.over <= 0, `шаблон ${w}px: горизонтальне прокручування`);
    assert.equal(info.h1, 1);
    assert.equal(info.open, false, "«Докладніше» має бути згорнутим");
    assert.ok(info.live, "немає aria-live");
    const before = await p.textContent("#rVal");
    await p.evaluate(() => { const r = document.getElementById("nRange"); r.value = "16"; r.dispatchEvent(new Event("input")); });
    assert.notEqual(await p.textContent("#rVal"), before, "повзунок не оновив результат");
    await ctx.close();
  }
  assert.deepEqual(errors, []);
}
