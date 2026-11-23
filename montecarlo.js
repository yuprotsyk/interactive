/* ============================================================
   montecarlo.js: метод Монте-Карло для визначених інтегралів. Глобальний об'єкт Mc.
   Потрібні Dist (distributions.js, для критичного значення z) і генератор Rand (його передає викликач).

   Задача: I = ∫ₐᵇ f(x) dx. Нехай U ~ рівномірний на (a; b].
   1) Метод середнього значення: доданок v = (b − a)·f(U). Тоді E v = I.
   2) Метод влучання (відбору): для 0 ≤ f ≤ M беремо точку (U, W), W ~ рівномірний на (0; M],
      і доданок v = (b − a)·M·1{W ≤ f(U)}. Тоді E v = I (імовірність влучання p = I/((b − a)M)).
   Оцінка за n незалежними доданками: Î = v̄. Стандартна похибка оцінюється як s_v/√n (s_v — вибіркове
   стандартне відхилення доданків, ділення на n − 1). За скінченної дисперсії доданка (ЦГТ) наближений
   довірчий інтервал: Î ± z₁₋α/₂ · s_v/√n; похибка спадає як 1/√n.
   Точні дисперсії доданка (σ² за один доданок; Var Î = σ²/n):
     середнє значення: σ² = (b − a)·∫f² − I²
     влучання:         σ² = I·((b − a)M − I)
   Для 0 ≤ f ≤ M завжди σ²(середнє) ≤ σ²(влучання), бо ∫f² ≤ M·I.
   Якщо ∫f² = ∞ (як для 1/√x на (0; 1]), дисперсія нескінченна, ЦГТ незастосовна, а s_v/√n не збігається.
   ============================================================ */
(function (root) {
  "use strict";

  var D = root.Dist || (typeof require !== "undefined" ? require("./distributions.js") : null);
  var PI = Math.PI;

  /* Точні I = ∫f і m2 = ∫f² (scipy.integrate.quad, див. tests/fixtures/montecarlo.json). */
  var FUNCS = [
    { id: "sin", name: "sin x на [0; π]", f: function (x) { return Math.sin(x); }, a: 0, b: PI, M: 1, I: 2, m2: PI / 2 },
    { id: "sq", name: "x² на [0; 1]", f: function (x) { return x * x; }, a: 0, b: 1, M: 1, I: 1 / 3, m2: 1 / 5 },
    { id: "gauss", name: "e^(−x²) на [0; 1]", f: function (x) { return Math.exp(-x * x); }, a: 0, b: 1, M: 1, I: 0.7468241328124271, m2: 0.5981440066613041 },
    { id: "circle", name: "√(1 − x²) на [0; 1]", f: function (x) { return Math.sqrt(1 - x * x); }, a: 0, b: 1, M: 1, I: PI / 4, m2: 2 / 3 },
    { id: "atan", name: "1/(1 + x²) на [0; 1]", f: function (x) { return 1 / (1 + x * x); }, a: 0, b: 1, M: 1, I: PI / 4, m2: PI / 8 + 0.25 },
    { id: "invsqrt", name: "1/√x на (0; 1]", f: function (x) { return 1 / Math.sqrt(x); }, a: 0, b: 1, M: null, I: 2, m2: Infinity }
  ];
  function byId(id) { for (var i = 0; i < FUNCS.length; i++) if (FUNCS[i].id === id) return FUNCS[i]; return null; }

  /** Дисперсія одного доданка методу середнього значення (Infinity, якщо ∫f² = ∞). */
  function varMean(fn) { return isFinite(fn.m2) ? (fn.b - fn.a) * fn.m2 - fn.I * fn.I : Infinity; }
  /** Дисперсія одного доданка методу влучання; null, якщо f не обмежена. */
  function varHit(fn) { return fn.M === null ? null : fn.I * ((fn.b - fn.a) * fn.M - fn.I); }
  /** Точна стандартна похибка оцінки за n доданків: √(σ²/n); null, якщо дисперсії немає. */
  function seExact(fn, method, n) {
    var v = method === "hit" ? varHit(fn) : varMean(fn);
    return v === null || !isFinite(v) || n < 1 ? null : Math.sqrt(v / n);
  }

  /** Одне випробування: x ∈ (a; b], y, доданок v; для влучання ще hit. Використовує rng.next(). */
  function draw(fn, method, rng) {
    var x = fn.a + (fn.b - fn.a) * (1 - rng.next()), fx = fn.f(x);
    if (method === "hit") {
      var y = fn.M * (1 - rng.next()), hit = y <= fx;
      return { x: x, y: y, hit: hit, v: hit ? (fn.b - fn.a) * fn.M : 0 };
    }
    return { x: x, y: fx, hit: null, v: (fn.b - fn.a) * fx };
  }

  /** Накопичувач за алгоритмом Велфорда: n, mean, m2 (сума квадратів відхилень). */
  function acc() { return { n: 0, mean: 0, m2: 0 }; }
  function add(a, v) { a.n++; var d = v - a.mean; a.mean += d / a.n; a.m2 += d * (v - a.mean); return a; }
  /** Вибіркове стандартне відхилення доданків; null при n < 2. */
  function sd(a) { return a.n < 2 ? null : Math.sqrt(a.m2 / (a.n - 1)); }
  /** Оцінка стандартної похибки s_v/√n; null при n < 2. */
  function se(a) { return a.n < 2 ? null : Math.sqrt(a.m2 / (a.n - 1) / a.n); }
  /** Наближений довірчий інтервал Î ± z·s_v/√n; null при n < 2. */
  function ci(a, level) {
    var s = se(a);
    if (s === null) return null;
    var z = D.critical("z", level);
    return [a.mean - z * s, a.mean + z * s];
  }

  var api = { FUNCS: FUNCS, byId: byId, varMean: varMean, varHit: varHit, seExact: seExact, draw: draw, acc: acc, add: add, sd: sd, se: se, ci: ci };
  root.Mc = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
