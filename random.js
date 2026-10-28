/*
 * Випадкові числа із зерном: той самий seed завжди дає ту саму послідовність,
 * тому симуляцію можна відтворити. Підключається так: <script src="random.js"></script>
 * Приклад: var rng = Rand.create(2026); rng.next(); rng.normal(); rng.exp(2);
 */
var Rand = (function () {
  "use strict";

  /** Генератор mulberry32: швидкий, добре перемішує біти. */
  function create(seed) {
    var a = seed >>> 0;
    var spare = null;
    var self = {
      /** Рівномірне число з [0, 1). */
      next: function () {
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      /** Ціле від 0 до k − 1. */
      int: function (k) { return Math.floor(self.next() * k); },
      /** Рівномірне число з [lo, hi). */
      uniform: function (lo, hi) { return lo + (hi - lo) * self.next(); },
      /** 1 з імовірністю p, інакше 0. */
      bernoulli: function (p) { return self.next() < p ? 1 : 0; },
      /** Стандартне нормальне число (метод Бокса–Мюллера). */
      normal: function () {
        if (spare !== null) { var s = spare; spare = null; return s; }
        var u1 = 1 - self.next(), u2 = self.next();
        var r = Math.sqrt(-2 * Math.log(u1)), th = 2 * Math.PI * u2;
        spare = r * Math.sin(th);
        return r * Math.cos(th);
      },
      /** Показникове число з інтенсивністю rate (середнє 1/rate). */
      exp: function (rate) { return -Math.log(1 - self.next()) / (rate === undefined ? 1 : rate); },
      /** Число з розподілу Коші (Стьюдента з ν = 1). */
      cauchy: function () { return Math.tan(Math.PI * (self.next() - 0.5)); },
      /** Число з U-подібного розподілу (арксинуса) на [0, 1]: щільність найбільша біля країв. */
      arcsine: function () { var s = Math.sin(Math.PI * self.next() / 2); return s * s; },
      /** Суміш двох нормальних N(−m; s²) і N(m; s²) порівну: розподіл із двома вершинами. */
      bimodal: function (m, s) {
        m = m === undefined ? 2 : m; s = s === undefined ? 0.5 : s;
        return (self.next() < 0.5 ? -m : m) + s * self.normal();
      }
    };
    return self;
  }

  /** Зерно для i-ї серії за базовим зерном (щоб серії були незалежні, але відтворювані). */
  function seedFor(seed, i) {
    return (Math.imul(seed | 0, 2654435761) ^ Math.imul(i + 1, 40503)) >>> 0;
  }

  return { create: create, seedFor: seedFor };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Rand;
