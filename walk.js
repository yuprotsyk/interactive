/* ============================================================
   walk.js: симетричні й несиметричні випадкові блукання на цілих числах. Глобальний об'єкт Walk. Від DOM не залежить.
   Потрібні Dist (розподіл положення) і, для симуляцій, генератор Rand, який передає сторінка.

   Модель: S₀ = 0, Sₙ = X₁ + … + Xₙ, кроки незалежні, P(Xᵢ = +1) = p, P(Xᵢ = −1) = q = 1 − p.
   Джерела (звірено): Grinstead & Snell, «Introduction to Probability», розд. 12 (розорення гравця, закони арксинуса);
   Феллер, «Вступ до теорії ймовірностей», т. 1, розд. III (флуктуації при підкиданні монети).
     Положення:      Sₙ = 2K − n, де K ~ Bin(n, p).
     u₂ₘ:            u₂ₘ = C(2m, m)/4ᵐ, ймовірність того, що симетричне блукання на кроці 2m в нулі; u₂ₘ ~ 1/√(πm).
     Без повернень:  P(S₁ ≠ 0, …, S₂ₘ ≠ 0) = u₂ₘ.
     Час «у плюсі»:  p = ½; Lₘ це число кроків із перших 2m, на яких шлях лежить вище осі (S_{i−1} ≥ 0 і Sᵢ ≥ 0);
                     P(Lₘ = 2k) = u₂ₖ·u₂ₘ₋₂ₖ (закон арксинуса для дискретного блукання).
     Розорення:      капітал a, суперник має b, N = a + b, r = q/p.
                     P(розорення) = b/N при p = ½, інакше (rᵃ − rᴺ)/(1 − rᴺ).
                     Очікувана тривалість: a·b при p = ½, інакше (a − N·(1 − rᵃ)/(1 − rᴺ))/(q − p).
   ============================================================ */
var Walk = (function () {
  "use strict";

  /** Ймовірність положення j (j = −n, −n + 2, …, n) після n кроків; для іншої парності 0. */
  function positionPmf(n, j, p) {
    var k2 = n + j;
    if (k2 % 2 !== 0 || j < -n || j > n) return 0;
    return Dist.binomial.pmf(k2 / 2, { n: n, p: p });
  }
  /** u₂ₘ = C(2m, m)/4ᵐ. */
  function u(m) {
    var r = 1, i;
    for (i = 1; i <= m; i++) r *= (2 * i - 1) / (2 * i);
    return r;
  }
  /** Масив u₀, u₂, …, u₂ₘ (за один прохід). */
  function uArray(m) {
    var a = [1], i;
    for (i = 1; i <= m; i++) a.push(a[i - 1] * (2 * i - 1) / (2 * i));
    return a;
  }
  /** Ймовірності P(Lₘ = 2k), k = 0…m (закон арксинуса для 2m кроків). */
  function arcsinePmf(m) {
    var ua = uArray(m), out = [], k;
    for (k = 0; k <= m; k++) out.push(ua[k] * ua[m - k]);
    return out;
  }
  /** Ймовірність жодного повернення в нуль за 2m кроків (p = ½). */
  function noReturn(m) { return u(m); }

  /** Ймовірність розорення гравця з капіталом a проти суперника з b (ставка 1, виграш кроку з імовірністю p). */
  function ruinProb(a, b, p) {
    var N = a + b, q = 1 - p;
    if (a <= 0) return 1;
    if (b <= 0) return 0;
    if (Math.abs(p - 0.5) < 1e-12) return b / N;
    var r = q / p, win;
    if (r < 1) win = (1 - Math.pow(r, a)) / (1 - Math.pow(r, N));
    else { var s = 1 / r; win = (Math.pow(s, b) - Math.pow(s, N)) / (1 - Math.pow(s, N)); }
    return 1 - win;
  }
  /** Очікувана тривалість гри (кількість кроків до розорення когось із двох). */
  function duration(a, b, p) {
    var N = a + b, q = 1 - p;
    if (a <= 0 || b <= 0) return 0;
    if (Math.abs(p - 0.5) < 1e-12) return a * b;
    return (a - N * (1 - ruinProb(a, b, p))) / (q - p);
  }

  /* ---------- Симуляції (генератор rng із Rand) ---------- */
  /** Шлях S₀…Sₙ як масив. */
  function path(rng, n, p) {
    var s = [0], i, x = 0;
    for (i = 0; i < n; i++) { x += rng.next() < p ? 1 : -1; s.push(x); }
    return s;
  }
  /** Скільки кроків шляху лежать вище осі: S_{i−1} + Sᵢ > 0 (для кроків ±1 це те саме, що обидві кінцеві точки ≥ 0). */
  function leadSteps(s) {
    var c = 0, i;
    for (i = 1; i < s.length; i++) if (s[i - 1] + s[i] > 0) c++;
    return c;
  }
  /** Одна гра: починаємо з a, закінчуємо при 0 (розорення) чи a + b. Повертає {ruined, steps, finished, path}; path (капітал після кожного кроку) лише коли keep;
      maxSteps захищає від надто довгої гри. */
  function game(rng, a, b, p, maxSteps, keep) {
    var x = a, N = a + b, t = 0, pts = keep ? [a] : null;
    while (x > 0 && x < N && t < maxSteps) { x += rng.next() < p ? 1 : -1; t++; if (keep) pts.push(x); }
    return { ruined: x <= 0, steps: t, finished: x <= 0 || x >= N, path: pts };
  }

  return { positionPmf: positionPmf, u: u, uArray: uArray, arcsinePmf: arcsinePmf, noReturn: noReturn,
           ruinProb: ruinProb, duration: duration, path: path, leadSteps: leadSteps, game: game };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Walk;
