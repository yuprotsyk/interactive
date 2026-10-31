// Загальна перевірка кожної сторінки: відкривається без помилок, немає горизонтального прокручування
// (360, 390, 1280 px), працює темна тема, у видимому тексті немає NaN/Infinity, а головна сторінка
// веде на всі сторінки проєкту.
import assert from "node:assert";
import { readFileSync } from "node:fs";

const U = (name) => new URL("../../../" + name, import.meta.url).href;
const BAD = /NaN|Infinity|undefined|null/;

export default async function (h) {
  const index = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
  const hrefs = [...index.matchAll(/<a href="([\w.-]+\.html)"/g)].map((m) => m[1]).filter((x) => x !== "index.html");
  for (const page of h.pages) assert.ok(hrefs.includes(page), `головна не посилається на ${page}`);
  for (const href of hrefs) assert.ok(h.pages.includes(href), `головна посилається на неіснуючу сторінку ${href}`);
  assert.equal(new Set(hrefs).size, hrefs.length, "картка на головній дублюється");

  const errors = [];
  for (const page of ["index.html", ...h.pages]) {
    for (const [w, dark] of [[360, false], [390, false], [1280, false], [1280, true]]) {
      const ctx = await h.browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: dark ? "dark" : "light" });
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(`${page}: ${e}`));
      p.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_/.test(m.text())) errors.push(`${page}: ${m.text()}`); });
      await p.goto(U(page));
      await p.waitForTimeout(400);
      const info = await p.evaluate(() => ({
        over: document.documentElement.scrollWidth - innerWidth,
        lang: document.documentElement.lang,
        title: document.title,
        h1: document.querySelectorAll("h1").length,
        text: document.body.innerText,
        hasCanvas: !!document.querySelector("canvas")
      }));
      assert.ok(info.over <= 0, `${page} ${w}px: горизонтальне прокручування ${info.over}`);
      assert.equal(info.lang, "uk", `${page}: lang`);
      assert.ok(info.title.length > 3, `${page}: порожній title`);
      assert.equal(info.h1, 1, `${page}: має бути один h1`);
      assert.ok(!BAD.test(info.text), `${page}: у тексті ${info.text.match(BAD)}`);
      await ctx.close();
    }
  }
  assert.deepEqual(errors, []);
}
