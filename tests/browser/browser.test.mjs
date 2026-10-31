// Браузерні перевірки всіх сторінок (Playwright, Chromium).
// Запуск: npm run test:browser  (див. CLAUDE.md, розділ 7).
// Кожен файл у cases/ експортує async-функцію, яка отримує { browser, pages } і кидає помилку, якщо щось не так.
import test, { before, after } from "node:test";
import { createRequire } from "node:module";
import { readdirSync } from "node:fs";

// createRequire, а не import: так знаходиться і локальний пакет, і глобальний (через NODE_PATH).
const { chromium } = createRequire(import.meta.url)("playwright");
const root = new URL("../../", import.meta.url);
const pages = readdirSync(root).filter((f) => f.endsWith(".html") && f !== "index.html").sort();
const cases = readdirSync(new URL("./cases/", import.meta.url)).filter((f) => f.endsWith(".mjs")).sort();

let browser;
before(async () => {
  browser = await chromium.launch();
  // Шрифти Google не потрібні для перевірок: блокуємо, щоб тести не залежали від мережі.
  const original = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await original(options);
    await context.route(/fonts\.(googleapis|gstatic)/, (route) => route.abort());
    return context;
  };
});
after(async () => { if (browser) await browser.close(); });

for (const file of cases) {
  test(file.replace(/\.mjs$/, ""), { timeout: 240000 }, async () => {
    const log = console.log;
    console.log = () => {};               // старі діагностичні виводи не потрібні в звіті
    try {
      const mod = await import("./cases/" + file);
      await mod.default({ browser, pages });
    } finally { console.log = log; }
  });
}
