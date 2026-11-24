import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const SOL = "So11111111111111111111111111111111111111112";

describe("explore.server", () => {
  beforeEach(async () => {
    const explore = await import("./explore.server.ts");
    explore.clearExploreCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("falls back to the curated list when remote APIs fail", async () => {
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const { loadExploreSnapshot, clearExploreCaches } = await import("./explore.server.ts");
    clearExploreCaches();
    const snapshot = await loadExploreSnapshot();
    assert.equal(snapshot.live, false);
    assert.ok(snapshot.dapps.some((row) => row.id === "jupiter"));
    assert.equal(snapshot.pairs.length, 0);
    assert.ok(snapshot.fallbacks.includes("defillama-protocols"));
    assert.ok(snapshot.fallbacks.includes("jupiter-perps"));
  });

  it("merges DefiLlama, GeckoTerminal, and Jupiter perps, then caches", async () => {
    let fetches = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      fetches += 1;
      const url = String(input);
      if (url.includes("lite/protocols2")) {
        return jsonResponse({
          protocols: [
            {
              name: "Orca DEX",
              chains: ["Solana"],
              chainTvls: { Solana: { tvl: 248_000_000, tvlPrevDay: 246_000_000 } },
              logo: "https://icons.llamao.fi/icons/protocols/orca-dex",
            },
            {
              name: "Jupiter Perpetual Exchange",
              chains: ["Solana"],
              chainTvls: { Solana: { tvl: 575_000_000, tvlPrevDay: 570_000_000 } },
            },
          ],
        });
      }
      if (url.includes("overview/dexs/solana")) {
        return jsonResponse({
          protocols: [{ slug: "orca-dex", displayName: "Orca DEX", total24h: 270_000_000, change_1d: 12, logo: "https://example.com/o.png" }],
        });
      }
      if (url.includes("trending_pools")) {
        return jsonResponse({
          data: [
            {
              attributes: {
                address: "trend-pair",
                name: "BONK / SOL",
                base_token_price_usd: "0.00002",
                reserve_in_usd: "500000",
                volume_usd: { h24: "8000000" },
                price_change_percentage: { h24: "12.5" },
              },
              relationships: {
                base_token: { data: { id: "solana_bonk", type: "token" } },
                quote_token: { data: { id: "solana_sol", type: "token" } },
                dex: { data: { id: "raydium", type: "dex" } },
              },
            },
          ],
          included: [
            { id: "solana_bonk", type: "token", attributes: { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk", decimals: 5, image_url: "https://example.com/bonk.png" } },
            { id: "solana_sol", type: "token", attributes: { address: SOL, symbol: "SOL", name: "Solana", decimals: 9 } },
            { id: "raydium", type: "dex", attributes: { name: "Raydium" } },
          ],
        });
      }
      if (url.includes("/pools?")) {
        return jsonResponse({ data: [], included: [] });
      }
      if (url.includes("market-stats") && url.includes(SOL)) {
        return jsonResponse({ price: "71.5", priceChange24H: "0.4", volume: "282000000" });
      }
      if (url.includes("market-stats")) return jsonResponse({ code: "invalid_argument" }, 400);
      if (url.includes("pool-info") && url.includes(SOL)) {
        return jsonResponse({ longBorrowRatePercent: "0.0015", shortBorrowRatePercent: "0.0007" });
      }
      if (url.includes("pool-info")) return jsonResponse({ code: "invalid_argument" }, 400);
      if (url.includes("jlp-info")) {
        return jsonResponse({ custodies: [{ symbol: "SOL", guaranteedUsd: "1000000000000", globalShortSizes: "500000000000" }] });
      }
      if (url.includes("drift")) throw new Error("tls");
      return jsonResponse({}, 404);
    };

    const { loadExploreSnapshot, clearExploreCaches } = await import("./explore.server.ts");
    clearExploreCaches();
    const first = await loadExploreSnapshot();
    assert.equal(first.live, true);
    assert.ok(first.sources.includes("defillama-dexs"));
    assert.ok(first.sources.includes("geckoterminal"));
    assert.ok(first.sources.includes("jupiter-perps"));
    assert.ok(first.fallbacks.includes("drift"));
    const orca = first.dapps.find((row) => row.id === "orca");
    assert.equal(orca?.volume24hUsd, 270_000_000);
    assert.equal(first.pairs[0]?.baseSymbol, "BONK");
    assert.equal(first.perpMarkets[0]?.symbol, "SOL-PERP");
    assert.equal(first.perpVenues[0]?.id, "jupiter-perps");
    const afterFirst = fetches;
    const second = await loadExploreSnapshot();
    assert.equal(second.updatedAt, first.updatedAt);
    assert.equal(fetches, afterFirst);
  });
});
