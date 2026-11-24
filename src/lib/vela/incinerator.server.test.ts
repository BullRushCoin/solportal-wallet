import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

const originalFetch = globalThis.fetch;
const originalKey = process.env.HELIUS_API_KEY;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("incinerator.server", () => {
  beforeEach(async () => {
    delete process.env.HELIUS_API_KEY;
    const { clearIncineratorCaches } = await import("./incinerator.server.ts");
    clearIncineratorCaches();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.HELIUS_API_KEY;
    else process.env.HELIUS_API_KEY = originalKey;
  });

  it("quotes swappable dust and burns tokens with no route", async () => {
    globalThis.fetch = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("lite-api.jup.ag/price")) {
        return jsonResponse({
          EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: { usdPrice: 0.12 },
        });
      }
      if (url.includes("/quote?") && url.includes("EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm")) {
        return jsonResponse({ outAmount: "700000", inAmount: "4200000" });
      }
      if (url.includes("/quote?")) return jsonResponse({}, 400);
      return jsonResponse({}, 404);
    };

    const { loadIncineratorForHoldings, clearIncineratorCaches } = await import("./incinerator.server.ts");
    clearIncineratorCaches();
    const plan = await loadIncineratorForHoldings([
      {
        mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
        symbol: "WIF",
        name: "dogwifhat",
        amount: 4.2,
        decimals: 6,
      },
      {
        mint: "8mQy1s2uSRri9uaibZRpw5F79QTpqevyou5tfBExtLqj",
        symbol: "DEAD",
        name: "Dead Coin",
        amount: 1_250_000,
        decimals: 6,
      },
      {
        mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        symbol: "SAMO",
        name: "Samoyedcoin",
        amount: 0,
        decimals: 9,
      },
    ]);
    assert.equal(plan.count, 3);
    const wif = plan.items.find((item) => item.symbol === "WIF");
    const dead = plan.items.find((item) => item.symbol === "DEAD");
    const samo = plan.items.find((item) => item.symbol === "SAMO");
    assert.equal(wif?.action, "swap");
    assert.ok((wif?.swapSol ?? 0) > 0);
    assert.equal(dead?.action, "burn");
    assert.equal(samo?.action, "burn");
    assert.equal(samo?.amount, 0);
    assert.ok(plan.rentSol > 0);
    assert.ok(plan.feeSol > 0);
    assert.ok(Math.abs(plan.netSol - (plan.rentSol + plan.swapSol - plan.feeSol)) < 1e-9);
  });
});
