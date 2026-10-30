/*
 * Числові характеристики: для окремих значень і для інтервального ряду.
 * Підключається так: <script src="summary.js"></script>, далі Summ.mean(...), Summ.group(...).
 *
 * Домовленості:
 *  - Q1 і Q3: медіани нижньої та верхньої половин упорядкованого ряду (при непарному n медіана в половини не входить);
 *  - інтервали [a; b): ліва межа входить, права ні;
 *  - формули інтервального ряду для рівних інтервалів (див. group, gMode, gQuantile).
 */
var Summ = (function () {
  "use strict";
  var EPS = 1e-9;

  function sorted(v) { return v.slice().sort(function (a, b) { return a - b; }); }
  function sum(v) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i]; return s; }
  function mean(v) { return v.length ? sum(v) / v.length : null; }
  function medianSorted(xs) {
    var n = xs.length;
    if (!n) return null;
    return n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2;
  }
  function median(v) { return medianSorted(sorted(v)); }

  /** Q1 і Q3 як медіани половин; для n < 2 повертає null. */
  function quartiles(v) {
    var xs = sorted(v), n = xs.length;
    if (n < 2) return null;
    var h = Math.floor(n / 2);
    return { q1: medianSorted(xs.slice(0, h)), q3: medianSorted(xs.slice(n - h)) };
  }

  /** Дисперсія з поділом на n - ddof (ddof = 0 чи 1); null, якщо ділити нема на що. */
  function variance(v, ddof) {
    var n = v.length;
    if (n - ddof <= 0) return null;
    var m = mean(v), s = 0;
    for (var i = 0; i < n; i++) s += (v[i] - m) * (v[i] - m);
    return s / (n - ddof);
  }
  function sd(v, ddof) { var s = variance(v, ddof); return s === null ? null : Math.sqrt(s); }

  /** Варіаційний ряд: різні значення, їхні частоти й накопичені частоти. */
  function series(v) {
    var xs = sorted(v), out = [], cum = 0;
    for (var i = 0; i < xs.length; i++) {
      if (out.length && out[out.length - 1].x === xs[i]) out[out.length - 1].f++;
      else out.push({ x: xs[i], f: 1, cum: 0 });
    }
    out.forEach(function (r) { cum += r.f; r.cum = cum; });
    return out;
  }

  /** Мода окремих значень: усі значення з найбільшою частотою. Якщо всі різні чи всі однаково часті, моди немає. */
  function modeRaw(v) {
    var s = series(v);
    if (!s.length) return { modes: [], none: true, reason: "немає даних", maxf: 0 };
    var maxf = 0;
    s.forEach(function (r) { if (r.f > maxf) maxf = r.f; });
    var modes = s.filter(function (r) { return r.f === maxf; }).map(function (r) { return r.x; });
    if (maxf === 1 && s.length > 1) return { modes: [], none: true, reason: "усі значення різні", maxf: maxf };
    if (s.length > 1 && modes.length === s.length) return { modes: [], none: true, reason: "усі значення однаково часті", maxf: maxf };
    return { modes: modes, none: false, maxf: maxf };
  }

  /** Дані для ящика з вусами: межі Тьюкі Q1 − 1,5·IQR та Q3 + 1,5·IQR, вуса, викиди. */
  function box(v) {
    var xs = sorted(v), n = xs.length;
    if (!n) return null;
    var q = quartiles(v), med = medianSorted(xs);
    if (!q) return { min: xs[0], max: xs[0], q1: xs[0], med: med, q3: xs[0], iqr: 0, wlo: xs[0], whi: xs[0], outliers: [] };
    var iqr = q.q3 - q.q1, lo = q.q1 - 1.5 * iqr, hi = q.q3 + 1.5 * iqr;
    var inside = xs.filter(function (x) { return x >= lo && x <= hi; });
    return { min: xs[0], max: xs[n - 1], q1: q.q1, med: med, q3: q.q3, iqr: iqr, fenceLo: lo, fenceHi: hi,
      wlo: inside[0], whi: inside[inside.length - 1],
      outliers: xs.filter(function (x) { return x < lo || x > hi; }) };
  }

  /* ---------- Інтервальний ряд ---------- */

  /**
   * Групує значення в рівні інтервали [a; b) шириною h (останній інтервал замкнений: [a; b], щоб містити максимум), що починаються від start.
   * Початок зсувається вгору чи вниз на ціле число кроків так, щоб перший інтервал містив найменше значення.
   */
  function group(v, start, h) {
    var n = v.length;
    if (!n || !(h > 0)) return null;
    var mn = Infinity, mx = -Infinity, i;
    for (i = 0; i < n; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; }
    start = start + Math.floor((mn - start) / h + EPS) * h;
    var m = Math.max(1, Math.ceil((mx - start) / h - EPS)), iv = [];
    for (i = 0; i < m; i++) iv.push({ a: start + i * h, b: start + (i + 1) * h, mid: start + (i + 0.5) * h, f: 0, cum: 0 });
    for (i = 0; i < n; i++) {
      var k = Math.floor((v[i] - start) / h + EPS);
      iv[Math.min(m - 1, Math.max(0, k))].f++;
    }
    var c = 0;
    iv.forEach(function (r) { c += r.f; r.cum = c; });
    return { start: start, h: h, n: n, m: m, iv: iv };
  }

  /** Інтервальний ряд із готових частот: початок, ширина h, частоти інтервалів [a; b). null, якщо даних немає. */
  function table(start, h, freqs) {
    var m = freqs.length, c = 0, iv = [];
    for (var i = 0; i < m; i++) {
      c += freqs[i];
      iv.push({ a: start + i * h, b: start + (i + 1) * h, mid: start + (i + 0.5) * h, f: freqs[i], cum: c });
    }
    return c > 0 && h > 0 && m > 0 ? { start: start, h: h, n: c, m: m, iv: iv } : null;
  }

  /** Середнє за серединами інтервалів. */
  function gMean(g) {
    var s = 0;
    g.iv.forEach(function (r) { s += r.f * r.mid; });
    return s / g.n;
  }
  /** Дисперсія за серединами інтервалів (без поправки Шеппарда). */
  function gVariance(g, ddof) {
    if (g.n - ddof <= 0) return null;
    var m = gMean(g), s = 0;
    g.iv.forEach(function (r) { s += r.f * (r.mid - m) * (r.mid - m); });
    return s / (g.n - ddof);
  }

  /**
   * Квантиль рівня p: x₀ + h · (p·n − F₍ₚᵣₑᵥ₎) / f, де інтервал [x₀; x₀ + h) перший,
   * на якому накопичена частота сягає p·n. Для p = 1/2 це медіана.
   */
  function gQuantile(g, p) {
    var target = p * g.n;
    for (var i = 0; i < g.m; i++) {
      var r = g.iv[i];
      if (r.cum >= target - EPS && r.f > 0) {
        var prev = r.cum - r.f;
        return { value: r.a + g.h * (target - prev) / r.f, i: i, target: target, prev: prev, f: r.f, a: r.a };
      }
    }
    return null;
  }

  /**
   * Мода: Mo = x₀ + h · d₁ / (d₁ + d₂), d₁ = f_m − f_{m−1}, d₂ = f_m − f_{m+1},
   * де m це модальний інтервал (найбільша частота). Поза крайніми інтервалами частоту вважаємо нулем.
   * Якщо найбільших частот кілька, повертаємо кожного кандидата. Якщо d₁ + d₂ = 0, формула не визначена.
   */
  function gMode(g) {
    var maxf = 0;
    g.iv.forEach(function (r) { if (r.f > maxf) maxf = r.f; });
    var cands = [];
    g.iv.forEach(function (r, i) {
      if (r.f !== maxf) return;
      var fm = i > 0 ? g.iv[i - 1].f : 0, fp = i < g.m - 1 ? g.iv[i + 1].f : 0;
      var d1 = maxf - fm, d2 = maxf - fp;
      cands.push({ i: i, a: r.a, f: maxf, fm: fm, fp: fp, d1: d1, d2: d2,
        mode: d1 + d2 > 0 ? r.a + g.h * d1 / (d1 + d2) : null });
    });
    if (g.m > 1 && cands.length === g.m) return { none: true, reason: "усі інтервали мають однакову частоту", cands: [], maxf: maxf };
    return { none: false, cands: cands, maxf: maxf };
  }

  return { sorted: sorted, sum: sum, mean: mean, median: median, medianSorted: medianSorted, quartiles: quartiles,
    variance: variance, sd: sd, series: series, modeRaw: modeRaw, box: box,
    group: group, table: table, gMean: gMean, gVariance: gVariance, gQuantile: gQuantile, gMode: gMode };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Summ;
