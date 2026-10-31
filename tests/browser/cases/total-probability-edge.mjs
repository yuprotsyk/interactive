// Браузерна перевірка сторінки: total-probability-edge. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-').replace('%',''));
export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  const p = await (await b.newContext({ viewport: {width:1280,height:900} })).newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await p.goto(U("total-probability.html")); await p.waitForSelector('#chips .chip');
  const check = async l => { await p.waitForTimeout(60); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(l+': '+m[0].replace(/\n/g,' ')); };
  console.log(await p.evaluate(() => [...document.querySelectorAll('#hrows input')].map(i => i.type + ':' + (i.getAttribute('aria-label')||i.id)).join(' | ')));
  const npre = await p.locator('#chips .chip').count();
  for (let c = 0; c < npre; c++) { await p.locator('#chips .chip').nth(c).click(); await check('preset '+c); }
  for (const k of [2,3,4]) {
    await p.click(`[data-k="${k}"]`);
    const m = await p.locator('#hrows input[type=range]').count();
    for (const view of ['#vSq', '#vTree']) { await p.click(view);
      for (const v of [0, 1, 0.5]) for (let j = 0; j < m; j++) {
        await p.evaluate(([j, v]) => { const r = document.querySelectorAll('#hrows input[type=range]')[j]; r.value = Math.min(Math.max(v, +r.min), +r.max); r.dispatchEvent(new Event('input', { bubbles: true })); }, [j, v]);
        await check(`k=${k} ${view} j=${j} v=${v}`);
        const t = await p.evaluate(() => document.getElementById('rVal').textContent); const x = num(t);
        if (!(x >= 0 && x <= 100.0001)) bad.push('rVal ' + t);
      } }
  }
  assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
