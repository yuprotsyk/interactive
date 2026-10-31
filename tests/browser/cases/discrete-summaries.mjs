// Браузерна перевірка сторінки: discrete-summaries. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const url = U("discrete-summaries.html");
const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser; const errs = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['phone360',{width:360,height:740},false],['dark',{width:1280,height:900},true]]) {
    const p = await (await b.newContext({ viewport: vp, colorScheme: dark?'dark':'light' })).newPage();
    p.on('pageerror', e => errs.push(name+': '+String(e)));
    p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(name+': '+m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort()); await p.goto(url); await p.waitForSelector('#chips .chip');
    const rows = async () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#rBody tr')].map(tr => [tr.children[0].textContent, tr.children[1].textContent])));
    let r = await rows();
    if (name==='desktop') {
      assert(Math.abs(num(r['Вибіркове середнє x̄'])-239/30)<1e-3, JSON.stringify(r));
      assert.equal(r['Медіана Me'],'8'); assert.equal(r['Мода Mo'],'8');
      // ввести частоту
      await p.fill('#sBody tr:nth-child(1) input','10'); // значення 1
      assert.equal(num((await rows())['Мода Mo']),1);
      await p.click('#undoBtn');
      assert.equal((await rows())['Мода Mo'],'8');
      // дві вершини
      await p.click('#chips .chip:nth-child(4)');
      assert.equal((await rows())['Мода Mo'],'3; 10');
      assert(/Кілька мод/.test(await p.textContent('#warns')));
      // однакові частоти
      await p.click('#chips .chip:nth-child(6)');
      assert(/немає/.test((await rows())['Мода Mo']));
      // список
      await p.click('details.list summary');
      await p.fill('#dataTa','1 2 2 3 3 3 4.5');
      assert(/Пропущено/.test(await p.textContent('#dMsg')));
      await p.fill('#dataTa','1 2 2 3 3 3 10');
      r = await rows(); assert.equal(r['Мода Mo'],'3'); assert.equal(r['Медіана Me'],'3');
      assert(/Потенційні викиди/.test(await p.textContent('#warns')));
      // клацання по стовпчику
      await p.click('#chips .chip:nth-child(1)');
      const box = await p.locator('#cv').boundingBox();
      await p.mouse.click(box.x+box.width*0.5, box.y+box.height*0.3);
      assert((await rows())['Мода Mo']!==undefined);
      // діапазон
      await p.fill('#hiIn','20'); await p.dispatchEvent('#hiIn','change');
      assert.equal(await p.locator('#sBody tr').count(), 20);
      await p.fill('#hiIn','5'); await p.dispatchEvent('#hiIn','change');
      assert(/мають входити/.test(await p.textContent('#dMsg')));
      // n-1
      await p.click('#chips .chip:nth-child(1)'); await p.click('#dd1');
      assert(/n − 1/.test(Object.keys(await rows()).join('|')));
      await p.check('#showSd');
    }
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert(sw <= 0, name+' horizontal scroll '+sw);
    await p.waitForTimeout(1200); 
  }
  assert.deepEqual(errs, []);
}
