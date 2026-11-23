/* ============================================================
   bootstrap.js: непараметричний бутстреп (бутстреп-вибірки з поверненням).
   Глобальний об'єкт Boot. Потрібен Rand (random.js) для генератора; сама математика від нього не залежить.

   Схема (Efron, Tibshirani, An Introduction to the Bootstrap; Hesterberg, Am. Stat. 69(4), 2015):
     Є вибірка x₁…xₙ і статистика θ̂ (тут: вибіркове середнє або медіана).
     Бутстреп-вибірка: n значень, витягнутих із x₁…xₙ незалежно й з поверненням.
     Для B бутстреп-вибірок рахуємо θ̂*₁…θ̂*_B: це бутстреп-розподіл.
     Бутстреп-оцінка стандартної похибки: вибіркове стандартне відхилення θ̂*ᵦ (ділення на B − 1).
     Процентильний інтервал рівня 1 − α: (q_{α/2}, q_{1−α/2}) квантилі бутстреп-розподілу.
     Квантиль: лінійна інтерполяція між впорядкованими значеннями, позиція (B − 1)·p
     (це типове значення в numpy.quantile, «method 7»).
   Бутстреп-розподіл центрований навколо спостереженої статистики θ̂, а не навколо параметра.
   ============================================================ */
(function (root) {
  "use strict";

  /** Індекси бутстреп-вибірки: n чисел із {0…n − 1} з поверненням (генератор rng.int). */
  function indices(n, rng) {
    var idx = new Array(n), i;
    for (i = 0; i < n; i++) idx[i] = rng.int(n);
    return idx;
  }
  /** Скільки разів кожне спостереження потрапило в бутстреп-вибірку. */
  function counts(n, idx) {
    var c = new Array(n), i;
    for (i = 0; i < n; i++) c[i] = 0;
    for (i = 0; i < idx.length; i++) c[idx[i]]++;
    return c;
  }
  function meanOf(v) { var s = 0, i; for (i = 0; i < v.length; i++) s += v[i]; return s / v.length; }
  function medianOf(v) {
    var s = v.slice().sort(function (a, b) { return a - b; }), n = s.length, h = n >> 1;
    return n % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
  }
  /** Статистика за назвою: "mean" або "median". */
  function stat(values, kind) { return kind === "median" ? medianOf(values) : meanOf(values); }

  /** Статистика однієї бутстреп-вибірки із заданими індексами. */
  function statOf(values, idx, kind) {
    var v = new Array(idx.length), i;
    for (i = 0; i < idx.length; i++) v[i] = values[idx[i]];
    return stat(v, kind);
  }
  /** B бутстреп-значень статистики; масив довжини B. */
  function run(values, kind, B, rng) {
    var out = new Array(B), b, n = values.length;
    for (b = 0; b < B; b++) out[b] = statOf(values, indices(n, rng), kind);
    return out;
  }
  /** Квантиль p за впорядкованим масивом (лінійна інтерполяція, позиція (n − 1)·p). */
  function quantileSorted(s, p) {
    var n = s.length;
    if (n === 0) return null;
    var h = (n - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  }
  /** Процентильний інтервал рівня level; null, якщо немає значень. */
  function percentileCI(stats, level) {
    if (!stats.length) return null;
    var s = stats.slice().sort(function (a, b) { return a - b; }), a = (1 - level) / 2;
    return [quantileSorted(s, a), quantileSorted(s, 1 - a)];
  }
  /** Бутстреп-оцінка стандартної похибки: вибіркове стандартне відхилення (ділення на B − 1); null при B < 2. */
  function se(stats) {
    var B = stats.length;
    if (B < 2) return null;
    var m = meanOf(stats), ss = 0, i;
    for (i = 0; i < B; i++) ss += (stats[i] - m) * (stats[i] - m);
    return Math.sqrt(ss / (B - 1));
  }
  /** Кількість різних значень у бутстреп-розподілі (для медіани на малих вибірках їх небагато). */
  function distinct(stats) {
    var s = stats.slice().sort(function (a, b) { return a - b; }), c = 0, i;
    for (i = 0; i < s.length; i++) if (i === 0 || s[i] !== s[i - 1]) c++;
    return c;
  }

  var api = { indices: indices, counts: counts, stat: stat, statOf: statOf, run: run, quantileSorted: quantileSorted,
              percentileCI: percentileCI, se: se, distinct: distinct };
  root.Boot = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
