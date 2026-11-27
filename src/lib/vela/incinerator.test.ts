import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEAD_VALUE_USD,
  DEFAULT_INCINERATOR_FEE_BPS,
  TOKEN_ACCOUNT_RENT_SOL,
  feeOnReclaimed,
  holdingValueUsd,
  incineratorFeeBps,
  isDeadCoin,
  preferSwapOutput,
  sandboxIncineratorInputs,
  summarizePlan,
  type IncineratorItem,
} from "./incinerator.ts";
import { STARTER_HOLDINGS } from "./tokens.ts";

function item(partial: Partial<IncineratorItem> & Pick<IncineratorItem, "mint" | "symbol">): IncineratorItem {
  return {
    name: partial.name ?? partial.symbol,
    amount: partial.amount ?? 1,
    decimals: partial.decimals ?? 6,
    priceUsd: partial.priceUsd ?? 0,
    valueUsd: partial.valueUsd ?? 0,
    image: null,
    rentSol: partial.rentSol ?? TOKEN_ACCOUNT_RENT_SOL,
    swapSol: partial.swapSol ?? null,
    action: partial.action ?? "burn",
    quoteSource: partial.quoteSource ?? "none",
    mint: partial.mint,
    symbol: partial.symbol,
  };
}

describe("isDeadCoin", () => {
  it("never flags native SOL", () => {
    assert.equal(isDeadCoin({ symbol: "SOL", amount: 0.4, valueUsd: 0.4 }), false);
    assert.equal(isDeadCoin({ mint: "So11111111111111111111111111111111111111112", amount: 0, valueUsd: 0 }), false);
  });

  it("treats empty accounts, unpriced tokens, and sub-$1 holdings as dead", () => {
    assert.equal(isDeadCoin({ symbol: "SAMO", amount: 0, valueUsd: 0 }), true);
    assert.equal(isDeadCoin({ symbol: "DEAD", amount: 1_000, valueUsd: null }), true);
    assert.equal(isDeadCoin({ symbol: "WIF", amount: 4, valueUsd: 0.5 }), true);
    assert.equal(isDeadCoin({ symbol: "WIF", amount: 4, valueUsd: DEAD_VALUE_USD }), false);
    assert.equal(isDeadCoin({ symbol: "USDC", amount: 20, valueUsd: 20 }), false);
  });
});

describe("incinerator fees", () => {
  it("defaults to 5% of rent plus swap proceeds", () => {
    assert.equal(incineratorFeeBps(), DEFAULT_INCINERATOR_FEE_BPS);
    const rent = TOKEN_ACCOUNT_RENT_SOL * 2;
    const swap = 0.01;
    const fee = feeOnReclaimed(rent, swap, 500);
    assert.ok(Math.abs(fee - (rent + swap) * 0.05) < 1e-12);
    const plan = summarizePlan(
      [
        item({ mint: "mint1", symbol: "WIF", amount: 4, valueUsd: 0.5, swapSol: 0.01, action: "swap" }),
        item({ mint: "mint2", symbol: "SAMO", amount: 0, valueUsd: 0, action: "burn" }),
      ],
      { feeBps: 500, feeWallet: "GD5z4HJRrG6MTwrtceeu3W7mtHwZp7vBtQGkCHJrjJ2c" },
    );
    assert.equal(plan.count, 2);
    assert.ok(Math.abs(plan.netSol - (plan.rentSol + plan.swapSol - plan.feeSol)) < 1e-12);
    assert.equal(preferSwapOutput("SOL"), "USDC");
    assert.equal(preferSwapOutput("USDC"), "SOL");
    assert.equal(preferSwapOutput("WIF"), "USDC");
  });
});

describe("sandboxIncineratorInputs", () => {
  it("includes seeded dust and the empty SAMO account, but not unused LST slots", () => {
    const inputs = sandboxIncineratorInputs(STARTER_HOLDINGS);
    assert.ok(inputs.some((item) => item.symbol === "WIF" && item.amount === 4.2));
    assert.ok(inputs.some((item) => item.symbol === "SAMO" && item.amount === 0));
    assert.ok(!inputs.some((item) => item.symbol === "mSOL"));
    assert.ok(inputs.some((item) => item.symbol === "USDC"));
    assert.equal(holdingValueUsd(4.2, 0.123)! > 0, true);
  });
});

it("sandbox incinerator includes tokens bought through Swap", () => {
  const inputs = sandboxIncineratorInputs({ SOL: 1, WIF2: 3.5, GONE: 0 }, [
    { symbol: "WIF2", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, priceUsd: 0.2, image: null },
    { symbol: "GONE", name: "Gone", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9, priceUsd: 0 },
  ]);
  const custom = inputs.find((item) => item.symbol === "WIF2");
  assert.ok(custom);
  assert.equal(custom?.amount, 3.5);
  assert.equal(inputs.some((item) => item.symbol === "GONE"), false);
});
