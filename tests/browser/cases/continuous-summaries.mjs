// Браузерна перевірка сторінки: continuous-summaries. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const url = U("continuous-summaries.html");
const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser; const errs = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['phone360',{width:360,height:740},false],['dark',{width:1280,height:900},true]]) {
    const p = await (await b.newContext({ viewport: vp, colorScheme: dark?'dark':'light' })).newPage();
    p.on('pageerror', e => errs.push(name+': '+String(e)));
    p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(name+': '+m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
    await p.goto(url); await p.waitForSelector('#chips .chip');
    const rows = async () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#rBody tr')].map(tr => [tr.children[0].textContent, [...tr.children].slice(1).map(c=>c.textContent)])));
    let r = await rows();
    if (name==='desktop') {
      assert(Math.abs(num(r['Мода Mo'][0])-30.909)<1e-2, JSON.stringify(r));
      assert.equal(num(r['Медіана Me'][0]),28); assert.equal(num(r['Вибіркове середнє x̄'][0]),27);
      assert.equal(await p.locator('#sBody tr.hl-mode').count(),1);
      // дві вершини
      await p.click('#chips .chip:nth-child(4)');
      r = await rows(); assert(/;/.test(r['Мода Mo'][0]), r['Мода Mo'][0]);
      assert(/Кілька/.test(await p.textContent('#warns')));
      // однакові
      await p.click('#chips .chip:nth-child(6)');
      assert(/немає/.test((await rows())['Мода Mo'][0]));
      // зріст (виміри): порівняння
      await p.click('#chips .chip:nth-child(2)');
      r = await rows(); assert.equal(r['Мода Mo'].length,2);
      assert(Math.abs(num(r['Вибіркове середнє x̄'][0])-num(r['Вибіркове середнє x̄'][1]))<1.5, JSON.stringify(r['Вибіркове середнє x̄']));
      // зміна h з вимірів
      await p.fill('#hIn','2'); await p.dispatchEvent('#hIn','change');
      assert(await p.locator('#sBody tr').count()>5);
      assert((await rows())['Мода Mo'].length===2);
      // ручна зміна частоти → порівняння зникає
      await p.fill('#sBody tr:nth-child(2) input','9');
      assert((await rows())['Мода Mo'].length===1);
      await p.click('#undoBtn');
      // зарплати
      await p.click('#chips .chip:nth-child(3)');
      r = await rows(); assert(num(r['Вибіркове середнє x̄'][0]) > num(r['Медіана Me'][0]));
      // підручник + drag
      await p.click('#chips .chip:nth-child(1)');
      const bx = await p.locator('#cv').boundingBox();
      await p.mouse.click(bx.x+bx.width*0.5, bx.y+bx.height*0.4);
      // кількість інтервалів
      await p.fill('#mIn','8'); await p.dispatchEvent('#mIn','change');
      assert.equal(await p.locator('#sBody tr').count(),8);
      await p.fill('#mIn','3'); await p.dispatchEvent('#mIn','change');
      assert(/ненульові|Ці інтервали/.test(await p.textContent('#dMsg')) || await p.locator('#sBody tr').count()===8);
      // власні виміри
      await p.click('details.list summary');
      await p.fill('#dataTa','1,5 2 2,5 3 3 3,5 8'); await p.click('#buildBtn');
      assert(await p.locator('#sBody tr').count()>=2);
      await p.fill('#dataTa','1 abc'); await p.click('#buildBtn');
      assert(/хоча б два/.test(await p.textContent('#dMsg')));
      await p.check('#showSd'); await p.click('#dd1'); await p.uncheck('#showPoly');
    }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(sw <= 0, name+' horizontal scroll '+sw);
    await p.waitForTimeout(1200);
    
  }
  assert.deepEqual(errs, []);
}
