// Браузерна перевірка сторінки: distributions-edge. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  const p = await (await b.newContext({ viewport: {width:1280,height:900} })).newPage();
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
  await p.goto(U("distributions.html")); await p.waitForSelector('#chipsDiscrete .chip');
  const chips = await p.locator('#chipsDiscrete .chip, #chipsContinuous .chip').count();
  const check = async (label) => {
    await p.waitForTimeout(60);
    const t = await p.evaluate(() => document.body.innerText + ' ' + document.getElementById('plot').getAttribute('aria-label'));
    const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(label + ': ' + m[0].replace(/\n/g, ' '));
    const pv = await p.textContent('#pval'); const v = parseFloat(pv.replace(',', '.').replace('−','-'));
    if (isFinite(v) && (v < 0 || v > 1)) bad.push(label + ' pval ' + pv);
  };
  for (let i = 0; i < chips; i++) {
    await p.locator('#chipsDiscrete .chip, #chipsContinuous .chip').nth(i).click();
    const name = await p.textContent('#title'); await check(name);
    const n = await p.locator('#paramRows input[type=range]').count();
    for (let j = 0; j < n; j++) for (const which of ['min', 'max', 'mid']) {
      await p.evaluate(([j, w]) => { const r = document.querySelectorAll('#paramRows input[type=range]')[j]; const lo = +r.min, hi = +r.max; r.value = w === 'min' ? lo : w === 'max' ? hi : (lo + hi) / 2; r.dispatchEvent(new Event('input', { bubbles: true })); }, [j, which]);
      for (const m of ['#modeCdf', '#modeDens']) { await p.click(m); for (const c of ['#cLe', '#cGe', '#cBt']) { await p.click(c); await check(name + ' p' + j + ' ' + which + ' ' + m + c); } }
      if (await p.locator('#overlayBox').isVisible()) { await p.check('#overlay'); await check(name + ' overlay'); await p.uncheck('#overlay'); }
    }
    // крайні a,b
    for (const w of ['min','max']) { await p.evaluate(w => { for (const id of ['aRange','bRange']) { const r = document.getElementById(id); r.value = r[w]; r.dispatchEvent(new Event('input', {bubbles:true})); } }, w); await check(name + ' ab ' + w); }
    await p.click('#tableBox summary'); await check(name + ' table'); await p.click('#tableBox summary');
  }
  assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
