import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMintList, TICKER_COINS } from "@/lib/vela/market-tickers";
import {
  addSocial,
  buyRatio,
  formatAge,
  mergeFeed,
  parseDexPairs,
  parseDexProfiles,
  parseGeckoNewPools,
  parseMintSafety,
} from "@/lib/vela/memecoins";

const MINT_A = "8DMBwTqebhHT8mm1dnw29LPWmg5ZtbDknSLgNGzw5Quz";
const MINT_B = "FbCZyqqSyyEVPchMtiju1CEQGX86LQM7arBeoXDjGdf3";
const WSOL = "So11111111111111111111111111111111111111112";

const gecko = {
  data: [
    {
      id: "solana_pool1",
      type: "pool",
      attributes: {
        name: "FINU / SOL",
        pool_created_at: "2026-11-26T20:28:07Z",
        fdv_usd: "2018.86",
        market_cap_usd: null,
        reserve_in_usd: "1601.1",
        base_token_price_usd: "0.000002",
        volume_usd: { m5: "22.38", h24: "22.38" },
        transactions: { h24: { buys: 2, sells: 0 } },
      },
      relationships: {
        base_token: { data: { id: `solana_${MINT_A}`, type: "token" } },
        quote_token: { data: { id: `solana_${WSOL}`, type: "token" } },
        dex: { data: { id: "pump-fun", type: "dex" } },
      },
    },
    {
      id: "solana_pool2",
      type: "pool",
      attributes: { name: "SOL / X", pool_created_at: "2026-11-26T20:20:00Z" },
      relationships: { base_token: { data: { id: `solana_${WSOL}`, type: "token" } } },
    },
  ],
  included: [
    {
      id: `solana_${MINT_A}`,
      type: "token",
      attributes: { address: MINT_A, name: "Fat INU", symbol: "FINU", decimals: 6, image_url: "https://assets.example/finu.png" },
    },
  ],
};

describe("memecoin feed parsing", () => {
  it("maps GeckoTerminal new pools and skips quote-token bases", () => {
    const coins = parseGeckoNewPools(gecko);
    assert.equal(coins.length, 1);
    const coin = coins[0]!;
    assert.equal(coin.mint, MINT_A);
    assert.equal(coin.symbol, "FINU");
    assert.equal(coin.decimals, 6);
    assert.equal(coin.marketCapKind, "fdv");
    assert.equal(coin.marketCapUsd, 2018.86);
    assert.equal(coin.liquidityUsd, 1601.1);
    assert.equal(coin.buys24h, 2);
    assert.equal(coin.sells24h, 0);
    assert.equal(coin.createdAt, Date.parse("2026-11-26T20:28:07Z"));
    assert.equal(coin.dex, "pump-fun");
    assert.equal(coin.dexUrl, `https://dexscreener.com/solana/${MINT_A}`);
  });

  it("returns nothing for junk", () => {
    assert.deepEqual(parseGeckoNewPools(null), []);
    assert.deepEqual(parseDexProfiles({}), []);
    assert.equal(parseDexPairs("nope").size, 0);
  });

  it("classifies social links", () => {
    let s = addSocial({ x: null, telegram: null, discord: null, website: null }, { type: "twitter", url: "https://x.com/a" });
    s = addSocial(s, { label: "Website", url: "https://coin.example" });
    s = addSocial(s, { url: "https://t.me/coin" });
    s = addSocial(s, { type: "twitter", url: "javascript:alert(1)" });
    assert.equal(s.x, "https://x.com/a");
    assert.equal(s.website, "https://coin.example/");
    assert.equal(s.telegram, "https://t.me/coin");
  });

  it("keeps the most liquid DexScreener pair and merges socials, newest first", () => {
    const pairs = parseDexPairs([
      { chainId: "solana", baseToken: { address: MINT_A, symbol: "FINU" }, liquidity: { usd: 10 }, marketCap: 5000 },
      {
        chainId: "solana",
        baseToken: { address: MINT_A, symbol: "FINU" },
        liquidity: { usd: 900 },
        marketCap: 2100,
        info: { socials: [{ type: "telegram", url: "https://t.me/finu" }] },
      },
      {
        chainId: "solana",
        baseToken: { address: MINT_B, symbol: "ZCAT", name: "Zolana" },
        liquidity: { usd: 33488 },
        marketCap: 16797,
        pairCreatedAt: Date.parse("2026-11-26T19:00:00Z"),
        txns: { h24: { buys: 30, sells: 15 } },
      },
    ]);
    assert.equal(pairs.get(MINT_A)?.liquidityUsd, 900);
    const profiles = parseDexProfiles([
      { chainId: "solana", tokenAddress: MINT_B, icon: "https://cdn.example/z.png", links: [{ type: "twitter", url: "https://x.com/z" }] },
      { chainId: "base", tokenAddress: "0xabc" },
      { chainId: "solana", tokenAddress: "NoPairYet1111111111111111111111111111111111" },
    ]);
    const feed = mergeFeed(parseGeckoNewPools(gecko), profiles, pairs);
    assert.deepEqual(
      feed.map((coin) => coin.mint),
      [MINT_A, MINT_B],
    );
    assert.equal(feed[0]!.socials.telegram, "https://t.me/finu");
    assert.equal(feed[0]!.liquidityUsd, 1601.1, "GeckoTerminal numbers win");
    assert.equal(feed[1]!.socials.x, "https://x.com/z");
    assert.equal(feed[1]!.image, "https://cdn.example/z.png");
    assert.equal(feed[1]!.marketCapKind, "mc");
  });
});

describe("mint safety", () => {
  it("reads revoked authorities", () => {
    const safety = parseMintSafety({
      data: { parsed: { type: "mint", info: { mintAuthority: null, freezeAuthority: null, extensions: [{ extension: "metadataPointer" }] } } },
    });
    assert.deepEqual(safety, { mintRevoked: true, freezeRevoked: true, riskyExtensions: [] });
  });

  it("flags live authorities and risky Token-2022 extensions", () => {
    const safety = parseMintSafety({
      data: {
        parsed: {
          type: "mint",
          info: {
            mintAuthority: "Auth1111111111111111111111111111111111111111",
            freezeAuthority: "Auth1111111111111111111111111111111111111111",
            extensions: [
              { extension: "permanentDelegate", state: { delegate: "Del1111111111111111111111111111111111111111" } },
              { extension: "transferFeeConfig", state: { newerTransferFee: { transferFeeBasisPoints: 0 }, olderTransferFee: { transferFeeBasisPoints: 0 } } },
              { extension: "transferHook", state: { programId: null } },
            ],
          },
        },
      },
    });
    assert.deepEqual(safety, { mintRevoked: false, freezeRevoked: false, riskyExtensions: ["Permanent delegate"] });
  });

  it("returns null for non-mint accounts", () => {
    assert.equal(parseMintSafety(null), null);
    assert.equal(parseMintSafety({ data: { parsed: { type: "account", info: {} } } }), null);
  });
});

describe("formatting", () => {
  it("formats ages", () => {
    assert.equal(formatAge(-5), "0s");
    assert.equal(formatAge(52_000), "52s");
    assert.equal(formatAge((14 * 60 + 52) * 1000), "14m 52s");
    assert.equal(formatAge((3 * 3600 + 5 * 60) * 1000), "3h 05m");
    assert.equal(formatAge((2 * 86400 + 4 * 3600) * 1000), "2d 4h");
  });

  it("computes buy ratio", () => {
    assert.equal(buyRatio(30, 10), 0.75);
    assert.equal(buyRatio(0, 0), null);
    assert.equal(buyRatio(null, 4), 0);
  });

  it("parses mint lists and keeps ticker mints unique", () => {
    assert.deepEqual(parseMintList(" a, b ,a,,c", 2), ["a", "b"]);
    assert.deepEqual(parseMintList(null), []);
    assert.equal(new Set(TICKER_COINS.map((coin) => coin.mint)).size, TICKER_COINS.length);
  });
});
