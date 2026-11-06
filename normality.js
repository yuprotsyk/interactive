/* ============================================================
   normality.js: перевірка нормальності вибірки. Глобальний об'єкт Norm. Потрібен Dist (distributions.js).
   Від DOM не залежить.

   Q-Q графік (нормальний імовірнісний графік). Вибіркові значення x₍₁₎ ≤ … ≤ x₍ₙ₎ відкладають проти
   теоретичних квантилів zᵢ = Φ⁻¹((i − 3/8)/(n + 1/4)) (позиції Бломма; це наближення математичних сподівань
   порядкових статистик стандартної нормальної вибірки, Blom 1958). Для нормальної вибірки точки лежать
   приблизно на прямій x = μ + σ·z. Опорна пряма проведена через перший і третій квартилі (як qqline у R,
   квантилі типу 7: лінійна інтерполяція x₍₁₊₍ₙ₋₁₎ₚ₎).

   Критерій Шапіро–Вілка (Shapiro, Wilk 1965). H₀: вибірка з N(μ, σ²). Статистика
       W = (Σ aᵢ·x₍ᵢ₎)² / Σ (xᵢ − x̄)²,
   де коефіцієнти aᵢ побудовані з сподівань порядкових статистик. Коефіцієнти й p-значення обчислюють за
   наближенням Ройстона (Royston 1992, алгоритм AS R94, 1995), n від 3 до 5000: для n = 3 p точне, для
   4 ≤ n ≤ 11 перетворення −ln(γ − ln(1 − W)) вважають нормальним, для n ≥ 12 перетворення ln(1 − W).
   Мала W свідчить проти нормальності; p = P(W ≤ W_спостережене | H₀).

   Критерій хі-квадрат Пірсона для нормальності. Область значень розбито на K інтервалів [aᵢ; aᵢ₊₁),
   крайні необмежені. nᵢ це кількість значень в інтервалі, pᵢ = Φ((aᵢ₊₁ − μ)/σ) − Φ((aᵢ − μ)/σ),
       χ² = Σ (nᵢ − n·pᵢ)² / (n·pᵢ).
   Якщо μ і σ задано, χ² ~ χ²(K − 1); якщо їх оцінено (тут оцінки максимальної правдоподібності:
   x̄ і σ̂ = √(Σ(xᵢ − x̄)²/n)), то в підручниках беруть χ²(K − 3). Строго це правильно для оцінок за
   згрупованими даними; для оцінок за початковими даними справжній розподіл лежить між χ²(K − 3) і
   χ²(K − 1) (Chernoff, Lehmann 1954), тож p за K − 3 трохи занижене. Орієнтир: очікувані n·pᵢ мають
   перевищувати 5 принаймні в 80 % інтервалів.
   ============================================================ */
var Norm = (function () {
  "use strict";

  var STD = { mu: 0, sigma: 1 };
  function ppnd(p) { return Dist.quantile(Dist.normal, STD, p); }
  function cdf(x) { return Dist.normal.cdf(x, STD); }

  function sortedCopy(v) { return v.slice().sort(function (a, b) { return a - b; }); }
  function mean(v) { var s = 0, i; for (i = 0; i < v.length; i++) s += v[i]; return v.length ? s / v.length : NaN; }

  /* ---------- Q-Q графік ---------- */
  var qCache = {};
  /** Теоретичні квантилі Бломма для обсягу n (за зростанням). */
  function qqTheoretical(n) {
    if (!qCache[n]) {
      var z = [], i;
      for (i = 1; i <= n; i++) z.push(ppnd((i - 0.375) / (n + 0.25)));
      qCache[n] = z;
    }
    return qCache[n];
  }
  /** Квантиль типу 7 для відсортованого масиву. */
  function quantile7(sorted, p) {
    var h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  }
  /** Точки Q-Q графіка й опорна пряма x = intercept + slope·z через квартилі. */
  function qq(values) {
    var s = sortedCopy(values), n = s.length, z = qqTheoretical(n), z1 = ppnd(0.25), z3 = ppnd(0.75);
    var q1 = quantile7(s, 0.25), q3 = quantile7(s, 0.75), slope = (q3 - q1) / (z3 - z1);
    return { z: z, x: s, slope: slope, intercept: q1 - slope * z1 };
  }

  /* ---------- Шапіро–Вілк ---------- */
  var C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
  var C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
  var C3 = [0.544, -0.39978, 0.025054, -6.714e-4];
  var C4 = [1.3822, -0.77857, 0.062767, -0.0020322];
  var C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];
  var C6 = [-0.4803, -0.082676, 0.0030302];
  var G = [-2.273, 0.459];
  function poly(c, x) { var r = 0, i; for (i = c.length - 1; i >= 0; i--) r = r * x + c[i]; return r; }

  var aCache = {};
  /** Коефіцієнти a₁ … a_{⌊n/2⌋} (за Ройстоном); решта за антисиметрією a₍ₙ₊₁₋ᵢ₎ = −aᵢ. */
  function swCoef(n) {
    if (aCache[n]) return aCache[n];
    var nn2 = Math.floor(n / 2), a = new Array(nn2 + 1), i;
    if (n === 3) { a[1] = Math.SQRT1_2; aCache[n] = a; return a; }
    var an25 = n + 0.25, m = new Array(nn2 + 1), summ2 = 0;
    for (i = 1; i <= nn2; i++) { m[i] = ppnd((i - 0.375) / an25); summ2 += m[i] * m[i]; }
    summ2 *= 2;
    var ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n);
    var a1 = poly(C1, rsn) - m[1] / ssumm2, i1, fac;
    if (n > 5) {
      i1 = 3;
      var a2 = -m[2] / ssumm2 + poly(C2, rsn);
      fac = Math.sqrt((summ2 - 2 * m[1] * m[1] - 2 * m[2] * m[2]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
      a[2] = a2;
    } else {
      i1 = 2;
      fac = Math.sqrt((summ2 - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1));
    }
    a[1] = a1;
    for (i = i1; i <= nn2; i++) a[i] = -m[i] / fac;
    aCache[n] = a;
    return a;
  }

  /** Критерій Шапіро–Вілка: {W, p, n}; null, якщо n поза [3; 5000] або всі значення однакові. */
  function shapiroWilk(values) {
    var n = values.length;
    if (n < 3 || n > 5000) return null;
    var x = sortedCopy(values), range = x[n - 1] - x[0];
    if (!(range > 1e-19)) return null;
    var a = swCoef(n), nn2 = Math.floor(n / 2);
    /* W = (Σ aᵢ(x₍ₙ₊₁₋ᵢ₎ − x₍ᵢ₎))² / Σ(xᵢ − x̄)², записано через центровані величини */
    var xm = mean(x), num = 0, den = 0, i;
    for (i = 1; i <= nn2; i++) num += a[i] * (x[n - i] - x[i - 1]);
    for (i = 0; i < n; i++) den += (x[i] - xm) * (x[i] - xm);
    var w = num * num / den;
    if (w > 1) w = 1;
    var pw;
    if (n === 3) {
      pw = (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.PI / 3);
      if (pw < 0) pw = 0;
    } else {
      var y = Math.log(1 - w), xx = Math.log(n), m, s;
      if (n <= 11) {
        var gamma = poly(G, n);
        if (y >= gamma) return { W: w, p: 1e-99, n: n };
        y = -Math.log(gamma - y);
        m = poly(C3, n); s = Math.exp(poly(C4, n));
      } else {
        m = poly(C5, xx); s = Math.exp(poly(C6, xx));
      }
      pw = 1 - cdf((y - m) / s);
    }
    return { W: w, p: pw, n: n };
  }

  /* ---------- Хі-квадрат Пірсона для нормальності ---------- */
  /** Межі K − 1 внутрішніх точок: "prob" (рівноймовірні) або "width" (рівні відстані від −3σ до 3σ). */
  function edges(mu, sigma, K, mode) {
    var e = [], j;
    for (j = 1; j < K; j++) e.push(mu + sigma * (mode === "prob" ? ppnd(j / K) : -3 + 6 * (j - 1) / (K - 2)));
    return e;
  }
  /**
   * values: вибірка; K ≥ 4 інтервалів; mode "prob" | "width"; params: необов'язково {mu, sigma}, якщо їх задано
   * (тоді df = K − 1), інакше μ і σ оцінюють (x̄ і σ̂ з діленням на n; df = K − 3).
   * Повертає {chi2, df, p, edges, observed, expected, small} (small це частка інтервалів з очікуваним < 5).
   */
  function chiSquare(values, K, mode, params) {
    var n = values.length;
    if (!(K >= 4) || n < 1) return null;
    var mu, sigma, df, i, j;
    if (params) { mu = params.mu; sigma = params.sigma; df = K - 1; }
    else {
      mu = mean(values); sigma = 0;
      for (i = 0; i < n; i++) sigma += (values[i] - mu) * (values[i] - mu);
      sigma = Math.sqrt(sigma / n); df = K - 3;
    }
    if (!(sigma > 0)) return null;
    var e = edges(mu, sigma, K, mode), obs = [], exp = [], prev = 0, c, small = 0, chi2 = 0;
    for (j = 0; j < K; j++) obs.push(0);
    for (i = 0; i < n; i++) {
      j = 0; while (j < K - 1 && values[i] >= e[j]) j++;
      obs[j]++;
    }
    for (j = 0; j < K; j++) {
      c = j < K - 1 ? cdf((e[j] - mu) / sigma) : 1;
      exp.push(n * (c - prev)); prev = c;
      if (exp[j] < 5 - 1e-9) small++;
      chi2 += (obs[j] - exp[j]) * (obs[j] - exp[j]) / exp[j];
    }
    return { chi2: chi2, df: df, p: 1 - Dist.chisq.cdf(chi2, { k: df }), edges: e, observed: obs, expected: exp, small: small / K };
  }

  return { qq: qq, qqTheoretical: qqTheoretical, shapiroWilk: shapiroWilk, chiSquare: chiSquare };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Norm;
