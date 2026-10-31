// Браузерна перевірка сторінки: summaries-edge. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
const base = U('');
async function inv(p, label, expectN) {
  await p.waitForTimeout(100);
  const txt = await p.evaluate(() => document.body.innerText);
  assert(!/NaN|Infinity|undefined|null/.test(txt), label + ' bad text: ' + (txt.match(/.{20}(NaN|Infinity|undefined|null).{20}/)||[''])[0]);
  const t = await p.evaluate(() => [...document.querySelectorAll('#sBody tr')].map(tr => { const c = tr.children; return { f: +c[tr.querySelector('input') ? (c.length===6?2:1) : 1].querySelector('input').value, cum: c[c.length-3].textContent, rel: c[c.length-2].textContent, rc: c[c.length-1].textContent }; }));
  const n = t.reduce((a, r) => a + r.f, 0);
  if (expectN !== undefined) assert.equal(n, expectN, label + ' n');
  if (n) {
    assert.equal(+t[t.length-1].cum, n, label + ' last cum');
    assert.equal(num(t[t.length-1].rc), 1, label + ' last relcum');
    const sr = t.reduce((a, r) => a + num(r.rel), 0); assert(Math.abs(sr - 1) < 0.01 * t.length, label + ' sum rel ' + sr);
  }
  return n;
}
export default async function (h) {
  const b = h.browser; const errs = [];
  const mk = async url => { const p = await (await b.newContext({ viewport: {width:1280,height:900} })).newPage();
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort()); await p.goto(base+url); await p.waitForSelector('#chips .chip'); return p; };
  // ---- дискретна
  let p = await mk('discrete-summaries.html');
  await p.click('details.list summary');
  const rows = async () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#rBody tr')].map(tr => [tr.children[0].textContent, tr.children[1].textContent])));
  const cases = { 'усі однакові': ['5 5 5 5', 4], 'усі різні': ['1 2 3 4 5', 5], 'n=1': ['7', 1], 'n=2': ['3 9', 2], 'парна': ['1 2 3 4', 4], 'непарна': ['1 2 3 4 5', 5], 'нулі й повтори': ['0 0 0 2 2 5 0', 7], 'від’ємні': ['-3 -1 -1 0 2', 5], 'викид': ['1 2 2 3 3 3 4 4 30', 9] };
  for (const [k, [txt, n]] of Object.entries(cases)) {
    for (const dd of ['#dd0', '#dd1']) { await p.click(dd); await p.fill('#dataTa', txt); await inv(p, 'disc ' + k, n); }
    for (const t of ['#kRel', '#kAbs']) await p.click(t);
  }
  await p.fill('#dataTa', '5 5 5 5'); let r = await rows();
  assert.equal(r['Станд. відхилення'], '0'); assert.equal(r['Мода Mo'], '5');
  await p.fill('#dataTa', '-3 -1 -1 0 2'); r = await rows(); assert.equal(r['Коеф. варіації'], '—'); assert(/Коефіцієнт варіації не обчислено/.test(await p.textContent('#warns')));
  await p.fill('#dataTa', '1 2 2 3 3 3 4 4 30'); assert(/Потенційні викиди/.test(await p.textContent('#warns')));
  await p.fill('#dataTa', '1 2 3 4'); r = await rows(); assert.equal(r['Медіана Me'], '2,5'); assert.equal(r['Q₁'], '1,5'); assert.equal(r['Q₃'], '3,5');
  await p.fill('#dataTa', '1 2 3 4 5'); r = await rows(); assert.equal(r['Q₁'], '1,5'); assert.equal(r['Q₃'], '4,5');
  await p.close();
  // ---- неперервна
  p = await mk('continuous-summaries.html');
  await p.click('details.list summary');
  const crows = async () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#rBody tr')].map(tr => [tr.children[0].textContent, [...tr.children].slice(1).map(c=>c.textContent)])));
  const build = async (txt) => { await p.fill('#dataTa', txt); await p.click('#buildBtn'); };
  const ccases = { 'усі однакові': ['4 4 4 4', 4], 'усі різні': ['1 2 3 4 5 6 7 8', 8], 'n=2': ['3 9', 2], 'парна': ['1 2 3 4 5 6', 6], 'непарна': ['1 2 3 4 5 6 7', 7], 'викид': ['10 11 11 12 12 12 13 13 14 60', 10], 'дробові': ['1,5 2,25 2,5 3,75 4', 5], 'від’ємні': ['-5 -2 0 1 3', 5] };
  for (const [k, [txt, n]] of Object.entries(ccases)) {
    for (const dd of ['#dd0', '#dd1']) { await p.click(dd); await build(txt); await inv(p, 'cont ' + k, n); }
    for (const t of ['#kRel', '#kAbs']) await p.click(t);
  }
  // максимум на межі
  await build('0 10 10 19 20'); await p.fill('#x0In', '0'); await p.fill('#hIn', '10'); await p.dispatchEvent('#hIn', 'change');
  await inv(p, 'межа', 5);
  assert.equal(await p.locator('#sBody tr').count(), 2);
  assert.equal(await p.locator('#sBody tr:last-child th').textContent(), '[10; 20]');
  assert.equal(await p.locator('#sBody tr:last-child input').inputValue(), '4');
  // різна кількість інтервалів
  for (const h of ['1', '2', '5', '20', '40']) { await p.fill('#hIn', h); await p.dispatchEvent('#hIn', 'change'); await inv(p, 'h=' + h, 5); }
  // боксплот і викиди
  await build('10 11 11 12 12 12 13 13 14 60');
  assert(await p.locator('#boxWrap').isVisible());
  assert(/Потенційні викиди/.test(await p.textContent('#warns')));
  const rr = await crows(); assert.equal(rr['Мода Mo'].length, 2);
  // n = 1 не допустимо, 'abc'
  await build('5'); assert(/хоча б два/.test(await p.textContent('#dMsg')));
  // підручник: усе узгоджено
  await p.click('#chips .chip:nth-child(1)'); await inv(p, 'book', 50);
  assert(!(await p.locator('#boxWrap').isVisible()));
  assert.deepEqual(errs, []);
}
