import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOKENS } from "./tokens.ts";

const WSOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const originalFetch = globalThis.fetch;
const originalKey = process.env.HELIUS_API_KEY;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function redact(url: string): string {
  return url.replace(/api-key=[^&]+/gi, "api-key=REDACTED");
}

describe("helius.server", () => {
  let calls: string[];

  beforeEach(async () => {
    calls = [];
    delete process.env.HELIUS_API_KEY;
    const mod = await import("./helius.server.ts");
    mod.clearHeliusCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.HELIUS_API_KEY;
    else process.env.HELIUS_API_KEY = originalKey;
  });

  it("falls back to demo prices when remote fetches fail", async () => {
    globalThis.fetch = async (input: string | URL | Request) => {
      calls.push(`GET ${redact(String(input))}`);
      throw new Error("offline");
    };
    const { loadMarketSnapshot } = await import("./helius.server.ts");
    const snapshot = await loadMarketSnapshot();
    assert.equal(snapshot.live, false);
    assert.equal(snapshot.tokens.SOL?.source, "fallback");
    assert.equal(snapshot.tokens.SOL?.priceUsd, TOKENS[0]?.priceUsd);
  });

  it("merges Jupiter prices and logos, and caches the snapshot", async () => {
    process.env.HELIUS_API_KEY = "test-helius-key";
    let fetches = 0;
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      fetches += 1;
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${redact(url)}`);
      if (url.includes("lite-api.jup.ag/price")) {
        return jsonResponse({ [WSOL]: { usdPrice: 161.25, priceChange24h: 2.4 }, [USDC]: { usdPrice: 1, priceChange24h: 0 } });
      }
      if (url.includes("lite-api.jup.ag/tokens/v1/token/")) {
        const mint = url.split("/").pop() ?? "";
        return jsonResponse({ logoURI: `https://example.com/${mint}.png` });
      }
      if (url.includes("mainnet.helius-rpc.com")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        assert.equal(body.method, "getAssetBatch");
        return jsonResponse({
          result: TOKENS.map((token) => ({
            id: token.mint,
            interface: "FungibleToken",
            content: { metadata: { name: token.name, symbol: token.symbol }, links: { image: `https://cdn.example/${token.symbol}.png` } },
            token_info: { symbol: token.symbol, decimals: token.decimals, price_info: { price_per_token: token.priceUsd } },
          })),
        });
      }
      return jsonResponse({}, 404);
    };

    const { loadMarketSnapshot, clearHeliusCaches } = await import("./helius.server.ts");
    clearHeliusCaches();
    const first = await loadMarketSnapshot();
    const second = await loadMarketSnapshot();
    assert.equal(first, second);
    assert.equal(first.live, true);
    assert.equal(first.tokens.SOL?.priceUsd, 161.25);
    assert.equal(first.tokens.SOL?.change24hPct, 2.4);
    assert.equal(first.tokens.SOL?.image, "https://cdn.example/SOL.png");
    assert.equal(first.tokens.SOL?.source, "live");
    assert.ok(fetches >= 2);
    const after = fetches;
    await loadMarketSnapshot();
    assert.equal(fetches, after);
  });

  it("loadWatchedWallet requires a server key and maps DAS + 24h change", async () => {
    const { loadWatchedWallet, clearHeliusCaches } = await import("./helius.server.ts");
    clearHeliusCaches();
    await assert.rejects(() => loadWatchedWallet("So11111111111111111111111111111111111111112"), /HELIUS_UNAVAILABLE/);

    process.env.HELIUS_API_KEY = "test-helius-key";
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("lite-api.jup.ag/price")) {
        return jsonResponse({ [WSOL]: { usdPrice: 160, priceChange24h: 1.1 }, [USDC]: { usdPrice: 1, priceChange24h: -0.1 } });
      }
      if (url.includes("mainnet.helius-rpc.com")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
        assert.equal(body.method, "getAssetsByOwner");
        return jsonResponse({
          result: {
            items: [
              {
                id: USDC,
                interface: "FungibleToken",
                content: { metadata: { name: "USD Coin", symbol: "USDC" }, links: { image: "https://example.com/usdc.png" } },
                token_info: { symbol: "USDC", balance: 2_000_000, decimals: 6, price_info: { price_per_token: 1, total_price: 2 } },
              },
            ],
            nativeBalance: { lamports: 1_000_000_000, price_per_sol: 150 },
          },
        });
      }
      return jsonResponse({}, 404);
    };

    const wallet = await loadWatchedWallet("So11111111111111111111111111111111111111112");
    assert.equal(wallet.sol.amount, 1);
    assert.equal(wallet.tokens[0]?.symbol, "USDC");
    assert.equal(wallet.tokens[0]?.change24hPct, -0.1);
    assert.equal(wallet.tokens[0]?.image, "https://example.com/usdc.png");
    assert.ok((wallet.totalUsd ?? 0) > 0);
  });
});
