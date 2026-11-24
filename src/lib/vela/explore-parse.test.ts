import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXPLORE_DAPPS } from "@/lib/vela/explore-dapps";
import { formatCompactUsd } from "@/lib/vela/format";
import {
  annotateExploreDapps,
  buildPerpVenues,
  dexVenuesFromVolumes,
  jupiterPerpMarkets,
  mergeExplorePairs,
  parseDriftMarkets,
  parseGeckoTerminalPools,
  parseJupiterOpenInterest,
  parseLlamaDexOverview,
  parseLlamaLiteProtocols,
} from "@/lib/vela/explore-parse";

describe("explore parsers", () => {
  it("formats compact USD amounts", () => {
    assert.equal(formatCompactUsd(123.45), "$123.45");
    assert.equal(formatCompactUsd(12_400), "$12.4K");
    assert.equal(formatCompactUsd(269_984_695), "$270M");
    assert.equal(formatCompactUsd(1_250_000_000), "$1.25B");
  });

  it("sums Solana TVL and 24h change from the lite protocols payload", () => {
    const points = parseLlamaLiteProtocols({
      protocols: [
        {
          name: "Orca DEX",
          tvl: 248_000_000,
          tvlPrevDay: 246_000_000,
          chains: ["Solana"],
          chainTvls: { Solana: { tvl: 248_000_000, tvlPrevDay: 246_000_000 } },
        },
        {
          name: "Meteora DLMM",
          tvl: 100_000_000,
          tvlPrevDay: 110_000_000,
          chains: ["Solana"],
          chainTvls: { Solana: { tvl: 100_000_000, tvlPrevDay: 110_000_000 } },
        },
        {
          name: "Meteora DAMM V2",
          tvl: 20_000_000,
          tvlPrevDay: 20_000_000,
          chains: ["Solana"],
          chainTvls: { Solana: { tvl: 20_000_000, tvlPrevDay: 20_000_000 } },
        },
        {
          name: "Orca DEX",
          tvl: 9,
          chains: ["Ethereum"],
          chainTvls: { Ethereum: { tvl: 9, tvlPrevDay: 8 } },
        },
      ],
    });
    const orca = EXPLORE_DAPPS.find((item) => item.id === "orca")!;
    const meteora = EXPLORE_DAPPS.find((item) => item.id === "meteora")!;
    const rows = annotateExploreDapps(
      [orca, meteora],
      points,
      [],
    );
    const orcaRow = rows.find((row) => row.id === "orca")!;
    const meteoraRow = rows.find((row) => row.id === "meteora")!;
    assert.equal(orcaRow.tvlUsd, 248_000_000);
    assert.ok(Math.abs((orcaRow.tvlChange24hPct ?? 0) - ((248 - 246) / 246) * 100) < 1e-9);
    assert.equal(meteoraRow.tvlUsd, 120_000_000);
    assert.ok(Math.abs((meteoraRow.tvlChange24hPct ?? 0) - ((120 - 130) / 130) * 100) < 1e-9);
  });

  it("ranks dapps by volume plus TVL and builds a DEX volume leaderboard", () => {
    const volumes = parseLlamaDexOverview({
      protocols: [
        { slug: "orca-dex", displayName: "Orca DEX", total24h: 270_000_000, change_1d: 10, logo: "https://example.com/o.png" },
        { slug: "raydium-amm", displayName: "Raydium AMM", total24h: 200_000_000, change_1d: -5, logo: "https://example.com/r.png" },
        { slug: "serum", displayName: "Serum", total24h: null },
      ],
    });
    const rows = annotateExploreDapps(
      EXPLORE_DAPPS.filter((item) => item.id === "orca" || item.id === "raydium" || item.id === "tensor"),
      new Map(),
      volumes,
    );
    assert.deepEqual(rows.map((row) => row.id), ["orca", "raydium", "tensor"]);
    assert.equal(rows[0]?.volume24hUsd, 270_000_000);
    const venues = dexVenuesFromVolumes(volumes, 5);
    assert.equal(venues[0]?.id, "orca-dex");
    assert.equal(venues[0]?.url, "https://www.orca.so");
    assert.equal(venues.length, 2);
  });

  it("parses GeckoTerminal pools and merges trending with volume leaders", () => {
    const body = {
      data: [
        {
          attributes: {
            address: "pair-sol-usdc",
            name: "SOL / USDC",
            base_token_price_usd: "71.25",
            reserve_in_usd: "17000000",
            volume_usd: { h24: "110000000" },
            price_change_percentage: { h24: "0.42" },
          },
          relationships: {
            base_token: { data: { id: "solana_So111", type: "token" } },
            quote_token: { data: { id: "solana_USDC", type: "token" } },
            dex: { data: { id: "orca", type: "dex" } },
          },
        },
      ],
      included: [
        {
          id: "solana_So111",
          type: "token",
          attributes: {
            address: "So11111111111111111111111111111111111111112",
            name: "Wrapped SOL",
            symbol: "SOL",
            decimals: 9,
            image_url: "https://example.com/sol.png",
          },
        },
        {
          id: "solana_USDC",
          type: "token",
          attributes: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin", decimals: 6 },
        },
        { id: "orca", type: "dex", attributes: { name: "Orca" } },
      ],
    };
    const trending = parseGeckoTerminalPools(
      {
        ...body,
        data: [
          {
            ...body.data[0],
            attributes: { ...body.data[0].attributes, address: "pair-fiona", name: "FIONA / SOL", base_token_price_usd: "0.003", volume_usd: { h24: "4000000" } },
            relationships: {
              base_token: { data: { id: "solana_fiona", type: "token" } },
              quote_token: { data: { id: "solana_So111", type: "token" } },
              dex: { data: { id: "pumpswap", type: "dex" } },
            },
          },
        ],
        included: [
          ...body.included,
          {
            id: "solana_fiona",
            type: "token",
            attributes: { address: "FionaMint111111111111111111111111111111111", symbol: "FIONA", name: "Fiona", decimals: 6, image_url: "https://example.com/f.png" },
          },
          { id: "pumpswap", type: "dex", attributes: { name: "PumpSwap" } },
        ],
      },
      true,
    );
    const volume = parseGeckoTerminalPools(body, false);
    assert.equal(volume[0]?.baseSymbol, "SOL");
    assert.equal(volume[0]?.priceUsd, 71.25);
    assert.equal(volume[0]?.pairUrl, "https://www.geckoterminal.com/solana/pools/pair-sol-usdc");
    const merged = mergeExplorePairs(trending, volume, 10);
    assert.equal(merged[0]?.id, "pair-sol-usdc");
    assert.equal(merged[0]?.trending, false);
    assert.equal(merged[1]?.id, "pair-fiona");
    assert.equal(merged[1]?.trending, true);
  });

  it("builds Jupiter perp markets from stats, borrow rates, and JLP open interest", () => {
    const solMint = "So11111111111111111111111111111111111111112";
    const markets = jupiterPerpMarkets(
      { [solMint]: { price: "71.5", priceChange24H: "0.44", volume: "282000000" } },
      { [solMint]: { longBorrowRatePercent: "0.0015", shortBorrowRatePercent: "0.0007" } },
      {
        custodies: [
          { symbol: "SOL", guaranteedUsd: "24327905914212", globalShortSizes: "7025753030325" },
        ],
      },
    );
    assert.equal(markets.length, 1);
    assert.equal(markets[0]?.symbol, "SOL-PERP");
    assert.equal(markets[0]?.markPrice, 71.5);
    assert.equal(markets[0]?.fundingLabel, "Borrow");
    assert.equal(markets[0]?.fundingRatePct, 0.0015);
    assert.ok(Math.abs((markets[0]?.openInterestUsd ?? 0) - (24327905914212 + 7025753030325) / 1e6) < 1e-6);
    assert.equal(markets[0]?.tradeUrl, "https://jup.ag/perps/long/SOL-SOL");
    assert.equal(parseJupiterOpenInterest({ custodies: [] }, "SOL"), null);
  });

  it("parses a Drift-style market list when one is available", () => {
    const rows = parseDriftMarkets({
      markets: [
        { symbol: "SOL-PERP", markPrice: 71.4, priceChange24h: 0.5, volume24h: 1_000_000, fundingRate: 0.01, openInterest: 50_000_000 },
        { symbol: "SPOT-SOL", markPrice: 71.4 },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.venue, "Drift");
    assert.equal(rows[0]?.tradeUrl, "https://app.drift.trade/trade/SOL-PERP");
    assert.equal(rows[0]?.openInterestUsd, 50_000_000);
  });

  it("annotates perp venues with Jupiter volume and DefiLlama TVL", () => {
    const venues = buildPerpVenues(
      new Map([
        ["Jupiter Perpetual Exchange", { name: "Jupiter Perpetual Exchange", tvlUsd: 500_000_000, tvlPrevDay: 490_000_000, change1dPct: null, logo: null }],
        ["Drift Trade", { name: "Drift Trade", tvlUsd: 540_000, tvlPrevDay: 600_000, change1dPct: null, logo: null }],
      ]),
      282_000_000,
    );
    assert.equal(venues[0]?.id, "jupiter-perps");
    assert.equal(venues[0]?.volume24hUsd, 282_000_000);
    assert.equal(venues.find((row) => row.id === "drift")?.tvlUsd, 540_000);
  });
});
