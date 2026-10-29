/*
 * Математика для сторінок про повну ймовірність і формулу Байєса.
 * Гіпотези H₁…Hₖ утворюють повну групу: їхні ймовірності (prior) дають у сумі 1.
 * lik[i] це P(A | Hᵢ), ймовірність події A за умови гіпотези Hᵢ.
 */
var Prob = (function () {
  "use strict";

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }

  /** Змінює вагу i на v, а решту масштабує так, щоб сума лишилась 1. */
  function setWeight(w, i, v) {
    var k = w.length;
    v = Math.min(1, Math.max(0, v));
    var rest = sum(w) - w[i], out = [], j;
    for (j = 0; j < k; j++) {
      if (j === i) out.push(v);
      else if (rest > 1e-12) out.push(w[j] / rest * (1 - v));
      else out.push(k > 1 ? (1 - v) / (k - 1) : 0);
    }
    return out;
  }

  /** Змінює кількість гіпотез до k: нові отримують рівні частки, наявні масштабуються. */
  function resize(w, k) {
    var n = w.length, out = [], i;
    if (k === n) return w.slice();
    if (k > n) {
      var added = k - n, share = 1 / k, scale = 1 - added * share, s = sum(w);
      for (i = 0; i < n; i++) out.push(s > 0 ? w[i] / s * scale : scale / n);
      for (i = n; i < k; i++) out.push(share);
      return out;
    }
    var head = w.slice(0, k), hs = sum(head);
    for (i = 0; i < k; i++) out.push(hs > 1e-12 ? head[i] / hs : 1 / k);
    return out;
  }

  /** Формула повної ймовірності: P(A) = Σ P(Hᵢ)·P(A | Hᵢ). */
  function total(prior, lik) {
    var s = 0;
    for (var i = 0; i < prior.length; i++) s += prior[i] * lik[i];
    return s;
  }

  /** Внески Hᵢ у P(A) або в P(не A), залежно від observed. */
  function terms(prior, lik, observedA) {
    return prior.map(function (p, i) { return p * (observedA ? lik[i] : 1 - lik[i]); });
  }

  /** Формула Байєса: P(Hᵢ | A) (або P(Hᵢ | не A)). null, якщо така подія неможлива. */
  function posterior(prior, lik, observedA) {
    var t = terms(prior, lik, observedA), s = sum(t);
    if (!(s > 0)) return null;
    return t.map(function (x) { return x / s; });
  }

  /** Послідовні результати незалежних (за гіпотезою) випробувань: масив апостеріорних після кожного кроку. */
  function sequence(prior, lik, results) {
    var out = [prior.slice()], cur = prior.slice();
    for (var r = 0; r < results.length; r++) {
      var next = posterior(cur, lik, results[r]);
      if (next === null) next = cur.slice();
      cur = next;
      out.push(cur.slice());
    }
    return out;
  }

  /** Розкладає N випадків на цілі числа з найбільшою залишковою часткою (сума рівно N). */
  function apportion(shares, N) {
    var raw = shares.map(function (p) { return p * N; });
    var base = raw.map(Math.floor), left = N - sum(base);
    var order = raw.map(function (x, i) { return [x - Math.floor(x), i]; })
      .sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    for (var j = 0; j < left; j++) base[order[j][1]]++;
    return base;
  }

  /** Природні частоти: із N випадків скільки в кожній гіпотезі й скільки з них мають A. */
  function counts(prior, lik, N) {
    var h = apportion(prior, N);
    var a = h.map(function (n, i) { return Math.min(n, Math.round(n * lik[i])); });
    return { h: h, a: a };
  }

  return { setWeight: setWeight, resize: resize, total: total, terms: terms,
    posterior: posterior, sequence: sequence, apportion: apportion, counts: counts, sum: sum };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Prob;
