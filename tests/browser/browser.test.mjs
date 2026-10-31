// Браузерні перевірки всіх сторінок (Playwright, Chromium).
// Запуск: npm run test:browser  (див. CLAUDE.md, розділ 7).
// Кожен файл у cases/ експортує async-функцію, яка отримує { browser, pages } і кидає помилку, якщо щось не так.
import test, { before, after } from "node:test";
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// createRequire, а не import: так знаходиться і локальний пакет, і глобальний (через NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");
const root = new URL("../../", import.meta.url);
const pages = readdirSync(root).filter((f) => f.endsWith(".html") && f !== "index.html").sort();
const cases = readdirSync(new URL("./cases/", import.meta.url)).filter((f) => f.endsWith(".mjs")).sort();

// KaTeX на сторінках підключається з CDN; у тестах віддаємо його з локального пакета katex (та сама версія).
const katexDist = dirname(createRequire(import.meta.url).resolve("katex/dist/katex.min.js"));
const katexVersion = createRequire(import.meta.url)("katex/package.json").version;
const MIME = { css: "text/css", js: "text/javascript", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf" };

let browser;
before(async () => {
  browser = await chromium.launch();
  // Шрифти Google не потрібні для перевірок: блокуємо, щоб тести не залежали від мережі.
  const original = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await original(options);
    await context.route(/fonts\.(googleapis|gstatic)/, (route) => route.abort());
    await context.route(/cdn\.jsdelivr\.net\/npm\/katex@/, (route) => {
      // Більшість перевірок читає текст сторінки, тому KaTeX їм не потрібен: вони йдуть без нього
      // (це заодно перевіряє запасний простий запис). З KaTeX працюють лише кейси з katexCases.
      if (!browser.katex) return route.abort();
      const url = new URL(route.request().url());
      const m = /^\/npm\/katex@([^/]+)\/dist\/(.+)$/.exec(url.pathname);
      if (!m || m[1] !== katexVersion) return route.abort();   // версія на сторінці має збігатися з пакетом
      try {
        const body = readFileSync(join(katexDist, m[2]));
        route.fulfill({ status: 200, body, contentType: MIME[m[2].split(".").pop()] || "application/octet-stream",
          headers: { "access-control-allow-origin": "*" } });
      } catch { route.abort(); }
    });
    return context;
  };
});
after(async () => { if (browser) await browser.close(); });

const katexCases = new Set(["all-pages.mjs", "formulas.mjs"]);
for (const file of cases) {
  test(file.replace(/\.mjs$/, ""), { timeout: 240000 }, async () => {
    browser.katex = katexCases.has(file);
    const log = console.log;
    console.log = () => {};               // старі діагностичні виводи не потрібні в звіті
    try {
      const mod = await import("./cases/" + file);
      await mod.default({ browser, pages });
    } finally { console.log = log; }
  });
}
