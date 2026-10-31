// Браузерна перевірка сторінки: distributions. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const PAGE = U("distributions.html");
function ok(c, m) { assert.ok(c, m); }
const num = (t) => parseFloat(t.replace('−', '-').replace(',', '.'));

export default async function (h) {
  const browser = h.browser;
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(PAGE);
  await page.waitForTimeout(400);
  const txt = (id) => page.textContent('#' + id);
  const chip = (name) => page.click(`.chip:text-is("${name}")`);

  ok((await txt('title')).includes('Біноміальний розподіл B(20; 0,4)'), 'старт: ' + await txt('title'));
  ok(Math.abs(num(await txt('pval')) - 0.5956) < 1e-4, 'B(20; 0,4): P(X ≤ 8) = ' + await txt('pval') + ' (scipy 0,5956)');
  ok((await txt('sMean')).trim() === '8' && (await txt('sVar')).trim() === '4,8', 'середнє 8, дисперсія 4,8');

  ok(await page.locator('#bRow').isHidden(), 'P(X ≤ a): рядок межі b схований');
  await page.click('#cBt');
  ok(!(await page.locator('#bRow').isHidden()), 'P(a ≤ X ≤ b): рядок межі b видно');
  await page.click('#cLe');
  await chip('Геометричний');
  ok(await page.locator('#overlayBox').isHidden(), 'геометричний: перемикач нормального наближення схований');
  await chip('Біноміальний');
  ok(!(await page.locator('#overlayBox').isHidden()), 'біноміальний: перемикач нормального наближення видно');
  // усі розподіли: вибір, обидва режими, таблиця, жодних помилок
  const names = ['Біноміальний','Геометричний','Пуассона','Гіпергеометричний','Нормальний','Показниковий','Рівномірний','Хі-квадрат','Стьюдента','Фішера'];
  await page.click('#tableBox summary');
  for (const nm of names) {
    await chip(nm);
    const t = await txt('title');
    const p1 = await txt('pval');
    await page.click('#modeCdf');
    await page.click('#modeDens');
    const rows = await page.locator('#tbody tr').count();
    const pv = num(p1);
    ok(t.length > 5 && pv >= 0 && pv <= 1 && rows > 1, `${nm}: «${t}», P=${p1}, рядків таблиці ${rows}`);
  }

  // точні значення
  await chip('Нормальний');
  ok((await txt('pval')).trim() === '0,5000', 'N(0;1): P(X ≤ 0) = 0,5000');
  await page.click('#cBt');
  await page.fill('#aNum', '-1.96'); await page.press('#aNum', 'Tab');
  await page.fill('#bNum', '1.96'); await page.press('#bNum', 'Tab');
  ok(Math.abs(num(await txt('pval')) - 0.95) < 0.003, 'N(0;1): P(−1,96 ≤ X ≤ 1,96) ≈ 0,95: ' + await txt('pval') + ' (крок повзунка ' + await page.getAttribute('#aRange','step') + ')');
  await chip('Хі-квадрат');
  await page.click('#cLe');
  ok(Math.abs(num(await txt('pval')) - 0.5940) < 1e-3, 'χ²(4): P(X ≤ 4) ≈ 0,5940: ' + await txt('pval'));
  await chip('Стьюдента');
  ok((await txt('pval')).trim() === '0,5000', 't(5): P(X ≤ 0) = 0,5000');

  // параметри: гіпергеометричний — залежні межі
  await chip('Гіпергеометричний');
  await page.fill('#n-N', '10'); await page.press('#n-N', 'Tab');
  const K = await page.inputValue('#n-K'), nn = await page.inputValue('#n-n');
  ok(Number(K) <= 10 && Number(nn) <= 10, `гіпергеометричний: після N=10 K=${K}, n=${nn} (≤ 10)`);
  await chip('Рівномірний');
  await page.fill('#n-a', '9'); await page.press('#n-a', 'Tab');
  ok(Number(await page.inputValue('#n-a')) < Number(await page.inputValue('#n-b')), 'рівномірний: a < b: a=' + await page.inputValue('#n-a') + ', b=' + await page.inputValue('#n-b'));

  // біноміальний: зміна n і перемикач накладання
  await chip('Біноміальний');
  await page.fill('#n-n', '50'); await page.press('#n-n', 'Tab');
  ok((await txt('title')).includes('B(50; 0,4)'), 'зміна n: ' + await txt('title'));
  ok(!(await page.locator('#overlayBox').isHidden()), 'є перемикач нормального наближення');
  await page.check('#overlay');
  ok((await txt('legend')).includes('Нормальне наближення'), 'легенда містить нормальне наближення');
  
  await page.click('#modeCdf');
  
  await page.click('#modeDens');

  await chip('Хі-квадрат'); await page.fill('#n-k', '1'); await page.press('#n-k', 'Tab');
  
  await chip('Фішера'); await page.fill('#n-d2', '1'); await page.press('#n-d2', 'Tab');
  ok((await txt('sNote')).includes('нескінченні'), 'Фішера d₂=1: нота про нескінченні моменти');
  
  await chip('Стьюдента'); await page.fill('#n-nu', '1'); await page.press('#n-nu', 'Tab');
  ok((await txt('sMean')).includes('не існує'), 'Стьюдента ν=1: середнє не існує');
  await chip('Нормальний');
  await page.click('#cBt');
  

  // телефон, темна тема
  const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2, hasTouch: true });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errors.push('pageerror(phone): ' + e.message));
  await p2.goto(PAGE); await p2.waitForTimeout(400);
  await p2.click('.chip:text-is("Гіпергеометричний")');
  const sw = await p2.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  ok(sw.sw <= sw.iw + 1, `телефон: немає горизонтального прокручування (${sw.sw} ≤ ${sw.iw})`);
  
  

  // головна
  const p3 = await ctx.newPage();
  await p3.goto(U("index.html"));
  ok(await p3.locator('.topic a').count() === h.pages.length, 'головна: п\'ять карток');

  ok(errors.length === 0, 'немає помилок у консолі' + (errors.length ? ': ' + errors.join(' | ') : ''));
}
