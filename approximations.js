/* ============================================================
   approximations.js: наближення біноміального розподілу.
   Глобальний об'єкт Approx. Потрібен Dist (distributions.js).

   Формули (класичні, див. Гнеденко, Гмурман, Феллер):
   · локальна теорема Муавра–Лапласа
       P(X = k) ≈ φ(x) / √(npq),  x = (k − np) / √(npq),  φ(x) = e^(−x²/2) / √(2π);
   · інтегральна теорема Муавра–Лапласа
       P(a ≤ X ≤ b) ≈ Φ(x₂) − Φ(x₁),  x₁ = (a − np) / √(npq),  x₂ = (b − np) / √(npq);
     з поправкою на неперервність a → a − ½, b → b + ½ (Феллер, т. 1, гл. VII);
   · теорема Пуассона: P(X = k) ≈ λᵏ e^(−λ) / k!,  λ = np.
   Відстань між розподілами: d = ½ Σ |P(k) − Q(k)| (відстань за варіацією):
   вона дорівнює найбільшій похибці ймовірності будь-якої події.
   ============================================================ */
(function (root) {
  "use strict";

  var D = root.Dist || (typeof require !== "undefined" ? require("./distributions.js") : null);
  var STD = { mu: 0, sigma: 1 };

  function sigma(n, p) { return Math.sqrt(n * p * (1 - p)); }

  function exactPmf(n, p, k) { return D.binomial.pmf(k, { n: n, p: p }); }

  /** Ймовірність події a ≤ X ≤ b для Bin(n, p), a і b цілі. */
  function exactProb(n, p, a, b) {
    var P = { n: n, p: p };
    return Math.max(0, D.binomial.cdf(b, P) - (a <= 0 ? 0 : D.binomial.cdf(a - 1, P)));
  }

  /** Локальна теорема Муавра–Лапласа. Для σ = 0 наближення не визначене (null). */
  function localNormal(n, p, k) {
    var s = sigma(n, p);
    if (!(s > 0)) return null;
    return D.normal.pdf((k - n * p) / s, STD) / s;
  }

  /** Інтегральна теорема Муавра–Лапласа; cc = true додає поправку на неперервність ±½. */
  function normalProb(n, p, a, b, cc) {
    var s = sigma(n, p);
    if (!(s > 0)) return null;
    var h = cc ? 0.5 : 0, m = n * p;
    return Math.max(0, D.normal.cdf((b + h - m) / s, STD) - D.normal.cdf((a - h - m) / s, STD));
  }

  function poissonPmf(lam, k) { return D.poisson.pmf(k, { lam: lam }); }

  /** Теорема Пуассона для події a ≤ X ≤ b, λ = np. */
  function poissonProb(lam, a, b) {
    var P = { lam: lam };
    return Math.max(0, D.poisson.cdf(b, P) - (a <= 0 ? 0 : D.poisson.cdf(a - 1, P)));
  }

  /** Відстань за варіацією між Bin(n, p) і наближенням за локальною теоремою Муавра–Лапласа. */
  function tvNormal(n, p) {
    var s = sigma(n, p);
    if (!(s > 0)) return null;
    var m = n * p, lo = Math.floor(m - 12 * s) - 2, hi = Math.ceil(m + 12 * s) + 2, sum = 0, k;
    for (k = lo; k <= hi; k++) sum += Math.abs(exactPmf(n, p, k) - localNormal(n, p, k));
    return sum / 2;
  }

  /** Відстань за варіацією між Bin(n, p) і Пуассоном з λ = np (хвіст Пуассона за k > n враховано). */
  function tvPoisson(n, p) {
    var lam = n * p, sum = 0, k, P = { lam: lam };
    for (k = 0; k <= n; k++) sum += Math.abs(exactPmf(n, p, k) - poissonPmf(lam, k));
    return (sum + (1 - D.poisson.cdf(n, P))) / 2;
  }

  /** Діапазон k для графіка: навколо np, із запасом для скошених випадків. */
  function window(n, p) {
    var m = n * p, s = sigma(n, p), w = Math.max(4.5 * s, 4 * Math.sqrt(Math.max(m, 1)) * 0.8, 5);
    var lo = Math.max(0, Math.floor(m - w)), hi = Math.min(n, Math.ceil(m + w * 1.15));
    if (hi - lo < 8) { hi = Math.min(n, lo + 8); lo = Math.max(0, hi - 8); }
    return [lo, hi];
  }

  /** Орієнтири застосовності (правила з підручників, а не теореми): npq ≥ 10 і p ≤ 0,1. */
  function rules(n, p) {
    var npq = n * p * (1 - p);
    return { npq: npq, laplace: npq >= 10, poisson: p <= 0.1 };
  }

  var api = {
    sigma: sigma, exactPmf: exactPmf, exactProb: exactProb, localNormal: localNormal, normalProb: normalProb,
    poissonPmf: poissonPmf, poissonProb: poissonProb, tvNormal: tvNormal, tvPoisson: tvPoisson, window: window, rules: rules
  };
  root.Approx = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
