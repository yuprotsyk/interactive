// Браузерна перевірка сторінки: large-numbers-edge. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  const p = await (await b.newContext({ viewport: {width:1280,height:900} })).newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await p.goto(U("large-numbers.html")); await p.waitForSelector('#chips .chip');
  const n = await p.locator('#chips .chip').count();
  const check = async l => { await p.waitForTimeout(60); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(l+': '+m[0].replace(/\n/g,' ')); };
  for (let i = 0; i < n; i++) {
    await p.locator('#chips .chip').nth(i).click(); const nm = await p.locator('#chips .chip').nth(i).textContent();
    await check(nm+' start');
    for (const id of ['#add10','#add100','#add1000','#add10000']) { await p.click(id); await check(nm+id); }
    if (await p.locator('#pFld').isVisible()) for (const v of [0,1,0.5]) { await p.evaluate(v=>{const r=document.getElementById('pRange');r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))},v); await p.click('#add100'); await check(nm+' p='+v); }
    for (const v of [1,2,30]) { await p.evaluate(v=>{const r=document.getElementById('serRange');r.value=Math.min(v,+r.max);r.dispatchEvent(new Event('input',{bubbles:true}))},v); await p.click('#add10'); await check(nm+' ser='+v); }
    await p.uncheck('#logScale'); await check(nm+' lin'); await p.check('#logScale'); if (await p.locator('#showBand').isEnabled()) { await p.uncheck('#showBand'); await check(nm+' noband'); await p.check('#showBand'); }
    await p.click('#tableBox summary'); await check(nm+' table'); await p.click('#tableBox summary'); await p.click('#fresh'); await check(nm+' fresh');
    console.log(nm, '|', (await p.textContent('#rMean')), (await p.textContent('#rMu')), (await p.textContent('#rSpread')), (await p.textContent('#rTheory')));
  }
  await p.click('#chips .chip >> nth=0'); await p.click('#add10000'); console.log('coin 10000:', await p.textContent('#rMean'), await p.textContent('#rSpread'), await p.textContent('#rTheory'));
  assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
