// Браузерна перевірка сторінки: total-probability. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const url = U("total-probability.html");
const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser; const errs = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['dark',{width:1280,height:900},true]]) {
    const p = await (await b.newContext({ viewport: vp, colorScheme: dark?'dark':'light' })).newPage();
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
    await p.goto(url); await p.waitForSelector('#chips .chip');
    if (name==='desktop') {
      assert(Math.abs(num(await p.textContent('#rVal'))-0.55)<1e-9); await p.click('#chips .chip:nth-child(2)'); assert(Math.abs(num(await p.textContent('#rVal'))-0.145)<1e-9);
      assert.equal(await p.locator('#hrows .hrow').count(), 3);
      // preset 2
      await p.click('#chips .chip:nth-child(1)');
      assert(Math.abs(num(await p.textContent('#rVal'))-0.55)<1e-9);
      assert.equal(await p.locator('#hrows .hrow').count(), 2);
      // slider prior1 -> 1.0 : sum stays 1, P(A)=0.3
      await p.evaluate(()=>{const r=document.querySelector('#hrows .hrow input');r.value=1;r.dispatchEvent(new Event('input',{bubbles:true}));});
      assert(Math.abs(num(await p.textContent('#rVal'))-0.3)<1e-9);
      const tot = await p.evaluate(()=>[...document.querySelectorAll('#hrows .hrow')].map(r=>r.querySelector('output').textContent));
      assert.equal(tot[0],'1'); 
      // count 4 and 3 and back
      for (const k of [4,3,2,4]) {
        await p.click(`[data-k="${k}"]`);
        assert.equal(await p.locator('#hrows .hrow').count(), k);
        const rows = await p.locator('#tbody tr').count(); assert.equal(rows,k);
        const sum = num(await p.textContent('#tfoot td:nth-child(2)')); assert(Math.abs(sum-1)<1e-3,'sum '+sum);
      }
      await p.click('#vTree'); assert.equal(await p.getAttribute('#vTree','aria-pressed'),'true');
      assert((await p.textContent('#chTitle')).includes('Дерево'));
      for (const c of [1,2,3]) { await p.click(`#chips .chip:nth-child(${c})`); await p.click('#vSq'); await p.click('#vTree'); }
      
      await p.click('#vSq'); await p.click('#chips .chip:nth-child(1)');
      
    }
    if (name==='phone') {
      assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=390);
      
      await p.click('#vTree'); await p.click('[data-k="4"]'); 
      assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=390);
    }
    if (name==='dark') {  }
  } assert.deepEqual(errs, []);
}
