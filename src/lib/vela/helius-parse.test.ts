import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAssetBatch, parseAssetsByOwner, parseJupiterPrices } from "./helius-parse.ts";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL = "So11111111111111111111111111111111111111112";

const ownerRpc = {
  result: {
    items: [
      {
        id: USDC,
        interface: "FungibleToken",
        content: {
          metadata: { name: "USD Coin", symbol: "USDC" },
          links: { image: "https://example.com/usdc.png" },
        },
        token_info: {
          symbol: "USDC",
          balance: 1_500_000,
          decimals: 6,
          price_info: { price_per_token: 1, total_price: 1.5 },
        },
      },
      {
        id: WSOL,
        interface: "FungibleToken",
        content: { metadata: { name: "Wrapped SOL", symbol: "SOL" } },
        token_info: { symbol: "SOL", balance: 1_000_000_000, decimals: 9, price_info: { price_per_token: 150 } },
      },
      {
        id: "NftMint11111111111111111111111111111111111",
        interface: "V1_NFT",
        content: {
          metadata: { name: "Harbor Light #7" },
          links: { image: "https://example.com/nft.png" },
        },
        grouping: [{ group_key: "collection", collection_metadata: { name: "Harbor" } }],
      },
    ],
    nativeBalance: { lamports: 2_000_000_000, price_per_sol: 150 },
  },
};

describe("parseAssetsByOwner", () => {
  it("reads SOL, fungible tokens, USD, logos, and NFT images", () => {
    const wallet = parseAssetsByOwner("Owner1111111111111111111111111111111111111", ownerRpc);
    assert.equal(wallet.sol.amount, 2);
    assert.equal(wallet.sol.priceUsd, 150);
    assert.equal(wallet.sol.valueUsd, 300);
    assert.equal(wallet.tokens.length, 1);
    assert.equal(wallet.tokens[0]?.symbol, "USDC");
    assert.equal(wallet.tokens[0]?.amount, 1.5);
    assert.equal(wallet.tokens[0]?.image, "https://example.com/usdc.png");
    assert.equal(wallet.nfts.length, 1);
    assert.equal(wallet.nfts[0]?.name, "Harbor Light #7");
    assert.equal(wallet.nfts[0]?.collection, "Harbor");
    assert.equal(wallet.nfts[0]?.image, "https://example.com/nft.png");
    assert.equal(wallet.totalUsd, 301.5);
  });
});

describe("parseAssetBatch", () => {
  it("extracts price_info and images from a DAS batch", () => {
    const quotes = parseAssetBatch({
      result: [
        {
          id: WSOL,
          interface: "FungibleToken",
          content: { links: { image: "https://example.com/sol.png" }, metadata: { name: "Solana", symbol: "SOL" } },
          token_info: { symbol: "SOL", decimals: 9, price_info: { price_per_token: 148.25 } },
        },
      ],
    });
    assert.equal(quotes[0]?.mint, WSOL);
    assert.equal(quotes[0]?.priceUsd, 148.25);
    assert.equal(quotes[0]?.image, "https://example.com/sol.png");
  });
});

describe("parseJupiterPrices", () => {
  it("reads v3 mint maps and v2 data maps", () => {
    const v3 = parseJupiterPrices({
      [WSOL]: { usdPrice: 149.5, priceChange24h: -1.25 },
    });
    assert.equal(v3[0]?.mint, WSOL);
    assert.equal(v3[0]?.priceUsd, 149.5);
    assert.equal(v3[0]?.change24hPct, -1.25);

    const v2 = parseJupiterPrices({
      data: { [USDC]: { price: "1.001", extraInfo: { priceChange24h: 0.02 } } },
    });
    assert.equal(v2[0]?.mint, USDC);
    assert.equal(v2[0]?.priceUsd, 1.001);
    assert.equal(v2[0]?.change24hPct, 0.02);
  });
});
