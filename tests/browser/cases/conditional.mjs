// Браузерна перевірка сторінки: conditional. Запускається з tests/browser/browser.test.mjs.
import assert from "node:assert";

const U = (name) => new URL("../../../" + name, import.meta.url).href;

const num = s => parseFloat(s.replace(/\s/g,'').replace(',','.').replace('−','-'));
export default async function (h) {
  const b = h.browser; const errs = [], bad = [];
  for (const [name, vp, dark] of [['desktop',{width:1280,height:900},false],['phone',{width:390,height:800},false],['phone360',{width:360,height:740},false],['dark',{width:1280,height:900},true]]) {
    const p = await (await b.newContext({ viewport: vp, colorScheme: dark?'dark':'light' })).newPage();
    p.on('pageerror', e => errs.push(name+': '+String(e))); p.on('console', m => { if (m.type()==='error' && !/fonts|ERR_/.test(m.text())) errs.push(name+': '+m.text()); });
    await p.route(/fonts\.(googleapis|gstatic)/, r=>r.abort());
    await p.goto(U("conditional.html")); await p.waitForSelector('#chips .chip');
    const rows = async () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#rBody tr')].map(tr => [tr.children[0].textContent, tr.children[1].textContent])));
    const check = async l => { await p.waitForTimeout(50); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/.{25}(NaN|undefined|null|Infinity).{15}/); if (m) bad.push(name+' '+l+': '+m[0].replace(/\n/g,' ')); };
    const chip = i => p.locator('#chips .chip').nth(i).click();
    if (name === 'desktop') {
      let r = await rows(); assert.equal(r['P(A | B)'], '0,75'); assert.equal(r['P(B | A)'], '0,6');
      assert(/залежні/.test(await p.textContent('#verdict')));
      await p.click('#mkInd'); r = await rows(); assert.equal(r['P(A | B)'], '0,5'); assert(/незалежні/.test(await p.textContent('#verdict')));
      await chip(1); assert(/несумісні/.test(await p.textContent('#verdict'))); r = await rows(); assert.equal(r['P(A | B)'], '0');
      await chip(2); assert(/^Події незалежні/.test(await p.textContent('#verdict')));
      await chip(3); r = await rows(); assert.equal(r['P(A | B)'], '0,2'); assert(/залежні/.test(await p.textContent('#verdict')));
      await chip(4); assert(/^Події незалежні/.test(await p.textContent('#verdict')));
      await chip(5); assert(/залежні/.test(await p.textContent('#verdict'))); r = await rows(); assert(Math.abs(num(r['P(B | A)']) - 3/51) < 1e-3);
      // умови
      await p.click('#cB'); assert.equal(await p.getAttribute('#cB','aria-pressed'),'true'); await p.click('#cA'); await p.click('#cNone');
      // повзунки та межі
      await chip(0);
      await p.evaluate(()=>{const r=document.getElementById('rA');r.value=0.9;r.dispatchEvent(new Event('input',{bubbles:true}));const q=document.getElementById('rB');q.value=0.8;q.dispatchEvent(new Event('input',{bubbles:true}));});
      assert(await p.locator('#mkDis').isDisabled()); // 0.9+0.8>1
      let lo = +(await p.getAttribute('#rAB','min')); assert(Math.abs(lo-0.7)<1e-9, 'min '+lo);
      for (const [a,bb] of [[0,0],[0,0.5],[1,1],[1,0.3],[0.5,0],[0.5,1]]) {
        await p.evaluate(([a,bb])=>{for (const [id,v] of [['rA',a],['rB',bb]]) {const r=document.getElementById(id);r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}));}},[a,bb]);
        for (const c of ['#cB','#cA','#cNone']) { await p.click(c); await check(`a=${a} b=${bb} ${c}`); }
        await p.click('#mkInd'); await check('ind'); if (!(await p.locator('#mkDis').isDisabled())) { await p.click('#mkDis'); await check('dis'); }
      }
      // три події
      assert(/попарно незалежні, але не/.test(await p.textContent('#t3Verdict')));
      await p.click('#t3Three'); assert(/незалежні в сукупності/.test(await p.textContent('#t3Verdict'))); assert.equal(await p.locator('#t3Body tr').count(), 8);
      await p.click('#t3Two'); assert.equal(await p.locator('#t3Body tr').count(), 4);
    }
    await check('final');
    const sw = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert(sw <= 0, name+' hscroll '+sw);
    await p.waitForTimeout(1200); 
  } assert.deepEqual(bad, []); assert.deepEqual(errs, []);
}
