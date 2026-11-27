import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalKey = process.env.HELIUS_API_KEY;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function redact(url: string): string {
  return url.replace(/api-key=[^&]+/gi, "api-key=REDACTED");
}

describe("stake.server", () => {
  beforeEach(async () => {
    delete process.env.HELIUS_API_KEY;
    const market = await import("./helius.server.ts");
    const stake = await import("./stake.server.ts");
    market.clearHeliusCaches();
    stake.clearStakeCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.HELIUS_API_KEY;
    else process.env.HELIUS_API_KEY = originalKey;
  });

  it("falls back when remote stake APIs fail", async () => {
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const { loadStakeMarket, clearStakeCaches } = await import("./stake.server.ts");
    clearStakeCaches();
    const snapshot = await loadStakeMarket();
    assert.equal(snapshot.live, false);
    assert.ok(snapshot.lsts.some((item) => item.symbol === "JitoSOL"));
    assert.equal(snapshot.validators.length, 0);
  });

  it("merges Sanctum TVL, Blaze APY, and Stakewiz validators, then caches", async () => {
    let fetches = 0;
    globalThis.fetch = async (input: string | URL | Request) => {
      fetches += 1;
      const url = redact(String(input));
      if (url.includes("extra-api.sanctum.so/v1/tvl")) {
        return jsonResponse({ tvls: { JitoSOL: "1000000000000000", mSOL: "2000000000000000", bSOL: "300000000000000", INF: "400000000000000" } });
      }
      if (url.includes("sol-value/current")) {
        return jsonResponse({ solValues: { JitoSOL: "1275866054", mSOL: "1376648063", bSOL: "1290721131", INF: "1407837461" } });
      }
      if (url.includes("apy/latest")) return jsonResponse({ apys: {} });
      if (url.includes("stake.solblaze.org")) return jsonResponse({ success: true, apy: 4.9 });
      if (url.includes("marinade.finance/tlv")) return jsonResponse({ staked_sol: 2_210_535 });
      if (url.includes("stakewiz.com/validators")) {
        return jsonResponse([
          {
            vote_identity: "5szskKdH8nfnUuHTvn9hnhH3Xuvo7RVmcDDvD5WD7yNh",
            name: "StakeNode777",
            commission: 0,
            activated_stake: 185724,
            total_apy: 5.01,
            delinquent: false,
            image: "https://example.com/v.png",
          },
        ]);
      }
      if (url.includes("stakewiz.com/epoch_info")) {
        return jsonResponse({ epoch: 1095, duration_seconds: 100, elapsed_seconds: 40, remaining_seconds: 60 });
      }
      if (url.includes("api.jup.ag") || url.includes("mainnet.helius-rpc.com")) {
        return jsonResponse({});
      }
      return jsonResponse({}, 404);
    };

    const { loadStakeMarket, clearStakeCaches } = await import("./stake.server.ts");
    clearStakeCaches();
    const first = await loadStakeMarket();
    const after = fetches;
    const second = await loadStakeMarket();
    assert.equal(first, second);
    assert.equal(fetches, after);
    assert.equal(first.live, true);
    assert.equal(first.epoch?.epoch, 1095);
    const bsol = first.lsts.find((item) => item.symbol === "bSOL");
    assert.equal(bsol?.apyPct, 4.9);
    assert.ok((bsol?.tvlSol ?? 0) > 0);
    assert.equal(first.validators[0]?.name, "StakeNode777");
    assert.equal(first.validators[0]?.image, "https://example.com/v.png");
  });
});
