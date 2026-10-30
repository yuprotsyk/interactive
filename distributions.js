/*
 * Розподіли ймовірностей: ймовірності (дискретні), щільності (неперервні),
 * функції розподілу, середнє, дисперсія. Підключається після common.js:
 *   <script src="common.js"></script>
 *   <script src="distributions.js"></script>
 * Після цього доступний об'єкт Dist. Приклад: Dist.normal.cdf(1.96, {mu: 0, sigma: 1}).
 *
 * Дискретні: pmf(k, P), cdf(x, P), support(P) = [мінімум, максимум].
 * Неперервні: pdf(x, P), cdf(x, P), domain(P) = [від, до].
 * Для обох: mean(P), variance(P). Значення null означає «не існує», Infinity означає «розбіжне».
 */
var Dist = (function () {
  "use strict";
  var S = (typeof Stat !== "undefined") ? Stat : require("./common.js");
  var lgamma = S.lgamma, betai = S.betai;
  var D = {};

  function lchoose(n, k) { return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1); }

  /* ---------- Неповна гамма-функція ---------- */
  function gammaSeries(a, x) {
    var ap = a, sum = 1 / a, del = sum;
    for (var n = 1; n <= 5000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  function gammaCF(a, x) {
    var FPMIN = 1e-300, b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (var i = 1; i <= 5000; i++) {
      var an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-16) break;
    }
    return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
  }
  /** Регуляризована нижня неповна гамма-функція P(a, x). */
  D.gammaP = function (a, x) {
    if (x <= 0) return 0;
    return x < a + 1 ? gammaSeries(a, x) : 1 - gammaCF(a, x);
  };
  /** Регуляризована верхня неповна гамма-функція Q(a, x) = 1 − P(a, x). */
  D.gammaQ = function (a, x) {
    if (x <= 0) return 1;
    return x < a + 1 ? 1 - gammaSeries(a, x) : gammaCF(a, x);
  };

  /* ---------- Дискретні ---------- */
  D.binomial = {
    kind: "discrete",
    support: function (P) { return [0, P.n]; },
    pmf: function (k, P) {
      var n = P.n, p = P.p;
      if (k < 0 || k > n || k !== Math.floor(k)) return 0;
      if (p === 0) return k === 0 ? 1 : 0;
      if (p === 1) return k === n ? 1 : 0;
      return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
    },
    cdf: function (x, P) {
      var n = P.n, p = P.p, k = Math.floor(x);
      if (k < 0) return 0;
      if (k >= n) return 1;
      if (p === 0) return 1;
      if (p === 1) return 0;
      return betai(n - k, k + 1, 1 - p);
    },
    mean: function (P) { return P.n * P.p; },
    variance: function (P) { return P.n * P.p * (1 - P.p); }
  };

  /** Кількість випробувань до першого успіху включно: k = 1, 2, 3, … */
  D.geometric = {
    kind: "discrete",
    support: function () { return [1, Infinity]; },
    pmf: function (k, P) {
      var p = P.p;
      if (k < 1 || k !== Math.floor(k)) return 0;
      if (p === 1) return k === 1 ? 1 : 0;
      return Math.exp((k - 1) * Math.log1p(-p) + Math.log(p));
    },
    cdf: function (x, P) {
      var k = Math.floor(x), p = P.p;
      if (k < 1) return 0;
      if (p === 1) return 1;
      return -Math.expm1(k * Math.log1p(-p));
    },
    mean: function (P) { return 1 / P.p; },
    variance: function (P) { return (1 - P.p) / (P.p * P.p); }
  };

  D.poisson = {
    kind: "discrete",
    support: function () { return [0, Infinity]; },
    pmf: function (k, P) {
      if (k < 0 || k !== Math.floor(k)) return 0;
      return Math.exp(k * Math.log(P.lam) - P.lam - lgamma(k + 1));
    },
    cdf: function (x, P) {
      var k = Math.floor(x);
      if (k < 0) return 0;
      return D.gammaQ(k + 1, P.lam);
    },
    mean: function (P) { return P.lam; },
    variance: function (P) { return P.lam; }
  };

  /** N — розмір сукупності, K — «успішних» у ній, n — обсяг вибірки без повернення. */
  D.hypergeometric = {
    kind: "discrete",
    support: function (P) { return [Math.max(0, P.n - (P.N - P.K)), Math.min(P.n, P.K)]; },
    pmf: function (k, P) {
      var sup = D.hypergeometric.support(P);
      if (k < sup[0] || k > sup[1] || k !== Math.floor(k)) return 0;
      return Math.exp(lchoose(P.K, k) + lchoose(P.N - P.K, P.n - k) - lchoose(P.N, P.n));
    },
    cdf: function (x, P) {
      var sup = D.hypergeometric.support(P), k = Math.floor(x);
      if (k < sup[0]) return 0;
      if (k >= sup[1]) return 1;
      var s = 0;
      for (var i = sup[0]; i <= k; i++) s += D.hypergeometric.pmf(i, P);
      return Math.min(1, s);
    },
    mean: function (P) { return P.n * P.K / P.N; },
    variance: function (P) {
      if (P.N <= 1) return 0;
      var q = P.K / P.N;
      return P.n * q * (1 - q) * (P.N - P.n) / (P.N - 1);
    }
  };

  /* ---------- Неперервні ---------- */
  D.normal = {
    kind: "continuous",
    domain: function () { return [-Infinity, Infinity]; },
    pdf: function (x, P) {
      var z = (x - P.mu) / P.sigma;
      return Math.exp(-0.5 * z * z) / (P.sigma * Math.sqrt(2 * Math.PI));
    },
    cdf: function (x, P) {
      var z = (x - P.mu) / P.sigma, t = z / Math.SQRT2;
      var q = 0.5 * D.gammaQ(0.5, t * t); // P(Z > |z|)
      return z < 0 ? q : 1 - q;
    },
    mean: function (P) { return P.mu; },
    variance: function (P) { return P.sigma * P.sigma; }
  };

  /** Показниковий (експоненційний) розподіл з параметром інтенсивності λ. */
  D.exponential = {
    kind: "continuous",
    domain: function () { return [0, Infinity]; },
    pdf: function (x, P) { return x < 0 ? 0 : P.lam * Math.exp(-P.lam * x); },
    cdf: function (x, P) { return x <= 0 ? 0 : -Math.expm1(-P.lam * x); },
    mean: function (P) { return 1 / P.lam; },
    variance: function (P) { return 1 / (P.lam * P.lam); }
  };

  D.uniform = {
    kind: "continuous",
    domain: function (P) { return [P.a, P.b]; },
    pdf: function (x, P) { return x < P.a || x > P.b ? 0 : 1 / (P.b - P.a); },
    cdf: function (x, P) { return x <= P.a ? 0 : x >= P.b ? 1 : (x - P.a) / (P.b - P.a); },
    mean: function (P) { return (P.a + P.b) / 2; },
    variance: function (P) { return (P.b - P.a) * (P.b - P.a) / 12; }
  };

  D.chisq = {
    kind: "continuous",
    domain: function () { return [0, Infinity]; },
    /** Щільність необмежена біля нуля. */
    unboundedAtZero: function (P) { return P.k < 2; },
    pdf: function (x, P) {
      var k = P.k;
      if (x < 0) return 0;
      if (x === 0) return k < 2 ? Infinity : k === 2 ? 0.5 : 0;
      return Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgamma(k / 2));
    },
    cdf: function (x, P) { return x <= 0 ? 0 : D.gammaP(P.k / 2, x / 2); },
    mean: function (P) { return P.k; },
    variance: function (P) { return 2 * P.k; }
  };

  D.student = {
    kind: "continuous",
    domain: function () { return [-Infinity, Infinity]; },
    pdf: function (t, P) {
      var v = P.nu;
      return Math.exp(lgamma((v + 1) / 2) - lgamma(v / 2) - 0.5 * Math.log(v * Math.PI) -
        (v + 1) / 2 * Math.log1p(t * t / v));
    },
    cdf: function (t, P) {
      var v = P.nu;
      var tail = 0.5 * betai(v / 2, 0.5, v / (v + t * t));
      return t > 0 ? 1 - tail : tail;
    },
    mean: function (P) { return P.nu > 1 ? 0 : null; },
    variance: function (P) { return P.nu > 2 ? P.nu / (P.nu - 2) : P.nu > 1 ? Infinity : null; }
  };

  D.fisher = {
    kind: "continuous",
    domain: function () { return [0, Infinity]; },
    unboundedAtZero: function (P) { return P.d1 < 2; },
    pdf: function (x, P) {
      var a = P.d1, b = P.d2;
      if (x < 0) return 0;
      if (x === 0) return a < 2 ? Infinity : a === 2 ? 1 : 0;
      return Math.exp(lgamma((a + b) / 2) - lgamma(a / 2) - lgamma(b / 2) +
        (a / 2) * Math.log(a / b) + (a / 2 - 1) * Math.log(x) - ((a + b) / 2) * Math.log1p(a * x / b));
    },
    cdf: function (x, P) {
      if (x <= 0) return 0;
      return betai(P.d1 / 2, P.d2 / 2, P.d1 * x / (P.d1 * x + P.d2));
    },
    /* Змінна додатна, тому розбіжний інтеграл дає +∞ (а не «не існує»). */
    mean: function (P) { return P.d2 > 2 ? P.d2 / (P.d2 - 2) : Infinity; },
    variance: function (P) {
      var a = P.d1, b = P.d2;
      if (b > 4) return 2 * b * b * (a + b - 2) / (a * (b - 2) * (b - 2) * (b - 4));
      return Infinity;
    }
  };

  /* ---------- Квантилі ---------- */
  /** Квантиль неперервного розподілу: x, для якого F(x) = p (бісекція). */
  D.quantile = function (dist, P, p) {
    var dom = dist.domain(P), lo = dom[0], hi = dom[1], a, b, st;
    if (isFinite(lo)) a = lo;
    else { a = -1; while (dist.cdf(a, P) > p && a > -1e15) a *= 2; }
    if (isFinite(hi)) b = hi;
    else {
      st = 1;
      var base = isFinite(lo) ? lo : 0;
      b = base + st;
      while (dist.cdf(b, P) < p && st < 1e15) { st *= 2; b = base + st; }
    }
    for (var i = 0; i < 200; i++) {
      var m = (a + b) / 2;
      if (dist.cdf(m, P) < p) a = m; else b = m;
    }
    return (a + b) / 2;
  };
  /** Найменше k, для якого F(k) ≥ p (дискретний розподіл). */
  D.quantileDiscrete = function (dist, P, p) {
    var k = dist.support(P)[0], limit = k + 1e6;
    while (dist.cdf(k, P) < p && k < limit) k++;
    return k;
  };

  /* ---------- Довірчий інтервал для середнього ---------- */
  var STD_NORMAL = { mu: 0, sigma: 1 };
  /** Критичне значення для двобічного інтервалу рівня level: z (нормальний) або t (Стьюдент, df ступенів свободи). */
  D.critical = function (kind, level, df) {
    var p = 0.5 + level / 2;
    return kind === "t" ? D.quantile(D.student, { nu: df }, p) : D.quantile(D.normal, STD_NORMAL, p);
  };
  /**
   * Довірчий інтервал для середнього за вибіркою values.
   * method: "z" (σ відома, потрібне opts.sigma), "t" (σ невідома, критичне значення Стьюдента, n − 1 ступенів),
   * "zs" (хибно: s замість σ у формулі з нормальним критичним значенням, лише для демонстрації).
   * Повертає null, якщо n < 2 (для "z" достатньо n ≥ 1).
   */
  D.meanCI = function (values, level, method, opts) {
    var n = values.length, i, m = 0, ss = 0;
    if (n < 1 || (method !== "z" && n < 2)) return null;
    for (i = 0; i < n; i++) m += values[i];
    m /= n;
    for (i = 0; i < n; i++) ss += (values[i] - m) * (values[i] - m);
    var sd = n > 1 ? Math.sqrt(ss / (n - 1)) : null, sigma = method === "z" ? opts.sigma : sd;
    var crit = D.critical(method === "t" ? "t" : "z", level, n - 1), se = sigma / Math.sqrt(n), half = crit * se;
    return { n: n, mean: m, s: sd, sigma: sigma, se: se, crit: crit, half: half, lo: m - half, hi: m + half, df: n - 1, method: method };
  };

  return D;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Dist;
