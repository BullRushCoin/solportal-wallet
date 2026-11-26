import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPickerRows, mapJupiterSearch, matchScore, pickerRowToToken, POPULAR_TOKENS, shortMint, type PickerRow } from "./token-picker.ts";
import { holdingKeyFor, setCustomTokens, tokenByMint, tokenLookup, walletTokens } from "./tokens.ts";

const BONK = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
const FAKE = "hqYtLoxviwGENvogcJ5324YTbYqW5H9LHtmQu5Jbonk";

function row(partial: Partial<PickerRow> & { mint: string; symbol: string }): PickerRow {
  return { name: partial.symbol, decimals: 6, icon: null, verified: true, priceUsd: 1, key: partial.symbol, held: 0, heldUsd: 0, disabled: false, ...partial };
}

describe("mapJupiterSearch", () => {
  it("maps id/symbol/icon/decimals and verification", () => {
    const tokens = mapJupiterSearch([
      { id: BONK, name: "Bonk", symbol: "Bonk", icon: "https://x/bonk.webp", decimals: 5, isVerified: true, tags: ["verified"], usdPrice: 0.0000022 },
      { id: FAKE, name: "BONKAI", symbol: "BONKAI", icon: "http://insecure", decimals: 6, isVerified: null, tags: ["unknown", "token-2022"] },
      { id: BONK, symbol: "dupe", decimals: 5 },
      { id: "x", symbol: "", decimals: 6 },
      { id: "y", symbol: "Y" },
    ]);
    assert.equal(tokens.length, 2);
    assert.deepEqual(tokens[0], { mint: BONK, symbol: "Bonk", name: "Bonk", decimals: 5, icon: "https://x/bonk.webp", verified: true, priceUsd: 0.0000022, token2022: false });
    assert.equal(tokens[1]!.verified, false);
    assert.equal(tokens[1]!.icon, null, "non-https icons are dropped");
    assert.equal(tokens[1]!.token2022, true);
    assert.deepEqual(mapJupiterSearch({ error: 1 }), []);
  });
  it("caps results", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `mint${i}`, symbol: `T${i}`, decimals: 6 }));
    assert.equal(mapJupiterSearch(many).length, 20);
  });
});

describe("picker ordering", () => {
  const held = [
    row({ mint: "SOLmint", symbol: "SOL", name: "Solana", held: 2, heldUsd: 300 }),
    row({ mint: "USDCmint", symbol: "USDC", name: "USD Coin", held: 1000, heldUsd: 1000 }),
    row({ mint: BONK, symbol: "BONK", name: "Bonk", held: 10, heldUsd: 0.1 }),
    row({ mint: "EMPTY", symbol: "SAMO", held: 0 }),
  ];
  const byMint = (mint: string) => held.find((item) => item.mint === mint) ?? null;

  it("lists held tokens by USD value with no query", () => {
    const { yours, results } = buildPickerRows({ side: "in", query: "", held, results: [], walletByMint: byMint });
    assert.deepEqual(yours.map((item) => item.symbol), ["USDC", "SOL", "BONK"]);
    assert.equal(results.length, 0);
  });

  it("puts exact matches first and dedupes search hits already held", () => {
    const hits = [
      { mint: BONK, symbol: "Bonk", name: "Bonk", decimals: 5, icon: "https://i", verified: true, priceUsd: 1 },
      { mint: FAKE, symbol: "BONKAI", name: "BONKAI", decimals: 6, icon: null, verified: false, priceUsd: null },
    ];
    const pay = buildPickerRows({ side: "in", query: "bonk", held, results: hits, walletByMint: byMint });
    assert.deepEqual(pay.yours.map((item) => item.symbol), ["BONK"]);
    assert.deepEqual(pay.results.map((item) => item.symbol), ["BONKAI"]);
    assert.equal(pay.results[0]!.disabled, true, "pay side cannot use tokens it does not hold");
    const receive = buildPickerRows({ side: "out", query: "bonk", held, results: hits, walletByMint: byMint });
    assert.equal(receive.results[0]!.disabled, false);
  });

  it("matches a pasted mint", () => {
    assert.equal(matchScore({ symbol: "BONK", name: "Bonk", mint: BONK }, BONK), 0);
    assert.equal(matchScore({ symbol: "$WIF", name: "dogwifhat", mint: "m" }, "wif"), 0);
    assert.equal(matchScore({ symbol: "SOL", name: "Solana", mint: "m" }, "usdc"), -1);
  });

  it("has the popular chips with xStocks", () => {
    const symbols = POPULAR_TOKENS.map((item) => item.symbol);
    for (const symbol of ["SOL", "USDC", "USDT", "JUP", "BONK", "WIF", "JTO"]) assert.ok(symbols.includes(symbol), symbol);
    assert.ok(symbols.some((symbol) => symbol.endsWith("x")));
    assert.equal(shortMint(BONK), "DezX…B263");
  });
});

describe("runtime tokens", () => {
  it("registers arbitrary mints without shadowing known symbols", () => {
    assert.equal(holdingKeyFor("USDC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), "USDC");
    assert.equal(holdingKeyFor("USDC", FAKE), "USDC-hqYt");
    assert.equal(holdingKeyFor("JTO", "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"), "JTO");
    const token = pickerRowToToken(row({ mint: FAKE, symbol: "USDC", key: null, verified: false, icon: "https://i" }), tokenLookup);
    assert.equal(token.symbol, "USDC-hqYt");
    assert.equal(token.verified, false);
    setCustomTokens([{ ...token, priceUsd: 0.5 }, { ...token, symbol: "SOL" }]);
    assert.equal(tokenLookup("USDC-hqYt")?.mint, FAKE);
    assert.equal(tokenLookup("SOL")?.mint, "So11111111111111111111111111111111111111112", "known symbols win");
    assert.equal(tokenByMint(FAKE)?.symbol, "USDC-hqYt");
    assert.ok(walletTokens().some((item) => item.symbol === "USDC-hqYt"));
    setCustomTokens([]);
    assert.equal(tokenLookup("USDC-hqYt"), null);
  });
});
