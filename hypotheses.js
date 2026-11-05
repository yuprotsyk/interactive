/* ============================================================
   hypotheses.js: перевірка гіпотез (z- і t-критерій для середнього; біноміальний критерій для частки).
   Глобальний об'єкт Hyp. Потрібен Dist (distributions.js).

   Z-критерій для математичного сподівання нормальної сукупності з відомим σ
   (класична схема, див. Гмурман, Гнеденко, Hogg–Craig, Casella–Berger):
     H₀: μ = μ₀;  H₁: μ ≠ μ₀ ("two"), μ > μ₀ ("right") або μ < μ₀ ("left").
     Статистика  z = (x̄ − μ₀) / (σ/√n);  за H₀ вона має розподіл N(0; 1).
     Критична область (рівень значущості α):
       two:   |z| > z₁₋α/₂;   right: z > z₁₋α;   left: z < −z₁₋α.
     p-значення: right: 1 − Φ(z);  left: Φ(z);  two: 2·(1 − Φ(|z|)).
     Потужність при істинному μ, λ = (μ − μ₀)/(σ/√n):
       right: 1 − Φ(z₁₋α − λ);  left: Φ(−z₁₋α − λ);
       two:   1 − Φ(z₁₋α/₂ − λ) + Φ(−z₁₋α/₂ − λ).
     Імовірність помилки II роду β = 1 − потужність. При μ = μ₀ потужність дорівнює α.
   Для односторонньої альтернативи H₀ розуміємо як μ ≤ μ₀ (μ ≥ μ₀): inAlternative(μ) = false.
   ============================================================ */
(function (root) {
  "use strict";

  var D = root.Dist || (typeof require !== "undefined" ? require("./distributions.js") : null);
  var STD = { mu: 0, sigma: 1 };

  function Phi(x) { return D.normal.cdf(x, STD); }
  function zq(p) { return D.quantile(D.normal, STD, p); }

  /** Статистика критерію. */
  function zStat(xbar, mu0, sigma, n) { return (xbar - mu0) / (sigma / Math.sqrt(n)); }

  /** Межі критичної області для z: відхиляємо H₀, якщо z < lo або z > hi. */
  function critical(alpha, tail) {
    if (tail === "right") return { lo: -Infinity, hi: zq(1 - alpha) };
    if (tail === "left") return { lo: -zq(1 - alpha), hi: Infinity };
    var c = zq(1 - alpha / 2);
    return { lo: -c, hi: c };
  }

  /** Те саме в одиницях вибіркового середнього: x̄ < lo або x̄ > hi. */
  function criticalMean(mu0, sigma, n, alpha, tail) {
    var c = critical(alpha, tail), se = sigma / Math.sqrt(n);
    return { lo: c.lo === -Infinity ? -Infinity : mu0 + c.lo * se, hi: c.hi === Infinity ? Infinity : mu0 + c.hi * se };
  }

  /** Чи відхиляємо H₀ при статистиці z. */
  function reject(z, alpha, tail) {
    var c = critical(alpha, tail);
    return z < c.lo || z > c.hi;
  }

  /** p-значення за статистикою z. */
  function pValue(z, tail) {
    if (tail === "right") return 1 - Phi(z);
    if (tail === "left") return Phi(z);
    return 2 * (1 - Phi(Math.abs(z)));
  }

  /** Ймовірність відхилити H₀, якщо істинне математичне сподівання дорівнює mu. */
  function power(mu, mu0, sigma, n, alpha, tail) {
    var lam = (mu - mu0) / (sigma / Math.sqrt(n)), c = critical(alpha, tail);
    var p = 0;
    if (c.hi !== Infinity) p += 1 - Phi(c.hi - lam);
    if (c.lo !== -Infinity) p += Phi(c.lo - lam);
    return p;
  }

  /** Чи істинне μ належить альтернативі H₁ (інакше вважаємо, що H₀ істинна). */
  function inAlternative(mu, mu0, tail) {
    if (tail === "right") return mu > mu0;
    if (tail === "left") return mu < mu0;
    return mu !== mu0;
  }

  /* ---------- Критерії Стьюдента для середнього (σ невідома) і z-критерій у єдиному записі ----------
     kind "z": σ відома, нульовий розподіл N(0; 1);  kind "t": σ невідома, замість σ беремо вибіркове
     стандартне відхилення s, нульовий розподіл Стьюдента з n − 1 ступенями свободи (Гмурман; Casella–Berger).
     Статистика та сама: (x̄ − μ₀)/(scale/√n), де scale = σ або s (функція zStat).
     p-значення: left: F(t); right: 1 − F(t); two: 2·(1 − F(|t|)), де F функція розподілу нульового розподілу.
     Довірча межа, двоїста до критерію (рівень довіри 1 − α):
       two:   x̄ ± c₁₋α/₂·scale/√n;  right: [x̄ − c₁₋α·scale/√n; ∞);  left: (−∞; x̄ + c₁₋α·scale/√n],
     де c це квантиль нульового розподілу. Для t потрібно n ≥ 2. */
  function nullDist(kind, n) { return kind === "t" ? { d: D.student, P: { nu: n - 1 } } : { d: D.normal, P: STD }; }

  function pValueNull(stat, kind, n, tail) {
    var nd = nullDist(kind, n), F = function (x) { return nd.d.cdf(x, nd.P); };
    if (tail === "right") return F(-stat);
    if (tail === "left") return F(stat);
    return Math.min(1, 2 * F(-Math.abs(stat)));
  }

  function criticalNull(alpha, kind, n, tail) {
    var nd = nullDist(kind, n), q = function (p) { return D.quantile(nd.d, nd.P, p); };
    if (tail === "right") return { lo: -Infinity, hi: q(1 - alpha) };
    if (tail === "left") return { lo: -q(1 - alpha), hi: Infinity };
    var c = q(1 - alpha / 2);
    return { lo: -c, hi: c };
  }

  function meanBound(xbar, scale, n, alpha, kind, tail) {
    var c = criticalNull(alpha, kind, n, tail), se = scale / Math.sqrt(n);
    return { lo: tail === "left" ? -Infinity : xbar - c.hi * se, hi: tail === "right" ? Infinity : xbar - c.lo * se };
  }

  /* ---------- Біноміальний критерій для частки (H₀: p = ½) ----------
     Статистика T = кількість успіхів у n випробуваннях; за H₀ вона має розподіл Bin(n; ½)
     (нульовий розподіл). p-значення це ймовірність за H₀ отримати таке ж значення T, як спостережене k,
     або ще більш екстремальне (екстремальність визначає альтернатива):
       "right" (p > ½):  P(T ≥ k);   "left" (p < ½):  P(T ≤ k);
       "two" (p ≠ ½):    2·min(P(T ≥ k), P(T ≤ k)), але не більше 1 (нульовий розподіл симетричний).
     H₀ відхиляємо, якщо p ≤ α. Для дискретної статистики ймовірність відхилити істинну H₀ зазвичай
     строго менша за α: binomCritical повертає найменше k, при якому p ≤ α, і цю ймовірність. */
  var HALF = 0.5;
  function binomPmf(n, k) { return D.binomial.pmf(k, { n: n, p: HALF }); }
  function tailGe(n, k) { var s = 0, j; for (j = Math.max(0, k); j <= n; j++) s += binomPmf(n, j); return Math.min(1, s); }
  function tailLe(n, k) { var s = 0, j; for (j = 0; j <= Math.min(n, k); j++) s += binomPmf(n, j); return Math.min(1, s); }
  /** p-значення біноміального критерію для k успіхів із n; alt: "right", "left" або "two". */
  function binomPValue(n, k, alt) {
    if (alt === "right") return tailGe(n, k);
    if (alt === "left") return tailLe(n, k);
    return Math.min(1, 2 * Math.min(tailGe(n, k), tailLe(n, k)));
  }
  /** Чи k належить хвосту «не менш екстремальні, ніж спостережене k»: для зафарбовування стовпчиків j. */
  function binomExtreme(n, k, j, alt) {
    if (alt === "right") return j >= k;
    if (alt === "left") return j <= k;
    var d = Math.abs(k - n / 2);
    return Math.abs(j - n / 2) >= d;
  }
  /** Межа рішення: для "right" і "two" найменше k, при якому p ≤ α (для "left" найбільше k), і ймовірність
      відхилити H₀, якщо вона істинна (для "two" враховано обидва хвости). Повертає null, якщо навіть
      при найбільш екстремальному k маємо p > α (тоді при цьому n відхилити H₀ неможливо). */
  function binomCritical(n, alpha, alt) {
    var k;
    if (alt === "left") {
      for (k = Math.floor(n / 2); k >= 0; k--) {
        if (binomPValue(n, k, "left") <= alpha) { var m = k; while (m + 1 <= n / 2 && binomPValue(n, m + 1, "left") <= alpha) m++; return { k: m, size: tailLe(n, m) }; }
      }
      return null;
    }
    for (k = alt === "two" ? Math.ceil(n / 2) : 0; k <= n; k++) {
      if (binomPValue(n, k, alt) <= alpha) return { k: k, size: alt === "two" ? Math.min(1, tailGe(n, k) + tailLe(n, n - k)) : tailGe(n, k) };
    }
    return null;
  }

  var api = { zStat: zStat, critical: critical, criticalMean: criticalMean, reject: reject,
              pValue: pValue, power: power, inAlternative: inAlternative,
              pValueNull: pValueNull, criticalNull: criticalNull, meanBound: meanBound,
              binomPmf: binomPmf, binomPValue: binomPValue, binomExtreme: binomExtreme, binomCritical: binomCritical };
  root.Hyp = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
