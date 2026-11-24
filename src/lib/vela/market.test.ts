import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fallbackMarketSnapshot, holdingsChange24h, withLivePrice, type MarketTokenQuote } from "./market.ts";
import { holdingsUsd, tokenBySymbol } from "./tokens.ts";

function quote(partial: Partial<MarketTokenQuote> & { symbol: string }): MarketTokenQuote {
  return {
    mint: partial.mint ?? "mint",
    name: partial.name ?? partial.symbol,
    priceUsd: partial.priceUsd ?? 1,
    change24hPct: partial.change24hPct ?? null,
    image: partial.image ?? null,
    source: partial.source ?? "live",
    symbol: partial.symbol,
  };
}

describe("market helpers", () => {
  it("falls back to the demo token table", () => {
    const snapshot = fallbackMarketSnapshot(1);
    assert.equal(snapshot.live, false);
    assert.equal(snapshot.tokens.SOL?.priceUsd, tokenBySymbol("SOL").priceUsd);
    assert.equal(snapshot.tokens.SOL?.source, "fallback");
  });

  it("overrides a token price when the live quote is positive", () => {
    const live = withLivePrice(tokenBySymbol("SOL"), quote({ symbol: "SOL", priceUsd: 200 }));
    assert.equal(live.priceUsd, 200);
    assert.equal(withLivePrice(tokenBySymbol("SOL"), quote({ symbol: "SOL", priceUsd: 0 })).priceUsd, tokenBySymbol("SOL").priceUsd);
  });

  it("values holdings with live prices and weights 24h change", () => {
    const holdings = { SOL: 2, USDC: 100 };
    const quotes = {
      SOL: quote({ symbol: "SOL", priceUsd: 50, change24hPct: 10 }),
      USDC: quote({ symbol: "USDC", priceUsd: 1, change24hPct: -2 }),
    };
    assert.equal(holdingsUsd(holdings, { SOL: 50, USDC: 1 }), 200);
    const change = holdingsChange24h(holdings, quotes);
    // 100 * 10% + 100 * -2% = 8, / 200 = 4
    assert.equal(change, 4);
    assert.equal(holdingsChange24h(holdings, { SOL: quote({ symbol: "SOL", priceUsd: 50 }) }), null);
  });
});
