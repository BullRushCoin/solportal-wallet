import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_FEE_BPS, quoteDemo } from "./jupiter.ts";
import { tokenBySymbol } from "./tokens.ts";

describe("quoteDemo", () => {
  it("returns a local SOL to USDC quote with the platform fee", () => {
    const quote = quoteDemo(tokenBySymbol("SOL"), tokenBySymbol("USDC"), 1, "DemoPubkey");
    assert.ok(quote);
    assert.ok(quote.outUi > 0);
    assert.ok(quote.feeUsd > 0);
    assert.equal(quote.feeMint.symbol, "USDC");
    assert.equal(quote.jupiter.platformFee?.feeBps, PLATFORM_FEE_BPS);
    assert.equal(quote.feeAccount, "YOUR_USDC_FEE_TOKEN_ACCOUNT");
    assert.equal(quote.swapBody.userPublicKey, "DemoPubkey");
  });

  it("returns null for a zero amount or a same-token pair", () => {
    const sol = tokenBySymbol("SOL");
    const usdc = tokenBySymbol("USDC");
    assert.equal(quoteDemo(sol, usdc, 0, "x"), null);
    assert.equal(quoteDemo(sol, sol, 1, "x"), null);
  });
});
