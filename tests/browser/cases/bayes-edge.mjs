// Браузерна перевірка сторінки: bayes-edge. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  const p = await (await b.newContext({ viewport: {width:1280,height:900} })).newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await p.goto(U("bayes.html")); await p.waitForSelector('#chips .chip');
  const check = async l => { await p.waitForTimeout(50); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(l+': '+m[0].replace(/\n/g,' ')); };
  const npre = await p.locator('#chips .chip').count();
  for (let c = 0; c < npre; c++) { await p.locator('#chips .chip').nth(c).click(); await check('preset '+c);
    for (const m of ['#mA','#mN']) { await p.click(m); await p.click('#sPlus'); await p.click('#sMinus'); await p.click('#sUndo'); await p.click('#sim1000'); await check('preset '+c+m); await p.click('#sReset'); await p.click('#simReset'); } }
  for (const k of [2,3,4]) { await p.click(`[data-k="${k}"]`);
    const m = await p.locator('#hrows input[type=range]').count();
    for (const mode of ['#mA','#mN']) { await p.click(mode);
      for (const v of [0, 1, 0.5]) for (let j = 0; j < m; j++) {
        await p.evaluate(([j, v]) => { const r = document.querySelectorAll('#hrows input[type=range]')[j]; r.value = Math.min(Math.max(v, +r.min), +r.max); r.dispatchEvent(new Event('input', { bubbles: true })); }, [j, v]);
        await check(`k=${k}${mode} j=${j} v=${v}`); }
      await p.click('#sPlus'); await p.click('#sim100'); await check(`k=${k}${mode} seq/sim`); await p.click('#sReset'); await p.click('#simReset'); } }
  // кілька підряд: пошук значення
  await p.locator('#chips .chip').nth(0).click(); await p.click('#mA');
  console.log(await p.textContent('#rVal'), '|', (await p.textContent('#formula')).replace(/\s+/g,' ').slice(0,200));
  assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
