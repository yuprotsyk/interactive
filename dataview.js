/* ============================================================
   dataview.js: згорнутий блок «Дані» для сторінок із наборами даних (глобальний об'єкт DataView).
   Потрібні Summ (summary.js) і Stat (formulas.js). render(host, spec) будує <details>:
   підсумок по стовпцях (n, x̄, s), прокручувану таблицю значень і кнопку «Завантажити CSV».
   spec = { cols: [{ name, values }], file: "назва.csv", dec: знаків після коми у підсумку, summary: false (необов'язково) }.
   csv(cols) повертає текст CSV: роздільник кома, десяткова крапка, порожні клітинки для коротших стовпців.
   ============================================================ */
var DataView = (function () {
  "use strict";

  function csv(cols) {
    var rows = Math.max.apply(null, cols.map(function (c) { return c.values.length; })), out = [], i;
    out.push(cols.map(function (c) { return JSON.stringify(c.name); }).join(","));
    for (i = 0; i < rows; i++) out.push(cols.map(function (c) { return i < c.values.length ? String(c.values[i]) : ""; }).join(","));
    return out.join("\n") + "\n";
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function comma(v) { return String(v).replace(".", ","); }

  function render(host, spec) {
    host.textContent = "";
    var dec = spec.dec === undefined ? 2 : spec.dec, d = el("details", "more dv"), i, j;
    d.appendChild(el("summary", "", "Дані"));
    var body = el("div", "dv-body");
    /* підсумок */
    var t1 = el("table", "dv-tbl"), th = el("thead"), tb = el("tbody"), tr = el("tr");
    ["Стовпець", "n", "x̄", "s"].forEach(function (h, k) { var c = el("th", k ? "" : "l", h); tr.appendChild(c); });
    th.appendChild(tr); t1.appendChild(th);
    spec.cols.forEach(function (c) {
      var r = el("tr");
      r.appendChild(el("td", "l", c.name)); r.appendChild(el("td", "", String(c.values.length)));
      r.appendChild(el("td", "", Stat.fmt(Summ.mean(c.values), dec))); r.appendChild(el("td", "", Stat.fmt(Summ.sd(c.values, 1), dec)));
      tb.appendChild(r);
    });
    t1.appendChild(tb);
    var w1 = el("div", "dv-wrap"); w1.appendChild(t1); body.appendChild(w1);
    /* значення */
    var rows = Math.max.apply(null, spec.cols.map(function (c) { return c.values.length; }));
    var t2 = el("table", "dv-tbl"), h2 = el("thead"), r2 = el("tr"), b2 = el("tbody");
    r2.appendChild(el("th", "", "№"));
    spec.cols.forEach(function (c) { r2.appendChild(el("th", "", c.name)); });
    h2.appendChild(r2); t2.appendChild(h2);
    for (i = 0; i < rows; i++) {
      var r = el("tr"); r.appendChild(el("td", "", String(i + 1)));
      for (j = 0; j < spec.cols.length; j++) r.appendChild(el("td", "", i < spec.cols[j].values.length ? comma(spec.cols[j].values[i]) : ""));
      b2.appendChild(r);
    }
    t2.appendChild(b2);
    var w2 = el("div", "dv-wrap dv-scroll"); w2.setAttribute("tabindex", "0"); w2.setAttribute("role", "region"); w2.setAttribute("aria-label", "Значення набору даних");
    w2.appendChild(t2); body.appendChild(w2);
    /* CSV */
    var btn = el("button", "btn", "Завантажити CSV"); btn.type = "button";
    btn.addEventListener("click", function () {
      try {
        var blob = new Blob([csv(spec.cols)], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = spec.file || "data.csv";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      } catch (e) { /* у середовищах без Blob кнопка просто нічого не робить */ }
    });
    var p = el("p", "dv-act"); p.appendChild(btn); body.appendChild(p);
    d.appendChild(body); host.appendChild(d);
  }

  return { render: render, csv: csv };
})();

if (typeof module !== "undefined" && module.exports) module.exports = DataView;
