// Браузерна перевірка сторінки: large-numbers. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const PAGE = U("large-numbers.html");
function ok(c, m) { assert.ok(c, m); }
const num = (t) => parseFloat(t.replace(/ /g, '').replace('−', '-').replace(',', '.'));

export default async function (h) {
  const browser = h.browser;
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(500);
  const txt = (id) => page.textContent('#' + id);
  const chip = (name) => page.click(`.chip:text-is("${name}")`);

  ok(num(await txt('rN')) === 50, 'старт: n = 50');
  const mean0 = await txt('rMean');
  ok(!(await page.locator('#chart2').isHidden()), 'другий графік видно');
  

  await page.click('#add1000');
  ok(num(await txt('rN')) === 1050, '+1 000: n = 1 050');
  await page.click('#add10000');
  ok(num(await txt('rN')) === 11050, '+10 000: n = 11 050');

  // запуск до межі
  await page.selectOption('#speed', '0.06');
  await page.click('#play');
  await page.waitForFunction(() => document.getElementById('rN').textContent.replace(/\s/g,'') === '100000', null, { timeout: 30000 });
  await page.waitForTimeout(200);
  ok((await txt('play')).includes('Запустити'), 'після межі кнопка знову «Запустити»');
  const m = num(await txt('rMean')), sp = num(await txt('rSpread')), th = num(await txt('rTheory'));
  ok(Math.abs(m - 0.5) < 0.01, `монета, n=100 000: середнє ${m} ≈ 0,5`);
  ok(sp / th > 0.4 && sp / th < 1.8, `розкид між серіями ${sp} ≈ теоретичний ${th} (відношення ${(sp/th).toFixed(2)})`);
  

  // межа: «+10» не змінює n
  await page.click('#add10');
  ok(num(await txt('rN')) === 100000, 'на межі n не росте');

  // таблиця
  await page.click('#tableBox summary');
  await page.waitForTimeout(300);
  ok(await page.locator('#tbody tr').count() === 5, 'таблиця: 5 контрольних n');

  // лінійна шкала, без смуги
  await page.uncheck('#logScale'); await page.uncheck('#showBand');
  
  await page.check('#logScale'); await page.check('#showBand');

  // p = 0.8
  await page.fill('#pRange', '0.8');
  await page.dispatchEvent('#pRange', 'input');
  ok((await txt('rMu')).trim() === '0,8', 'μ = p = 0,8: ' + await txt('rMu'));
  await page.click('#add10000');
  ok(Math.abs(num(await txt('rMean')) - 0.8) < 0.03, 'після +10 000 середнє поблизу 0,8: ' + await txt('rMean'));

  ok(!(await page.locator('#pFld').isHidden()), 'монета: повзунок p видно');
  // кубик
  await chip('Кубик');
  ok(await page.locator('#pFld').isHidden(), 'кубик: повзунок p схований');
  ok((await txt('rMu')).trim() === '3,5', 'кубик: μ = 3,5');
  await page.click('#add10000');
  ok(Math.abs(num(await txt('rMean')) - 3.5) < 0.1, 'кубик: середнє ≈ 3,5: ' + await txt('rMean'));

  // показниковий та нормальний
  await chip('Час очікування'); await page.click('#add10000');
  ok(Math.abs(num(await txt('rMean')) - 1) < 0.1, 'показниковий: середнє ≈ 1: ' + await txt('rMean'));
  await chip('Нормальний'); await page.click('#add10000');
  ok(Math.abs(num(await txt('rMean'))) < 0.1, 'нормальний: середнє ≈ 0: ' + await txt('rMean'));

  // Коші
  await chip('Коші (виняток)');
  ok(await page.locator('#chart2').isHidden(), 'Коші: другий графік схований');
  ok(await page.locator('#pFld').isHidden(), 'Коші: повзунок p схований');
  ok(await page.locator('#expMain').isHidden(), 'Коші: звичайне пояснення замінено на пояснення для Коші');
  ok(!(await page.locator('#noChart2').isHidden()) && !(await page.locator('#cauchyNote').isHidden()), 'Коші: пояснення видно');
  ok((await txt('rMu')).includes('не існує'), 'Коші: μ не існує');
  await page.click('#add10000'); await page.click('#add10000');
  
  await chip('Монета');
  ok(!(await page.locator('#chart2').isHidden()), 'повернення до монети: другий графік знову видно');

  // нова симуляція змінює результат; відтворюваність при перезавантаженні
  const before = await txt('rMean');
  await page.click('#fresh');
  ok((await txt('rMean')) !== before, 'нова симуляція дає інші числа');
  await page.reload(); await page.waitForTimeout(400);
  ok((await txt('rMean')) === mean0, 'за тим самим зерном результат відтворюється: ' + mean0);

  // серії
  await page.fill('#serRange', '1'); await page.dispatchEvent('#serRange', 'input');
  ok((await txt('rSpread')).trim() === '—', 'одна серія: розкид не визначений');

  // телефон + темна тема
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2, hasTouch: true });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errors.push('pageerror(phone): ' + e.message));
  await p2.goto(PAGE); await p2.waitForTimeout(500);
  await p2.click('#add10000');
  const sw = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(sw.sw <= sw.iw + 1, `телефон: немає горизонтального прокручування (${sw.sw} ≤ ${sw.iw})`);
  

  const p3 = await ctx.newPage();
  await p3.goto(U("index.html"));
  ok(await p3.locator('.topic a').count() >= 2, 'головна відкривається');

  ok(errors.length === 0, 'немає помилок у консолі' + (errors.length ? ': ' + errors.join(' | ') : ''));
}
