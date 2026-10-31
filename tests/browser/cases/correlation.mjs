// Браузерна перевірка сторінки: correlation. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const PAGE = U("correlation.html");
function ok(c, m) { assert.ok(c, m); }

export default async function (h) {
  const browser = h.browser;
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(400);

  const n = async () => parseInt(await page.textContent('#sN'));
  const r = async () => (await page.textContent('#rval')).trim();

  ok(await n() === 30, 'старт: 30 точок, r = ' + await r());
  ok(Math.abs(parseFloat((await r()).replace('+','').replace(',','.')) - 0.6) < 0.02, 'старт: r ≈ 0,6');

  const box = await page.locator('#plot').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  ok(await n() === 31, 'клацання додає точку');

  // перетягування
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 5 });
  await page.mouse.up();
  ok(await n() === 31, 'перетягування не додає нових точок');

  // клавіатура
  await page.focus('#plot');
  await page.keyboard.press('Enter');
  ok(await n() === 32, 'Enter додає точку з клавіатури');
  await page.keyboard.press(']');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Delete');
  ok(await n() === 31, '] вибір + Delete видаляє точку');
  await page.keyboard.press('Control+z');
  ok(await n() === 32, 'Ctrl+Z скасовує видалення');

  // скасувати кнопкою
  await page.click('#undo');
  ok(await n() === 32, 'кнопка «Скасувати»: повернення до стану перед переміщенням точки');
  await page.click('#undo');
  ok(await n() === 31, 'другий крок «Скасувати»: прибирає додану точку');

  // готовий набір
  await page.click('button.chip:has-text("Коло")');
  ok(await n() === 24 && /^0,0|^−0,0|^\+0,0/.test((await r()).replace('+','')) , 'набір «Коло»: n=24, r≈0 (' + await r() + ')');
  await page.click('button.chip:has-text("Парадокс Сімпсона")');
  ok(parseFloat((await r()).replace('+','').replace(',','.').replace('−','-')) > 0.5, 'Сімпсон: r додатний (' + await r() + ')');

  // свої дані
  await page.click('#sampleData');
  await page.click('#applyData');
  ok(await n() === 12, 'вставка прикладу: 12 точок');
  const rr = parseFloat((await r()).replace('+','').replace(',','.'));
  ok(rr > 0.98, 'приклад: r > 0,98 (' + await r() + ')');
  ok((await page.textContent('#rangeNote')).includes('Температура'), 'назви осей з першого рядка');
  ok((await page.textContent('#sP')).includes('0,001'), 'p < 0,001 для прикладу');

  // таблиця
  await page.click('#tableBox summary');
  await page.waitForSelector('#tbody tr');
  ok(await page.locator('#tbody tr').count() === 12, 'таблиця: 12 рядків');
  ok((await page.locator('#tbody tr').first().locator('.cx').inputValue()).includes(','), 'таблиця: десяткова кома');
  const cx = page.locator('#tbody tr').first().locator('.cx');
  await cx.fill('12,5');
  await cx.press('Tab');
  ok(await n() === 12, 'редагування клітинки зберігає кількість');
  await page.locator('#tbody tr').first().locator('.rowbtn').click();
  ok(await n() === 11 && await page.locator('#tbody tr').count() === 11, 'видалення рядка з таблиці');
  await page.click('#addRow');
  ok(await n() === 12, 'додавання точки з таблиці');

  // поганий ввід
  await page.fill('#pasteArea', 'нічого\nтут нема');
  await page.click('#applyData');
  ok((await page.textContent('#dataMsg')).includes('Не вдалося'), 'помилка для поганих даних');
  

  // телефон + темна тема
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2, hasTouch: true });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push('pageerror(phone): ' + e.message));
  await p2.goto(PAGE);
  await p2.waitForTimeout(400);
  const sw = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(sw.sw <= sw.iw + 1, `телефон: немає горизонтального прокручування (${sw.sw} ≤ ${sw.iw})`);
  const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(14, 20, 28)', 'темна тема: фон ' + bg);
  
  

  // головна сторінка
  const p3 = await ctx.newPage();
  await p3.goto(U("index.html"));
  ok(await p3.locator('.topic a').count() === h.pages.length, 'головна: п\'ять карток тем');
  await p3.click('a[href="correlation.html"]');
  ok(p3.url().endsWith('correlation.html'), 'посилання з головної веде на сторінку');
  ok(await p3.locator('.backlink').count() === 1, 'є посилання «Усі теми»');

  ok(errors.length === 0, 'немає помилок у консолі' + (errors.length ? ': ' + errors.join(' | ') : ''));
}
