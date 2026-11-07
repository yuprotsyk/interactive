/* ============================================================
   combinatorics.js: комбінаторика. Глобальний об'єкт Comb. Від DOM не залежить. Цілі результати точні (BigInt).

   Чотири схеми вибору k елементів з n різних (підручники з комбінаторики: Гмурман, Феллер, Гнеденко):
                           без повторень                          з повтореннями
     порядок важить        розміщення      A(n,k) = n!/(n−k)!     n^k
     порядок не важить     сполучення      C(n,k) = n!/(k!(n−k)!)  C(n+k−1, k)
   Перестановки P(n) = n! = A(n,n). Перестановки з повторами: n!/(m₁!·…·m_r!), де mᵢ кратності елементів.
   Для n = 0 вважаємо A(0,0) = C(0,0) = 1 і 0⁰ = 1 (одна порожня вибірка).
   Ймовірність за класичним означенням: P = (кількість сприятливих наслідків)/(кількість усіх рівноможливих).
   BigInt створюємо викликом BigInt(), без літералів 1n (збережено стиль коду на var).
   ============================================================ */
var Comb = (function () {
  "use strict";

  var ZERO = BigInt(0), ONE = BigInt(1);
  var factCache = [ONE];

  function fact(n) {
    var i;
    if (n < 0 || n !== Math.floor(n)) return null;
    for (i = factCache.length; i <= n; i++) factCache.push(factCache[i - 1] * BigInt(i));
    return factCache[n];
  }
  /** Розміщення без повторень A(n,k) = n(n−1)…(n−k+1). */
  function perm(n, k) {
    if (k < 0 || k > n) return ZERO;
    var r = ONE, i;
    for (i = 0; i < k; i++) r *= BigInt(n - i);
    return r;
  }
  /** Розміщення з повтореннями n^k. */
  function permRep(n, k) {
    if (k < 0) return ZERO;
    var r = ONE, i, b = BigInt(n);
    for (i = 0; i < k; i++) r *= b;
    return r;
  }
  /** Сполучення без повторень C(n,k); ділення на кожному кроці точне. */
  function comb(n, k) {
    if (k < 0 || k > n) return ZERO;
    if (k > n - k) k = n - k;
    var r = ONE, i;
    for (i = 0; i < k; i++) r = r * BigInt(n - i) / BigInt(i + 1);
    return r;
  }
  /** Сполучення з повтореннями C(n+k−1, k). */
  function combRep(n, k) {
    if (k < 0) return ZERO;
    if (n === 0) return k === 0 ? ONE : ZERO;
    return comb(n + k - 1, k);
  }
  /** Мультиноміальний коефіцієнт (Σ mᵢ)!/∏ mᵢ! для кратностей counts. */
  function multinomial(counts) {
    var total = 0, i, den = ONE;
    for (i = 0; i < counts.length; i++) { total += counts[i]; den *= fact(counts[i]); }
    return fact(total) / den;
  }
  /** Кількість за схемою: kind "A" | "Arep" | "C" | "Crep". */
  function count(kind, n, k) {
    if (kind === "A") return perm(n, k);
    if (kind === "Arep") return permRep(n, k);
    if (kind === "C") return comb(n, k);
    return combRep(n, k);
  }

  /** Число з розрядами по три: 13 983 816 (нерозривні пробіли). */
  function group(b) { return b.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  /** Наукова форма великого цілого: {m, e} з 1 ≤ m < 10 (m за першими 15 цифрами). */
  function sci(b) {
    var s = b.toString(), e = s.length - 1, digits = s.slice(0, 15);
    return { m: Number(digits.charAt(0) + "." + digits.slice(1)), e: e };
  }

  /** Частка a/b як число (a, b: BigInt, b > 0, a ≤ b·10¹⁰⁰); точність близько 15 значущих цифр. */
  function ratio(a, b) {
    var shift = 40, scaled = a * BigInt("1" + new Array(shift + 1).join("0")) / b;
    return Number(scaled) / 1e40;
  }
  /** Імовірність, що в групі з k осіб (рік з n днів) усі дні народження різні: A(n,k)/n^k. */
  function birthdayDistinct(n, k) {
    var p = 1, i;
    for (i = 0; i < k; i++) p *= (n - i) / n;
    return p;
  }
  /** Лотерея «K з N»: ймовірність вгадати рівно m: C(K,m)·C(N−K,K−m)/C(N,K). */
  function lotteryExact(N, K, m) { return ratio(comb(K, m) * comb(N - K, K - m), comb(N, K)); }

  /* ---------- Перелік варіантів (лексикографічний порядок, не більше limit штук) ---------- */
  /** Перші варіанти як масиви індексів 0…n−1. kind: "A" | "Arep" | "C" | "Crep". */
  function list(kind, n, k, limit) {
    var out = [], cur = [];
    function rec(start, used) {
      var i;
      if (out.length >= limit) return;
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (i = (kind === "C" || kind === "Crep") ? start : 0; i < n; i++) {
        if (kind === "A" && used[i]) continue;
        if (kind === "A") used[i] = true;
        cur.push(i);
        rec(kind === "Crep" ? i : i + 1, used);
        cur.pop();
        if (kind === "A") used[i] = false;
        if (out.length >= limit) return;
      }
    }
    if (n < 0 || k < 0) return out;
    if ((kind === "A" || kind === "C") && k > n) return out;
    if (n === 0 && k > 0) return out;
    rec(0, []);
    return out;
  }
  /** Перші різні перестановки мультимножини з кратностями counts (індекси літер), лексикографічно. */
  function listMulti(counts, limit) {
    var total = 0, i, out = [], cur = [], c = counts.slice();
    for (i = 0; i < c.length; i++) total += c[i];
    function rec() {
      var j;
      if (out.length >= limit) return;
      if (cur.length === total) { out.push(cur.slice()); return; }
      for (j = 0; j < c.length; j++) {
        if (c[j] === 0) continue;
        c[j]--; cur.push(j);
        rec();
        cur.pop(); c[j]++;
        if (out.length >= limit) return;
      }
    }
    rec();
    return out;
  }

  return { fact: fact, perm: perm, permRep: permRep, comb: comb, combRep: combRep, multinomial: multinomial, count: count,
           group: group, sci: sci, ratio: ratio, birthdayDistinct: birthdayDistinct, lotteryExact: lotteryExact,
           list: list, listMulti: listMulti };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Comb;
