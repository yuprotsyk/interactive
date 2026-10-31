import test from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { toTex } = require("../formulas.js");

test("toTex: базові перетворення", () => {
  assert.equal(toTex("P(A|B)·P(B)"), "P(A\\mid B)\\cdot P(B)");
  assert.equal(toTex("x̄"), "\\bar{x}");
  assert.equal(toTex("σ²"), "\\sigma ^{2}");
  assert.equal(toTex("H₁"), "H_{1}");
  assert.equal(toTex("0,95"), "0{,}95");
  assert.equal(toTex("√(n−1)"), "\\sqrt{n-1}");
  assert.equal(toTex("P(Хворий|Позитивний)"), "P(\\text{Хворий}\\mid \\text{Позитивний})");
});
test("toTex: не падає на порожньому й дивному вводі", () => {
  assert.equal(toTex(""), "");
  assert.equal(toTex(null), "");
  assert.equal(typeof toTex("{}$%&_^~\\"), "string");
});

test("parts: формули в тексті", () => {
  const { parts } = require("../formulas.js");
  assert.deepEqual(parts("Події незалежні: P(A ∩ B) = P(A)·P(B), тож усе."),
    ["Події незалежні: ", { m: "P(A ∩ B) = P(A)·P(B)" }, ", тож усе."]);
  assert.deepEqual(parts("Звичайний текст без формул."), ["Звичайний текст без формул."]);
  assert.deepEqual(parts("зі скінченними μ і σ)"), ["зі скінченними ", { m: "μ" }, " і ", { m: "σ" }, ")"]);
  assert.deepEqual(parts("Q₁ − 1,5·IQR і Me"), [{ m: "Q₁ − 1,5·IQR" }, " і Me"]);
});

test("toTex: типові формули сторінок розбираються KaTeX без помилок", (t) => {
  let katex;
  try { katex = require("katex"); } catch { t.skip("katex не встановлено (npm install)"); return; }
  const samples = [
    "P(Hᵢ | A) = P(A | Hᵢ)·P(Hᵢ) / Σ P(A | Hⱼ)·P(Hⱼ)",
    "P(A ∩ B ∩ C) = P(A)·P(B)·P(C)",
    "P(Хворий | Позитивний) = 0,009 / 0,0981 = 0,09174",
    "P(H₁ | не A) = 0,5",
    "N(μ; σ²/n)", "μ ± 1,96σ/√n", "x̄ ± t·SE = 5,2 ± 0,3", "SE = s/√n = 0,5", "t(9; 95 %) = 2,262",
    "x̄ = Σ xᵢ·fᵢ / n", "s² = Σ (xᵢ − x̄)²·fᵢ / (n − 1) = 3,5", "Mo = x₀ + h·d₁/(d₁ + d₂)",
    "Me = x₀ + h·(n/2 − F)/f", "Q₁ − 1,5·IQR", "F*(x) = P(X ≤ x)", "P(a ≤ X ≤ b) =", "χ²(5)", "ρ = 0",
    "y = 1,2 − 0,5·x", "H₀: ρ = 0", "d₁ + d₂ = 0", "1 000 / 2 500 = 0,4", "E(X) = n·p", "D(X) = 4,8", "{}$%&_^~\\"
  ];
  for (const s of samples) {
    assert.doesNotThrow(() => katex.renderToString(toTex(s), { throwOnError: true, strict: "ignore" }), s + " → " + toTex(s));
  }
});

test("parts: одиночна літера перед дужкою не входить у формулу", () => {
  const { parts } = require("../formulas.js");
  assert.deepEqual(parts("ймовірність A (P(A | B) > P(A))."),
    ["ймовірність A ", { m: "(P(A | B) > P(A))" }, "."]);
});
