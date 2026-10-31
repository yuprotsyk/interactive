// Браузерна перевірка сторінки: central-limit. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const url = U("central-limit.html");
const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser;
  const errs = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['dark',{width:1280,height:900},true]]) {
    const ctx = await b.newContext({ viewport: vp, colorScheme: dark ? 'dark' : 'light' });
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(url);
    await p.waitForSelector('#chips .chip');
    if (name==='desktop') {
      // n=1: SD ~ sigma
      await p.click('#add1000');
      let sd = num(await p.textContent('#rSd')), th = num(await p.textContent('#rSdT'));
      assert(Math.abs(sd/th-1) < 0.08, 'n=1 sd '+sd+' '+th);
      // exponential, n=30
      await p.click('#chips .chip:nth-child(2)');
      await p.evaluate(() => { const r=document.getElementById('nRange'); r.value=30; r.dispatchEvent(new Event('input',{bubbles:true})); });
      await p.click('#add1000'); await p.click('#add1000');
      sd = num(await p.textContent('#rSd')); th = num(await p.textContent('#rSdT'));
      assert(Math.abs(sd/th-1) < 0.05, 'exp30 '+sd+' '+th);
      const sk = num(await p.textContent('#rSk')), skt = num(await p.textContent('#rSkT'));
      assert(Math.abs(sk-skt) < 0.25, 'skew '+sk+' '+skt);
      const inn = num(await p.textContent('#rIn'));
      assert(inn>92 && inn<97, 'in '+inn);
      // coin discrete n=50
      await p.click('#chips .chip:nth-child(5)');
      await p.evaluate(() => { const r=document.getElementById('nRange'); r.value=50; r.dispatchEvent(new Event('input',{bubbles:true})); });
      await p.click('#add1000');
      assert(await p.isEnabled('#stMax'));
      // cauchy
      await p.click('#chips .chip:nth-child(6)');
      assert(await p.isDisabled('#stMax'), 'max disabled');
      assert(await p.isHidden('#expMain') && await p.isVisible('#expCauchy'));
      assert((await p.textContent('#rSd')).trim()==='—');
      assert(await p.isDisabled('#showNorm'));
      await p.click('#stMed');
      assert(await p.isVisible('#expMed'));
      sd = num(await p.textContent('#rSd')); assert(sd < 1, 'cauchy median sd '+sd);
      // max on uniform
      await p.click('#chips .chip:nth-child(1)'); await p.click('#stMax');
      assert(await p.isVisible('#expMax') && await p.isHidden('#showNorm') === false);
      assert(await p.isDisabled('#showNorm'));
      // table
      await p.click('#stMean');
      await p.click('#tableBox summary');
      await p.waitForSelector('#tbody tr');
      assert.equal(await p.locator('#tbody tr').count(), 6);
      // play
      await p.click('#play'); await p.waitForTimeout(600); await p.click('#play');
      
    }
    if (name==='phone') {
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      assert(sw <= 390, 'hscroll '+sw);
      await p.click('#chips .chip:nth-child(2)');
      await p.evaluate(() => { const r=document.getElementById('nRange'); r.value=10; r.dispatchEvent(new Event('input',{bubbles:true})); });
      
    }
    if (name==='dark') { await p.click('#chips .chip:nth-child(3)');  }
    await ctx.close();
  }
  assert.deepEqual(errs, []);
}
