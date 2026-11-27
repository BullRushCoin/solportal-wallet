import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planCoinBuy, SOL_MINT, USDC_MINT } from "./buy-coin.ts";

const TSLA = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";

describe("planCoinBuy", () => {
  it("sends SOL to the card on-ramp", () => {
    assert.deepEqual(planCoinBuy(SOL_MINT, { sol: 5, usdc: 0, solPriceUsd: 72 }), { kind: "onramp" });
  });

  it("buys USDC with SOL, even when USDC is the bigger balance", () => {
    assert.deepEqual(planCoinBuy(USDC_MINT, { sol: 1, usdc: 5000, solPriceUsd: 72 }), { kind: "swap", input: "SOL", noFunds: false });
  });

  it("pays with SOL when SOL is worth more", () => {
    assert.deepEqual(planCoinBuy(TSLA, { sol: 10, usdc: 100, solPriceUsd: 72 }), { kind: "swap", input: "SOL", noFunds: false });
  });

  it("pays with USDC when USDC is worth more than SOL", () => {
    assert.deepEqual(planCoinBuy(TSLA, { sol: 1, usdc: 100, solPriceUsd: 72 }), { kind: "swap", input: "USDC", noFunds: false });
  });

  it("compares value, not raw amounts", () => {
    // 2 SOL at $72 = $144 beats 100 USDC.
    assert.deepEqual(planCoinBuy(TSLA, { sol: 2, usdc: 100, solPriceUsd: 72 }), { kind: "swap", input: "SOL", noFunds: false });
  });

  it("defaults to SOL on a tie and flags an empty wallet", () => {
    assert.deepEqual(planCoinBuy(TSLA, { sol: 0, usdc: 0, solPriceUsd: 72 }), { kind: "swap", input: "SOL", noFunds: true });
  });

  it("uses USDC when SOL has no price and USDC is held", () => {
    assert.deepEqual(planCoinBuy(TSLA, { sol: 3, usdc: 1, solPriceUsd: null }), { kind: "swap", input: "USDC", noFunds: false });
  });

  it("ignores negative or NaN balances", () => {
    assert.deepEqual(planCoinBuy(TSLA, { sol: Number.NaN, usdc: -4, solPriceUsd: 72 }), { kind: "swap", input: "SOL", noFunds: true });
  });
});
