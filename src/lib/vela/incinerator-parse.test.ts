import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJupiterSwapQuote, parseTokenAccountsByOwner } from "./incinerator-parse.ts";

describe("parseJupiterSwapQuote", () => {
  it("reads outAmount lamports as SOL", () => {
    const parsed = parseJupiterSwapQuote({ outAmount: "699478", inAmount: "400000" });
    assert.ok(parsed);
    assert.ok(Math.abs(parsed!.outSol - 0.000699478) < 1e-12);
    assert.equal(parseJupiterSwapQuote({ outAmount: "0" }), null);
    assert.equal(parseJupiterSwapQuote({}), null);
  });
});

describe("parseTokenAccountsByOwner", () => {
  it("reads amount, mint, and rent from jsonParsed accounts", () => {
    const rows = parseTokenAccountsByOwner({
      result: [
        {
          pubkey: "Acc1111111111111111111111111111111111111111",
          account: {
            lamports: 2_039_280,
            data: {
              parsed: {
                info: {
                  mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
                  tokenAmount: { amount: "4200000", decimals: 6, uiAmount: 4.2 },
                },
              },
            },
          },
        },
        {
          pubkey: "Acc2222222222222222222222222222222222222222",
          account: {
            lamports: 2_039_280,
            data: {
              parsed: {
                info: {
                  mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                  tokenAmount: { amount: "0", decimals: 9, uiAmount: 0 },
                },
              },
            },
          },
        },
      ],
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.amount, 4.2);
    assert.equal(rows[1]?.amount, 0);
    assert.ok(Math.abs((rows[0]?.rentSol ?? 0) - 0.00203928) < 1e-12);
  });
});
