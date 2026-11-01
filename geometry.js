/*
 * Геометрична ймовірність: P(A) = mes(g) / mes(G), де G це множина всіх можливих
 * результатів, а g це її частина, що сприяє події A.
 * Підключається так: <script src="geometry.js"></script>. Від DOM не залежить.
 *
 * Задачі (класичні, див. Гнеденко «Курс теорії ймовірностей», Феллер т. 1, Ширяєв):
 *   - точка в крузі в центрі одиничного квадрата, P = π r²; чверть круга, P = π/4;
 *   - зустріч: двоє приходять у випадковий момент з [0; T] і чекають τ, P = 1 − (1 − τ/T)²;
 *   - голка Бюффона: голка довжини l ≤ d падає на лінії з кроком d, P = 2l/(πd);
 *   - парадокс Бертрана: випадкова хорда одиничного кола довша за √3 (сторону
 *     вписаного правильного трикутника), P = 1/3, 1/2 або 1/4 залежно від способу вибору.
 * Функції *Hit приймають вже вибрані «випадкові» координати, щоб сторінка керувала
 * генератором (Rand) і результат можна було відтворити.
 */
var Geom = (function () {
  "use strict";

  var SQRT3 = Math.sqrt(3);

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- Круг у центрі одиничного квадрата ---------- */
  /** Імовірність потрапити в круг радіуса r (0 ≤ r ≤ ½) у центрі квадрата [0; 1]². */
  function circleProb(r) { r = clamp(r, 0, 0.5); return Math.PI * r * r; }
  function circleHit(r, x, y) { var dx = x - 0.5, dy = y - 0.5; return dx * dx + dy * dy <= r * r; }
  /** Чверть круга радіуса 1 в одиничному квадраті: P = π/4. */
  function quarterProb() { return Math.PI / 4; }
  function quarterHit(x, y) { return x * x + y * y <= 1; }
  /** Оцінка π за частиною влучань у чверть круга: π ≈ 4 · hits / N. */
  function piFromQuarter(hits, n) { return n > 0 ? 4 * hits / n : null; }

  /* ---------- Зустріч ---------- */
  /** P(|X − Y| ≤ τ) для незалежних X, Y рівномірних на [0; T]. */
  function meetingProb(T, tau) {
    if (!(T > 0)) return null;
    var t = clamp(tau, 0, T) / T;
    return 1 - (1 - t) * (1 - t);
  }
  function meetingHit(tau, x, y) { return Math.abs(x - y) <= tau; }

  /* ---------- Голка Бюффона ---------- */
  /** Випадок l ≤ d: P = 2l/(πd). */
  function buffonProb(l, d) {
    if (!(d > 0) || !(l >= 0) || l > d) return null;
    return 2 * l / (Math.PI * d);
  }
  /** x це відстань від центра голки до найближчої лінії (0 ≤ x ≤ d/2),
      θ це кут між голкою й лініями (0 ≤ θ ≤ π/2). Перетин, якщо x ≤ (l/2) sin θ. */
  function buffonHit(l, x, theta) { return x <= (l / 2) * Math.sin(theta); }
  /** Оцінка π за N кидками й k перетинами: π ≈ 2 l N / (d k). */
  function piFromBuffon(l, d, hits, n) { return hits > 0 ? 2 * l * n / (d * hits) : null; }

  /* ---------- Парадокс Бертрана ---------- */
  var METHODS = [
    { id: 1, name: "Дві випадкові точки на колі", prob: 1 / 3 },
    { id: 2, name: "Випадкова точка на радіусі", prob: 1 / 2 },
    { id: 3, name: "Випадкова середина хорди в крузі", prob: 1 / 4 }
  ];
  /** Імовірність, що хорда довша за √3, для способу 1, 2 або 3. */
  function bertrandProb(method) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === method) return METHODS[i].prob;
    return null;
  }
  /**
   * Хорда одиничного кола за двома рівномірними числами u, v з [0; 1).
   * Спосіб 1: кінці на колі під кутами 2πu і 2πv.
   * Спосіб 2: напрям радіуса 2πu, середина хорди на відстані v від центра.
   * Спосіб 3: середина хорди рівномірна в крузі: відстань √u, напрям 2πv.
   * Повертає кінці (x1, y1), (x2, y2), середину (mx, my), довжину len і ознаку long (len > √3).
   */
  function bertrandChord(method, u, v) {
    var x1, y1, x2, y2, mx, my;
    if (method === 1) {
      var a = 2 * Math.PI * u, b = 2 * Math.PI * v;
      x1 = Math.cos(a); y1 = Math.sin(a); x2 = Math.cos(b); y2 = Math.sin(b);
      mx = (x1 + x2) / 2; my = (y1 + y2) / 2;
    } else {
      var rho, phi;
      if (method === 2) { phi = 2 * Math.PI * u; rho = v; }
      else { phi = 2 * Math.PI * v; rho = Math.sqrt(u); }
      var h = Math.sqrt(Math.max(0, 1 - rho * rho));
      var cx = Math.cos(phi), sy = Math.sin(phi);
      mx = rho * cx; my = rho * sy;
      x1 = mx - h * sy; y1 = my + h * cx;
      x2 = mx + h * sy; y2 = my - h * cx;
    }
    var len = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    return { x1: x1, y1: y1, x2: x2, y2: y2, mx: mx, my: my, len: len, long: len > SQRT3 };
  }

  /* ---------- Похибка частоти ---------- */
  /** Стандартне відхилення частки влучань після N дослідів: √(p(1 − p)/N). */
  function se(p, n) { return n > 0 ? Math.sqrt(p * (1 - p) / n) : null; }

  return {
    circleProb: circleProb, circleHit: circleHit,
    quarterProb: quarterProb, quarterHit: quarterHit, piFromQuarter: piFromQuarter,
    meetingProb: meetingProb, meetingHit: meetingHit,
    buffonProb: buffonProb, buffonHit: buffonHit, piFromBuffon: piFromBuffon,
    bertrandMethods: METHODS, bertrandProb: bertrandProb, bertrandChord: bertrandChord,
    se: se
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Geom;
