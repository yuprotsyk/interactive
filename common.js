/*
 * Спільний код для всіх сторінок: статистика, форматування чисел, розмітка осей
 * і розбір вставлених даних. Підключається так: <script src="common.js"></script>
 * Після цього доступний об'єкт Stat. Файл не залежить від сторінки, тому його
 * можна перевіряти в Node (див. tests/check.mjs).
 */
var Stat = (function () {
  "use strict";
  var S = {};

  /* ---------- Форматування (десяткова кома, справжній мінус) ---------- */
  function localize(s) { return s.replace(".", ",").replace(/-/g, "−"); }

  S.clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };

  /** Фіксована кількість знаків; число, що округлилося до нуля, без мінуса. */
  S.fmt = function (v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    var s = v.toFixed(digits === undefined ? 3 : digits);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return localize(s);
  };
  S.fmtSigned = function (v, digits) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    var s = S.fmt(v, digits);
    return v > 0 && s !== S.fmt(0, digits) ? "+" + s : s;
  };
  /** Чотири значущі цифри; дуже малі й дуже великі числа в експоненційному записі. */
  S.fmtSig = function (v) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    if (v === 0) return "0";
    var a = Math.abs(v);
    var s = a < 1e-4 || a >= 1e7 ? v.toExponential(2) : String(Number(v.toPrecision(4)));
    return localize(s);
  };
  S.decimalsFor = function (span) {
    return S.clamp(-Math.floor(Math.log10(span)) + 3, 0, 6);
  };
  S.snapToSpan = function (v, span) {
    var f = Math.pow(10, S.decimalsFor(span));
    return Math.round(v * f) / f;
  };

  /* ---------- Осі ---------- */
  S.niceStep = function (span, target) {
    var raw = span / target;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / mag;
    var nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    return nf * mag;
  };
  /** Позначки осі: основні (з підписами) і проміжні (на півкроку). */
  S.ticksFor = function (lo, hi, target) {
    var step = S.niceStep(hi - lo, target);
    var out = {
      step: step,
      decimals: Math.min(6, Math.max(0, -Math.floor(Math.log10(step) + 1e-9))),
      major: [],
      minor: []
    };
    var k, k0 = Math.ceil(lo / step - 1e-9), k1 = Math.floor(hi / step + 1e-9);
    for (k = k0; k <= k1; k++) out.major.push(k * step + 0); // «+ 0» прибирає −0
    var half = step / 2, m, m0 = Math.ceil(lo / half - 1e-9), m1 = Math.floor(hi / half + 1e-9);
    for (m = m0; m <= m1; m++) if (m % 2 !== 0) out.minor.push(m * half + 0);
    return out;
  };

  /* ---------- Кореляція ---------- */
  S.mean = function (a) {
    var n = a.length, m = 0, i;
    for (i = 0; i < n; i++) m += a[i];
    m /= n;
    var c = 0;
    for (i = 0; i < n; i++) c += a[i] - m;
    return m + c / n;
  };
  /** Усі значення однакові (порівняння точне, без допусків). */
  S.isConstant = function (a) {
    for (var i = 1; i < a.length; i++) if (a[i] !== a[0]) return false;
    return true;
  };
  S.pearson = function (xs, ys) {
    var n = xs.length;
    if (n < 2 || ys.length !== n) return null;
    if (S.isConstant(xs) || S.isConstant(ys)) return null;
    var mx = S.mean(xs), my = S.mean(ys), sxx = 0, syy = 0, sxy = 0, i;
    for (i = 0; i < n; i++) {
      var dx = xs[i] - mx, dy = ys[i] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    var denom = Math.sqrt(sxx * syy);
    if (!(denom > 0)) return null;
    return Math.max(-1, Math.min(1, sxy / denom));
  };
  /** Ранги від 1; однакові значення отримують середній ранг. */
  S.ranks = function (a) {
    var idx = a.map(function (v, i) { return i; }).sort(function (p, q) { return a[p] - a[q]; });
    var out = new Array(a.length), i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
      var avg = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) out[idx[k]] = avg;
      i = j + 1;
    }
    return out;
  };
  S.spearman = function (xs, ys) {
    if (xs.length < 2) return null;
    return S.pearson(S.ranks(xs), S.ranks(ys));
  };

  /* ---------- Спеціальні функції для p-значення ---------- */
  var LANCZOS = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  /** ln Γ(z), наближення Ланцоша. */
  S.lgamma = function (z) {
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - S.lgamma(1 - z);
    z -= 1;
    var x = LANCZOS[0];
    for (var i = 1; i < LANCZOS.length; i++) x += LANCZOS[i] / (z + i);
    var t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  };
  function betacf(a, b, x) {
    var FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= 500; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  }
  /** Регуляризована неповна бета-функція I_x(a, b). */
  S.betai = function (a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(S.lgamma(a + b) - S.lgamma(a) - S.lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  };
  /** Двобічне p-значення t-тесту для r (n − 2 ступені свободи); null при n < 3. */
  S.pValue = function (r, n) {
    if (r === null || n < 3) return null;
    var df = n - 2, oneMinus = 1 - r * r;
    if (oneMinus <= 0) return 0;
    var t2 = r * r * df / oneMinus;
    return S.betai(df / 2, 0.5, df / (df + t2));
  };
  /** 95 % довірчий інтервал для r за перетворенням Фішера; null при n < 4 або |r| = 1. */
  S.fisherCI = function (r, n) {
    if (r === null || n < 4 || Math.abs(r) >= 1) return null;
    var z = Math.atanh(r), se = 1 / Math.sqrt(n - 3), Z = 1.959963984540054;
    return [Math.tanh(z - Z * se), Math.tanh(z + Z * se)];
  };

  /** Усе разом для масиву точок {x, y}. */
  S.analyze = function (points) {
    var n = points.length;
    var out = { n: n, r: null, rho: null, slope: null, intercept: null, meanX: null, meanY: null, p: null, ci: null };
    if (n === 0) return out;
    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    var mx = S.mean(xs), my = S.mean(ys);
    out.meanX = mx; out.meanY = my;
    if (n < 2) return out;
    out.r = S.pearson(xs, ys);
    out.rho = S.spearman(xs, ys);
    if (!S.isConstant(xs)) {
      var sxx = 0, sxy = 0;
      for (var i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
      if (sxx > 0) { out.slope = sxy / sxx; out.intercept = my - out.slope * mx; }
    }
    out.p = S.pValue(out.r, n);
    out.ci = S.fisherCI(out.r, n);
    return out;
  };

  /* ---------- Розбір вставлених даних ---------- */
  /** Число з комою чи крапкою та юнікодним мінусом; інакше null. */
  S.toNumber = function (raw) {
    var s = raw.replace(/−/g, "-").replace(/\s/g, "").replace(",", ".");
    if (s === "") return null;
    var v = Number(s);
    return isFinite(v) ? v : null;
  };
  /** Розділювач: табуляція чи «;», інакше пробіли, інакше кома. */
  S.splitLine = function (line) {
    var parts;
    if (/[\t;]/.test(line)) parts = line.split(/[\t;]+/);
    else if (/\s/.test(line)) parts = line.split(/\s+/);
    else parts = line.split(",");
    return parts.map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  };
  /** Два стовпчики чисел; перший нечисловий рядок з двох значень стає назвами осей. */
  S.parseData = function (text) {
    var points = [], skipped = 0, header = null, hadHeader = false;
    text.split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var parts = S.splitLine(line);
      var a = parts.length >= 2 ? S.toNumber(parts[0]) : null;
      var b = parts.length >= 2 ? S.toNumber(parts[1]) : null;
      if (a === null || b === null) {
        if (points.length === 0 && !hadHeader) {
          hadHeader = true;
          if (parts.length === 2) header = [parts[0], parts[1]];
        } else skipped++;
        return;
      }
      points.push({ x: a, y: b });
    });
    return { points: points, skipped: skipped, header: header, hadHeader: hadHeader };
  };

  return S;
})();

if (typeof module !== "undefined" && module.exports) module.exports = Stat;
