import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { JupiterQuote } from "./jupiter.ts";
import {
  impactLevel,
  mapJupiterQuote,
  parseQuoteParams,
  parseSlippagePct,
  rateLine,
  rawToUi,
  routeText,
  trimJupiterQuote,
  uiToRaw,
} from "./swap-quote.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("uiToRaw / rawToUi", () => {
  it("converts exactly with string math", () => {
    assert.equal(uiToRaw("1", 9), "1000000000");
    assert.equal(uiToRaw("1.5", 6), "1500000");
    assert.equal(uiToRaw("0.000001", 6), "1");
    assert.equal(uiToRaw(".25", 2), "25");
    assert.equal(uiToRaw("0.1234567", 6), "123456", "extra decimals are truncated");
    assert.equal(uiToRaw("123456789.123456789", 9), "123456789123456789");
  });
  it("rejects empty, zero and junk", () => {
    for (const bad of ["", ".", "0", "0.000", "abc", "1.2.3", "-1", "0.0000001"]) assert.equal(uiToRaw(bad, 6), null, bad);
  });
  it("round-trips", () => {
    assert.equal(rawToUi("70725541", 6), 70.725541);
    assert.equal(rawToUi("1", 9), 1e-9);
    assert.equal(rawToUi(1500000000n, 9), 1.5);
    assert.equal(rawToUi("42", 0), 42);
    assert.equal(rawToUi("nope", 6), 0);
    assert.equal(rawToUi(uiToRaw("12.345", 5)!, 5), 12.345);
  });
});

const live: JupiterQuote = {
  inputMint: SOL,
  inAmount: "1000000000",
  outputMint: USDC,
  outAmount: "70725541",
  otherAmountThreshold: "70371914",
  swapMode: "ExactIn",
  slippageBps: 50,
  priceImpactPct: "0.0000397639506139818",
  platformFee: { amount: "606320", feeBps: 85 },
  routePlan: [{ percent: 100, swapInfo: { label: "PancakeSwap", feeAmount: "0", feeMint: SOL } }],
};

describe("mapJupiterQuote", () => {
  it("maps a real SOL→USDC quote", () => {
    const view = mapJupiterQuote(live, { symbol: "SOL", mint: SOL, decimals: 9, priceUsd: 71.3 }, { symbol: "USDC", mint: USDC, decimals: 6, priceUsd: 1 });
    assert.equal(view.source, "live");
    assert.equal(view.inUi, 1);
    assert.equal(view.outUi, 70.725541);
    assert.equal(view.minOutUi, 70.371914);
    assert.equal(view.feeUi, 0.60632);
    assert.equal(view.feeSymbol, "USDC");
    assert.ok(Math.abs(view.feeUsd - 0.60632) < 1e-9);
    assert.ok(Math.abs(view.impactPct - 0.00397639) < 1e-6, "fraction becomes percent");
    assert.equal(view.route, "PancakeSwap");
    assert.equal(view.rate, 70.725541);
    assert.equal(rateLine("SOL", "USDC", view.rate), "1 SOL ≈ 70.7255 USDC");
  });
  it("prices the fee from the implied rate when the output price is unknown", () => {
    const view = mapJupiterQuote(live, { symbol: "SOL", mint: SOL, decimals: 9, priceUsd: 71.33 }, { symbol: "NEW", mint: USDC, decimals: 6, priceUsd: 0 });
    assert.ok(Math.abs(view.feeUsd - 0.6063) < 0.001);
  });
  it("formats split routes and tiny rates", () => {
    assert.equal(
      routeText([
        { percent: 68, swapInfo: { label: "Perps", feeAmount: "0", feeMint: SOL } },
        { percent: 32, swapInfo: { label: "Whirlpool", feeAmount: "0", feeMint: SOL } },
      ]),
      "Perps 68% · Whirlpool 32%",
    );
    assert.equal(routeText([]), "—");
    assert.equal(rateLine("BONK", "SOL", 0.0000000301234), "1 BONK ≈ 0.00000003012 SOL");
  });
  it("trims Jupiter's response to the client fields", () => {
    const trimmed = trimJupiterQuote({ ...live, mostReliableAmmsQuoteReport: { info: {} }, contextSlot: 1 });
    assert.deepEqual(trimmed, live);
    assert.equal(trimJupiterQuote({ error: "No routes found" }), null);
    assert.equal(trimJupiterQuote(null), null);
  });
});

describe("impact, slippage and params", () => {
  it("grades price impact", () => {
    assert.equal(impactLevel(0.3), "ok");
    assert.equal(impactLevel(1), "ok");
    assert.equal(impactLevel(1.01), "warn");
    assert.equal(impactLevel(5.5), "danger");
  });
  it("parses custom slippage", () => {
    assert.equal(parseSlippagePct("0.5"), 50);
    assert.equal(parseSlippagePct("2%"), 200);
    assert.equal(parseSlippagePct("50"), 5000);
    assert.equal(parseSlippagePct("51"), null);
    assert.equal(parseSlippagePct("0"), null);
    assert.equal(parseSlippagePct("x"), null);
  });
  it("validates /api/quote params and pins the platform fee", () => {
    const ok = parseQuoteParams(new URLSearchParams({ inputMint: SOL, outputMint: USDC, amount: "1000000000", slippageBps: "100", platformFeeBps: "0" }));
    assert.ok(ok.ok);
    if (ok.ok) {
      assert.equal(ok.value.platformFeeBps, 85);
      assert.equal(ok.value.slippageBps, 100);
    }
    const dflt = parseQuoteParams(new URLSearchParams({ inputMint: SOL, outputMint: USDC, amount: "5" }));
    assert.ok(dflt.ok && dflt.value.slippageBps === 50);
    assert.equal(parseQuoteParams(new URLSearchParams({ inputMint: "bad", outputMint: USDC, amount: "1" })).ok, false);
    assert.equal(parseQuoteParams(new URLSearchParams({ inputMint: SOL, outputMint: SOL, amount: "1" })).ok, false);
    assert.equal(parseQuoteParams(new URLSearchParams({ inputMint: SOL, outputMint: USDC, amount: "1.5" })).ok, false);
    assert.equal(parseQuoteParams(new URLSearchParams({ inputMint: SOL, outputMint: USDC, amount: "0" })).ok, false);
    assert.equal(parseQuoteParams(new URLSearchParams({ inputMint: SOL, outputMint: USDC, amount: "1", slippageBps: "9999" })).ok, false);
  });
});
