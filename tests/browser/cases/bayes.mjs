// Браузерна перевірка сторінки: bayes. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const url = U("bayes.html");
const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
const close = (a,b,e,m) => assert(Math.abs(a-b)<e, (m||'')+' '+a+' vs '+b);
export default async function (h) {
  const b = h.browser; const errs = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['dark',{width:1280,height:900},true]]) {
    const p = await (await b.newContext({ viewport: vp, colorScheme: dark?'dark':'light' })).newPage();
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
    await p.goto(url); await p.waitForSelector('#chips .chip');
    const rv = async () => num(await p.textContent('#rVal'));
    if (name==='desktop') {
      close(await rv(), 0.009/0.0981, 5e-5, 'медичний');
      await p.click('#mN'); close(await rv(), 0.001/(0.001+0.9009), 5e-5, 'не A');
      await p.click('#mA');
      await p.click('#chips .chip:nth-child(2)'); close(await rv(), 0.00099/(0.00099+0.00999), 5e-5, 'рідкісна');
      // таблиця: сума апостеріорних = 1
      close(num(await p.textContent('#tfoot td:last-child')), 1, 1e-9);
      // Монті
      await p.click('#chips .chip:nth-child(5)'); close(await rv(), 1/3, 5e-4, 'monty1');
      await p.click('#selChips .chip:nth-child(2)'); close(await rv(), 2/3, 5e-4, 'monty2');
      await p.click('#selChips .chip:nth-child(3)'); close(await rv(), 0, 1e-9, 'monty3');
      // три заводи і симуляція
      await p.click('#chips .chip:nth-child(4)'); await p.click('#selChips .chip:nth-child(1)');
      close(await rv(), 0.05/0.145, 5e-4, 'plants');
      for (let i=0;i<5;i++) await p.click('#sim10000');
      const shares = await p.evaluate(()=>[...document.querySelectorAll('#simBody tr')].map(r=>[...r.children].slice(2).map(c=>parseFloat(c.textContent.replace(',','.')))));
      shares.forEach(([a,t],i)=>close(a,t,0.01,'sim '+i));
      // dots: кількість відібраних (A) у підписі
      assert(/відібрано/.test(await p.textContent('#dMsg')));
      // кількість гіпотез
      for (const k of [4,3,2]) { await p.click(`[data-k="${k}"]`); assert.equal(await p.locator('#hrows .hrow').count(), k); assert.equal(await p.locator('#tbody tr').count(), k); assert.equal(await p.locator('#bars li').count(), k);
        close(num(await p.textContent('#tfoot td:last-child')),1,1e-9,'sum k'+k); }
      // послідовність
      await p.click('#chips .chip:nth-child(1)');
      await p.click('#sPlus'); await p.click('#sPlus'); await p.click('#sMinus');
      assert.equal(await p.locator('#sBody tr').count(), 4);
      const lastRow = await p.evaluate(()=>[...document.querySelector('#sBody tr:last-child').children].map(c=>c.textContent));
      const a=0.01*0.9*0.9*0.1, bb=0.99*0.09*0.09*0.91; close(num(lastRow[1]), a/(a+bb), 5e-4,'seq');
      await p.click('#sUndo'); assert.equal(await p.locator('#sBody tr').count(), 3);
      await p.click('#sReset'); assert.equal(await p.locator('#sBody tr').count(), 1); assert(await p.isDisabled('#sUndo'));
      for (let i=0;i<14;i++) if (await p.isEnabled('#sPlus')) await p.click('#sPlus');
      assert(await p.isDisabled('#sPlus')); assert.equal(await p.locator('#sBody tr').count(), 13);
      // слайдери: змінити prior
      await p.evaluate(()=>{const r=document.querySelector('#hrows .hrow input');r.value=0.5;r.dispatchEvent(new Event('input',{bubbles:true}));});
      assert(/змінено вами/.test(await p.textContent('#srcNote')));
      // неможлива подія: lik=0 для всіх, режим A
      await p.evaluate(()=>{document.querySelectorAll('#hrows .hrow').forEach(r=>{const i=r.querySelectorAll('input')[1];i.value=0;i.dispatchEvent(new Event('input',{bubbles:true}));});});
      assert.equal((await p.textContent('#rVal')).trim(),'—'); assert(/неможлива/.test(await p.textContent('#dMsg')));
      await p.click('#chips .chip:nth-child(1)');
      
    }
    if (name==='phone') {
      assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=390,'hscroll');
      await p.click('#chips .chip:nth-child(4)'); await p.click('#sPlus'); await p.click('#sim1000');
      assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=390,'hscroll2');
      
    }
    if (name==='dark') { await p.click('#chips .chip:nth-child(4)'); await p.click('#sPlus');  }
  } assert.deepEqual(errs, []);
}
