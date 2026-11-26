import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { combinePortfolio, parseHoldingsParam } from "@/lib/vela/portfolio-history";

describe("portfolio history", () => {
  it("sums amount × price on the densest grid with forward fill", () => {
    const out = combinePortfolio([
      { amount: 2, points: [{ t: 0, p: 10 }, { t: 10, p: 11 }, { t: 20, p: 12 }], fallbackPrice: 12 },
      { amount: 1, points: [{ t: 5, p: 100 }, { t: 20, p: 110 }], fallbackPrice: 110 },
      { amount: 50, points: [], fallbackPrice: 1 },
    ]);
    assert.deepEqual(out, [
      { t: 0, p: 20 + 100 + 50 },
      { t: 10, p: 22 + 100 + 50 },
      { t: 20, p: 24 + 110 + 50 },
    ]);
  });
  it("empty without any history", () => {
    assert.deepEqual(combinePortfolio([{ amount: 1, points: [], fallbackPrice: 1 }]), []);
  });
  it("parses holdings", () => {
    assert.deepEqual(parseHoldingsParam("abc:2:1.5,bad,x:0:1"), [{ mint: "abc", amount: 2, price: 1.5 }]);
  });
});
