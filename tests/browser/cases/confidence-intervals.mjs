// Браузерна перевірка сторінки: confidence-intervals. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['phone360',{width:360,height:740},false],['dark',{width:1280,height:900},true]]) {
    const p = await (await b.newContext({ viewport: vp, colorScheme: dark?'dark':'light' })).newPage();
    p.on('pageerror', e => errs.push(name+': '+String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(name+': '+m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
    await p.goto(U("confidence-intervals.html")); await p.waitForSelector('#chips .chip');
    const check = async l => { await p.waitForTimeout(40); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(name+' '+l+': '+m[0].replace(/\n/g,' ')); };
    const cover = async () => { const t = await p.textContent('#rAcc'); return num(t.match(/\(([\d,]+) %\)/)[1]); };
    const setn = v => p.evaluate(v=>{const r=document.getElementById('nRange');r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))},v);
    if (name === 'desktop') {
      for (let i = 0; i < 6; i++) await p.click('#batch'); let c = await cover(); assert(c > 93.5 && c < 96.5, 'normal t n=10: '+c);
      await p.click('#mZs'); await setn(5); for (let i = 0; i < 6; i++) await p.click('#batch'); c = await cover(); assert(c < 91.5, 'zs n=5: '+c);
      await p.click('#mZ'); for (let i = 0; i < 6; i++) await p.click('#batch'); c = await cover(); assert(c > 93.5 && c < 96.5, 'z n=5: '+c);
      await p.click('#mT'); await p.locator('#chips .chip').nth(1).click(); for (let i = 0; i < 6; i++) await p.click('#batch'); c = await cover(); assert(c < 94.5, 'exp t n=5: '+c);
      // рівні
      await p.locator('#chips .chip').nth(0).click(); await setn(30);
      for (const [i, lv] of [[0, 80], [1, 90], [2, 95], [3, 99]]) { await p.locator('#levels button').nth(i).click(); for (let j = 0; j < 6; j++) await p.click('#batch'); c = await cover(); assert(Math.abs(c - lv) < 2, 'level '+lv+': '+c); }
      // ширина: більше n вужчі
      await p.locator('#levels button').nth(2).click(); await setn(5); const w5 = num(await p.textContent('#rW')); await setn(80); const w80 = num(await p.textContent('#rW')); assert(w80 < w5 / 2.5, `${w5} ${w80}`);
      for (let k = 0; k < 4; k++) { await p.locator('#ks button').nth(k).click(); await check('K'+k); }
      await p.click('#again'); await p.click('#resetCnt');
      // власні дані зі scipy
      await p.locator('#levels button').nth(2).click();
      await p.click('#dataTa'); await p.fill('#dataTa', '4,1 5,3 6,2 5,8 4,9 5,5 6,0 5,1');
      const out = await p.textContent('#oOut'); assert(/4,797/.test(out) && /5,928/.test(out), out);
      await p.fill('#dataTa', '5'); assert(/щонайменше два/.test(await p.textContent('#oMsg')));
      await p.fill('#sigIn', '2'); assert(/z\(95 %\) = 1,96/.test(await p.textContent('#oOut')));
      await p.fill('#sigIn', '-1'); assert(/додатним/.test(await p.textContent('#oMsg')));
      await p.fill('#sigIn', ''); await p.fill('#dataTa', '3 3 3'); assert(/нульова/.test(await p.textContent('#oOut')));
      await p.fill('#dataTa', '1 abc 2'); await check('own');
      for (const v of [2, 3, 100]) { await setn(v); for (const m of ['#mT','#mZ','#mZs']) { await p.click(m); await check('n='+v+m); } }
    }
    await check('final');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert(sw <= 0, name+' hscroll '+sw);
    await p.waitForTimeout(1200); 
  } assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
