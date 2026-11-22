/* ============================================================
   regression.js: проста лінійна регресія методом найменших квадратів.
   Глобальний об'єкт Reg. Потрібен Dist (distributions.js) для критичного значення t.

   Класична модель (див. Draper–Smith, Montgomery–Peck–Vining, Seber–Lee):
     y = a + b·x + ε,  ε незалежні, E ε = 0, D ε = σ².
   Оцінки за точками (xᵢ, yᵢ), i = 1…n:
     Sxx = Σ(xᵢ − x̄)², Sxy = Σ(xᵢ − x̄)(yᵢ − ȳ), Syy = Σ(yᵢ − ȳ)²
     b = Sxy / Sxx,  a = ȳ − b·x̄
     ŷᵢ = a + b·xᵢ,  залишок eᵢ = yᵢ − ŷᵢ  (Σeᵢ = 0)
     SSE = Σeᵢ²,  SST = Syy,  R² = 1 − SSE/SST  (= r² Пірсона)
     s² = SSE/(n − 2)  (оцінка σ²),  se(b) = s/√Sxx,  se(a) = s·√(1/n + x̄²/Sxx)
     довірчий інтервал для b: b ± t₁₋α/₂(n − 2)·se(b)
   Діагностика впливу:
     важіль (leverage)  hᵢ = 1/n + (xᵢ − x̄)²/Sxx   (Σhᵢ = 2)
     стандартизований залишок  rᵢ = eᵢ / (s·√(1 − hᵢ))
     відстань Кука  Dᵢ = eᵢ²·hᵢ / (2·s²·(1 − hᵢ)²)
   Модель недоступна (fit повертає null), якщо n < 2 або всі xᵢ однакові.
   ============================================================ */
(function (root) {
  "use strict";

  var D = root.Dist || (typeof require !== "undefined" ? require("./distributions.js") : null);
  var EPS = 1e-12;

  /** Модель за масивом точок {x, y}; null, якщо її не можна побудувати. */
  function fit(pts) {
    var n = pts.length;
    if (n < 2) return null;
    var i, mx = 0, my = 0;
    for (i = 0; i < n; i++) { mx += pts[i].x; my += pts[i].y; }
    mx /= n; my /= n;
    var sxx = 0, sxy = 0, syy = 0;
    for (i = 0; i < n; i++) {
      var dx = pts[i].x - mx, dy = pts[i].y - my;
      sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    if (!(sxx > EPS)) return null;
    var b = sxy / sxx, a = my - b * mx;
    var fitted = [], res = [], sse = 0;
    for (i = 0; i < n; i++) {
      var f = a + b * pts[i].x, e = pts[i].y - f;
      fitted.push(f); res.push(e); sse += e * e;
    }
    var df = n - 2;
    var s = df > 0 ? Math.sqrt(sse / df) : null;
    var h = [], std = [], cook = [];
    for (i = 0; i < n; i++) {
      var hi = 1 / n + (pts[i].x - mx) * (pts[i].x - mx) / sxx;
      h.push(hi);
      var ok = s !== null && s > EPS && 1 - hi > EPS;
      std.push(ok ? res[i] / (s * Math.sqrt(1 - hi)) : null);
      cook.push(ok ? res[i] * res[i] * hi / (2 * s * s * (1 - hi) * (1 - hi)) : null);
    }
    return {
      n: n, df: df, xbar: mx, ybar: my, sxx: sxx, sxy: sxy, syy: syy, b: b, a: a,
      fitted: fitted, res: res, sse: sse, sst: syy, ssr: syy - sse,
      r2: syy > EPS ? 1 - sse / syy : null,
      s: s, seB: s === null ? null : s / Math.sqrt(sxx),
      seA: s === null ? null : s * Math.sqrt(1 / n + mx * mx / sxx),
      h: h, stdres: std, cook: cook
    };
  }

  /** Значення прямої в точці x. */
  function predict(m, x) { return m.a + m.b * x; }

  /** Довірчий інтервал для нахилу b; null при n ≤ 2 або s = 0. */
  function slopeCI(m, level) {
    if (!m || m.df < 1 || m.seB === null) return null;
    var t = D.critical("t", level, m.df);
    return [m.b - t * m.seB, m.b + t * m.seB];
  }

  /** Модель без i-ї точки (для порівняння впливу). */
  function without(pts, i) {
    return fit(pts.filter(function (_, j) { return j !== i; }));
  }

  var api = { fit: fit, predict: predict, slopeCI: slopeCI, without: without };
  root.Reg = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
