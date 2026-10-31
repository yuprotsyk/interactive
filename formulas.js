/* ============================================================
   formulas.js: відображення формул через KaTeX (CDN).
   Глобальний об'єкт Tex.

   Сторінки пишуть формули простим текстом (P(A|B)·P(B), x̄, σ² …).
   Tex.toTex перетворює такий запис на LaTeX, а Tex.render малює його
   за допомогою KaTeX. Якщо бібліотека не завантажилась (немає мережі),
   лишається простий запис, тож сторінка працює й без CDN.

   Використання:
     <span class="tex">x̄ = Σxᵢ / n</span>   // зарання в розмітці
     Tex.set(el, "P(A|B) = 0,5");             // динамічно
     Tex.render(root);                         // після ручної зміни вмісту
   Явний LaTeX (коли автоперетворення не вистачає): data-tex="...".
   ============================================================ */
(function (root) {
  "use strict";

  var VERSION = "0.16.11";
  var BASE = "https://cdn.jsdelivr.net/npm/katex@" + VERSION + "/dist/";
  var SRI_CSS = "sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+";
  var SRI_JS = "sha384-7zkQWkzuo3B5mTepMUcHkMB5jZaolc2xDwL6VFqjFALcbeS9Ggm/Yr2r3Dy4lfFg";

  /* ---------- Перетворення простого запису на LaTeX ---------- */

  var SUB = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "ₙ": "n", "ᵢ": "i", "ⱼ": "j", "ₖ": "k", "₊": "+", "₋": "-", "₍": "(", "₎": ")", "ₘ": "m", "ₓ": "x" };
  var SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "ⁿ": "n", "ⁱ": "i", "⁺": "+", "⁻": "-", "ᶜ": "c", "*": "*" };
  var SYM = {
    "·": "\\cdot ", "×": "\\times ", "÷": "\\div ", "−": "-", "–": "-", "≈": "\\approx ", "≠": "\\ne ", "≤": "\\le ", "≥": "\\ge ",
    "±": "\\pm ", "∓": "\\mp ", "∩": "\\cap ", "∪": "\\cup ", "∞": "\\infty ", "∑": "\\sum ", "Σ": "\\sum ", "∈": "\\in ", "∅": "\\varnothing ",
    "→": "\\to ", "⇒": "\\Rightarrow ", "↔": "\\leftrightarrow ", "|": "\\mid ", "∣": "\\mid ", "∂": "\\partial ", "…": "\\ldots ", "°": "^{\\circ}",
    "%": "\\%", "{": "\\{", "}": "\\}", "$": "\\$", "#": "\\#", "&": "\\&", "_": "\\_", "~": "\\sim ", "\\": "\\backslash ", "^": "\\^{}", "′": "'",
    "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "ε": "\\varepsilon ", "θ": "\\theta ", "λ": "\\lambda ",
    "μ": "\\mu ", "ν": "\\nu ", "π": "\\pi ", "ρ": "\\rho ", "σ": "\\sigma ", "τ": "\\tau ", "φ": "\\varphi ", "χ": "\\chi ",
    "ψ": "\\psi ", "ω": "\\omega ", "Δ": "\\Delta ", "Γ": "\\Gamma ", "Λ": "\\Lambda ", "Ω": "\\Omega ", "Π": "\\Pi ", "Φ": "\\Phi ",
    "¬": "\\neg ", "∀": "\\forall ", "∃": "\\exists ", "≡": "\\equiv ", "∼": "\\sim "
  };
  var FUNCS = { min: "\\min ", max: "\\max ", exp: "\\exp ", ln: "\\ln ", log: "\\log ", sin: "\\sin ", cos: "\\cos ", lim: "\\lim " };
  var NUMSEP = /[   ]/;

  function isCyr(c) { return /[А-Яа-яЇїІіЄєҐґЁё]/.test(c); }
  function isLat(c) { return /[A-Za-z]/.test(c); }
  function isDig(c) { return c >= "0" && c <= "9"; }
  function isAlnum(c) { return isCyr(c) || isLat(c) || isDig(c); }

  /** Розбирає дужки від позиції i (s[i] === "(") і повертає позицію закриваючої або -1. */
  function matchParen(s, i) {
    var depth = 0, k;
    for (k = i; k < s.length; k++) {
      if (s[k] === "(") depth++;
      else if (s[k] === ")") { depth--; if (depth === 0) return k; }
    }
    return -1;
  }

  /** Простий запис → LaTeX. Не кидає помилок: що не розпізнано, лишається як є. */
  function toTex(src) {
    var s = String(src === null || src === undefined ? "" : src);
    var out = "", i = 0, n = s.length, c, j, w, lead;

    // відступ на початку рядка (вирівнювання знаків «=») → \quad
    lead = /^ {2,}/.exec(s);
    if (lead) { out += "\\quad "; i = lead[0].length; }

    while (i < n) {
      c = s[i];

      // цитата «…» цілком як текст
      if (c === "«") {
        j = s.indexOf("»", i);
        if (j < 0) j = n - 1;
        out += "\\text{" + s.slice(i, j + 1).replace(/[{}\\$%&#_^~]/g, "") + "}";
        i = j + 1; continue;
      }

      // кириличні слова (з пробілами/дефісами між ними) → \text{…}
      if (isCyr(c)) {
        j = i;
        while (j < n && (isCyr(s[j]) || s[j] === "'" || s[j] === "’" ||
          ((s[j] === " " || s[j] === "-") && j + 1 < n && isCyr(s[j + 1])))) j++;
        out += "\\text{" + s.slice(i, j) + "}";
        i = j; continue;
      }

      // латинські слова: назви функцій, абревіатури, одиночні змінні
      if (isLat(c)) {
        j = i; while (j < n && isLat(s[j])) j++;
        w = s.slice(i, j);
        if (FUNCS[w]) out += FUNCS[w];
        else if (w.length === 1) {
          // змінна; надрядкові/підрядкові знаки після неї обробить основний цикл
          if (s[j] === "̄") { out += "\\bar{" + w + "}"; j++; }
          else if (s[j] === "̂") { out += "\\hat{" + w + "}"; j++; }
          else out += w;
        } else if (/^[A-Z][a-z]?$/.test(w) || w.length >= 2) {
          // Mo, Me, IQR, CV, SD, Var, df, Cov тощо: прямим шрифтом
          out += "\\mathrm{" + w + "}";
        }
        i = j; continue;
      }

      // ȳ, ŷ з precomposed-символами
      if (c === "ȳ") { out += "\\bar{y}"; i++; continue; }
      if (c === "ŷ") { out += "\\hat{y}"; i++; continue; }
      if (c === "x̄") { out += "\\bar{x}"; i++; continue; }

      // підрядкові індекси: група підряд
      if (SUB[c] !== undefined) {
        j = i; w = "";
        while (j < n && SUB[s[j]] !== undefined) { w += SUB[s[j]]; j++; }
        out += "_{" + w + "}"; i = j; continue;
      }
      // надрядкові
      if (SUP[c] !== undefined && c !== "*") {
        j = i; w = "";
        while (j < n && SUP[s[j]] !== undefined && s[j] !== "*") { w += SUP[s[j]]; j++; }
        out += "^{" + w + "}"; i = j; continue;
      }

      // корінь
      if (c === "√") {
        if (s[i + 1] === "(") {
          j = matchParen(s, i + 1);
          if (j > 0) { out += "\\sqrt{" + toTex(s.slice(i + 2, j)) + "}"; i = j + 1; continue; }
        }
        j = i + 1; while (j < n && /[A-Za-z0-9.,]/.test(s[j]) && !(s[j] === "," && !isDig(s[j + 1] || ""))) j++;
        out += "\\sqrt{" + toTex(s.slice(i + 1, j)) + "}"; i = j; continue;
      }

      // цифри: десяткова кома між цифрами, розряди через нерозривний пробіл
      if (isDig(c)) {
        j = i;
        while (j < n) {
          if (isDig(s[j])) { j++; continue; }
          if (s[j] === "," && isDig(s[j + 1] || "") && j > i) { j++; continue; }
          if (s[j] === "." && isDig(s[j + 1] || "") && j > i) { j++; continue; }
          if (NUMSEP.test(s[j]) && isDig(s[j + 1] || "") && j > i) { j++; continue; }
          break;
        }
        out += s.slice(i, j).replace(/(\d),(\d)/g, "$1{,}$2").replace(/[   ]/g, "\\,");
        i = j; continue;
      }

      if (SYM[c] !== undefined) { out += SYM[c]; i++; continue; }

      if (c === " " || c === " " || c === " ") {
        // пробіл між двома «словами» зберігаємо, решту ігноруємо (KaTeX сам розставляє відступи)
        if (i > 0 && isAlnum(s[i - 1]) && i + 1 < n && isAlnum(s[i + 1])) out += "\\ ";
        i++; continue;
      }

      if (c === "*") { out += "{*}"; i++; continue; }
      if (c === "̄" || c === "̂") { i++; continue; }

      out += c; i++; // дужки, кома, крапка з комою, знаки = + / < > ! ? : тощо
    }
    return out;
  }

  /* ---------- Завантаження KaTeX і малювання ---------- */

  var state = { loading: false, ready: false, failed: false };
  var queue = [];

  function load() {
    if (state.loading || state.ready || state.failed || typeof document === "undefined") return;
    state.loading = true;
    var link = document.createElement("link");
    link.rel = "stylesheet"; link.href = BASE + "katex.min.css";
    link.integrity = SRI_CSS; link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    var sc = document.createElement("script");
    sc.src = BASE + "katex.min.js"; sc.integrity = SRI_JS; sc.crossOrigin = "anonymous"; sc.async = true;
    sc.onload = function () {
      state.ready = !!root.katex; state.loading = false; state.failed = !state.ready;
      if (state.ready) flush();
    };
    sc.onerror = function () { state.failed = true; state.loading = false; };
    document.head.appendChild(sc);
  }

  function draw(el) {
    var src = el.getAttribute("data-src");
    if (src === null) { src = el.textContent; el.setAttribute("data-src", src); }
    var tex = el.getAttribute("data-tex");
    if (tex === null) tex = toTex(src);
    try {
      el.innerHTML = root.katex.renderToString(tex, { throwOnError: true, strict: "ignore", output: "htmlAndMathml", trust: false });
      el.setAttribute("data-done", "1");
    } catch (e) {
      // не вдалося: лишаємо простий текст, щоб сторінка не ламалась
      el.textContent = src; el.setAttribute("data-done", "err");
    }
  }

  function flush() {
    var list = queue; queue = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].getAttribute("data-done") === null) draw(list[i]); // і для ще не вставлених у документ елементів
    }
  }

  /** Малює всі ще не оброблені елементи .tex усередині root (або сам root). */
  function render(scope) {
    if (typeof document === "undefined") return;
    var top = scope || document;
    var list = [];
    if (top.nodeType === 1 && top.classList.contains("tex")) list.push(top);
    var found = top.querySelectorAll ? top.querySelectorAll(".tex") : [];
    for (var i = 0; i < found.length; i++) list.push(found[i]);
    var todo = [];
    for (i = 0; i < list.length; i++) if (list[i].getAttribute("data-done") === null) todo.push(list[i]);
    if (!todo.length) return;
    queue = queue.concat(todo);
    if (state.ready) flush(); else load();
  }

  /** Записує простий запис у елемент і малює формулу. */
  function set(el, plain, tex) {
    el.classList.add("tex");
    el.removeAttribute("data-done"); el.removeAttribute("data-src"); el.removeAttribute("data-tex");
    if (tex) el.setAttribute("data-tex", tex);
    el.textContent = plain;
    render(el);
  }

  /** Змішаний підпис: рядки лишаються текстом, {m: "запис"} стають формулою. */
  function mix(el, parts) {
    el.textContent = "";
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (typeof p === "string") { if (p) el.appendChild(document.createTextNode(p)); }
      else { var sp = document.createElement("span"); sp.className = "tex"; sp.textContent = p.m; el.appendChild(sp); }
    }
    render(el);
  }


  /* ---------- Формули всередині звичайного тексту ---------- */

  var CORE = /(?:P|E|D|N|F\*|Var|Cov)\(|x̄|ȳ|ȳ|ŷ|σ|μ|ρ|χ|Σ|√|²|∩|∪|[A-Za-z][₀-₉ᵢⱼₙₖ]/;

  function tokenIsMath(t) {
    var t2 = t.replace(/^[.,;:!?«»]+|[.,;:!?«»]+$/g, "");
    if (!t2) return false;
    if (/^[A-Za-z]{3,}$/.test(t2)) return false;
    if (/[А-Яа-яІіЇїЄєҐґ]/.test(t2)) return false;
    return true;
  }
  function balance(s) {
    var o, c;
    for (;;) {
      o = (s.match(/\(/g) || []).length; c = (s.match(/\)/g) || []).length;
      if (s.charAt(s.length - 1) === ")" && c > o) s = s.slice(0, -1).replace(/\s+$/, "");
      else if (s.charAt(0) === "(" && o > c) s = s.slice(1).replace(/^\s+/, "");
      else break;
    }
    return s;
  }
  /** Знаходить у тексті ділянки-формули: [[початок, кінець], …]. */
  function findMath(text) {
    var res = [], run = [], re = /\S+/g, m, i, k;
    function closeRun() {
      // «ймовірність A (P(A | B) > P(A))»: одиночна літера перед дужкою не частина формули
      while (run.length > 1 && /^[A-Za-z]$/.test(run[0].t) && run[1].t.charAt(0) === "(") run.shift();
      if (!run.length) return;
      var a = run[0].index, b = run[run.length - 1].index + run[run.length - 1].t.length;
      var seg = text.slice(a, b), cand = [[a, b]];
      if ((seg.match(/\(/g) || []).length !== (seg.match(/\)/g) || []).length) {
        cand = run.map(function (r) { return [r.index, r.index + r.t.length]; });
      }
      for (k = 0; k < cand.length; k++) {
        var s0 = text.slice(cand[k][0], cand[k][1]);
        var t = balance(s0.replace(/[.,;:!?—–-]+$/, "").replace(/^\s+|\s+$/g, ""));
        if (!CORE.test(t)) continue;
        i = s0.indexOf(t);
        if (i < 0) continue;
        res.push([cand[k][0] + i, cand[k][0] + i + t.length]);
      }
      run = [];
    }
    while ((m = re.exec(text)) !== null) {
      if (tokenIsMath(m[0])) run.push({ index: m.index, t: m[0] }); else closeRun();
    }
    closeRun();
    return res;
  }
  /** Текст → масивчастин для Tex.mix: рядки й {m: формула}. */
  function parts(text) {
    text = String(text === null || text === undefined ? "" : text);
    var spans = findMath(text), out = [], pos = 0, i;
    for (i = 0; i < spans.length; i++) {
      if (spans[i][0] > pos) out.push(text.slice(pos, spans[i][0]));
      out.push({ m: text.slice(spans[i][0], spans[i][1]) });
      pos = spans[i][1];
    }
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  }
  /** Вставляє текст у елемент, формули всередині малює через KaTeX. */
  function text(el, str) {
    var p = parts(str);
    if (p.length <= 1 && typeof p[0] !== "object") { el.textContent = str === null || str === undefined ? "" : String(str); return; }
    mix(el, p);
  }

  var api = { toTex: toTex, render: render, set: set, mix: mix, text: text, parts: parts, VERSION: VERSION };
  root.Tex = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined") {
    var start = function () { render(document); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
})(typeof window !== "undefined" ? window : globalThis);
