// Браузерна перевірка сторінки: central-limit-edge. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  const p = await (await b.newContext({ viewport: {width:1280,height:900} })).newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await p.goto(U("central-limit.html")); await p.waitForSelector('#chips .chip');
  const n = await p.locator('#chips .chip').count();
  const check = async l => { await p.waitForTimeout(80); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(l+': '+m[0].replace(/\n/g,' ')); };
  const setn = v => p.evaluate(v=>{const r=document.getElementById('nRange');r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))},v);
  for (let i = 0; i < n; i++) {
    await p.locator('#chips .chip').nth(i).click(); const nm = await p.locator('#chips .chip').nth(i).textContent();
    for (const st of ['#stMean','#stMed','#stMax']) { if (!(await p.locator(st).isEnabled())) continue; await p.click(st);
      for (const v of [1,2,30,100]) { await setn(v); for (const a of ['#add100','#add1000']) { await p.click(a); } await check(nm+st+' n='+v); } 
      if (await p.locator('#showNorm').isEnabled()) { await p.uncheck('#showNorm'); await check(nm+' nonorm'); await p.check('#showNorm'); } }
    await p.click('#stMean'); await setn(30); await p.click('#fresh'); await p.click('#add1000'); await p.click('#add1000'); await p.click('#add1000');
    await p.waitForTimeout(150);
    console.log(nm.padEnd(20), 'SD', await p.textContent('#rSd'), 'теор', await p.textContent('#rSdT'), '| асим.', await p.textContent('#rSk'), 'теор', await p.textContent('#rSkT'), '| в межах', await p.textContent('#rIn'));
    await p.click('#tableBox summary'); await check(nm+' table'); await p.click('#tableBox summary');
  }
  assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
