import { EXPLORE_DAPPS, PERP_VENUES, type ExploreDappCatalogItem } from "@/lib/vela/explore-dapps";
import type { Category } from "@/lib/vela/dapps";

export type ExploreDappRow = {
  id: string;
  name: string;
  category: Category;
  url: string;
  logo: string | null;
  blurb: string;
  tvlUsd: number | null;
  tvlChange24hPct: number | null;
  volume24hUsd: number | null;
  volumeChange24hPct: number | null;
};

export type ExplorePairRow = {
  id: string;
  name: string;
  dex: string;
  baseSymbol: string;
  baseName: string;
  baseMint: string;
  baseDecimals: number;
  quoteSymbol: string;
  priceUsd: number;
  change24hPct: number | null;
  volume24hUsd: number;
  liquidityUsd: number | null;
  logo: string | null;
  pairUrl: string;
  trending: boolean;
};

export type ExploreDexVenue = {
  id: string;
  name: string;
  logo: string | null;
  url: string;
  volume24hUsd: number;
  volumeChange24hPct: number | null;
};

export type ExplorePerpMarket = {
  id: string;
  venue: string;
  symbol: string;
  baseSymbol: string;
  markPrice: number;
  change24hPct: number | null;
  volume24hUsd: number | null;
  fundingRatePct: number | null;
  fundingLabel: "Funding" | "Borrow";
  openInterestUsd: number | null;
  tradeUrl: string;
  logo: string | null;
};

export type ExplorePerpVenue = {
  id: string;
  name: string;
  url: string;
  logo: string | null;
  volume24hUsd: number | null;
  tvlUsd: number | null;
  tvlChange24hPct: number | null;
};

export type ExploreSnapshot = {
  updatedAt: number;
  live: boolean;
  sources: string[];
  fallbacks: string[];
  dapps: ExploreDappRow[];
  pairs: ExplorePairRow[];
  dexVenues: ExploreDexVenue[];
  perpMarkets: ExplorePerpMarket[];
  perpVenues: ExplorePerpVenue[];
};

export function catalogDappRow(item: ExploreDappCatalogItem): ExploreDappRow {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    url: item.url,
    logo: item.logo,
    blurb: item.blurb,
    tvlUsd: null,
    tvlChange24hPct: null,
    volume24hUsd: null,
    volumeChange24hPct: null,
  };
}

export function fallbackExploreSnapshot(at = Date.now()): ExploreSnapshot {
  return {
    updatedAt: at,
    live: false,
    sources: [],
    fallbacks: ["defillama-protocols", "defillama-dexs", "geckoterminal", "jupiter-perps"],
    dapps: EXPLORE_DAPPS.map(catalogDappRow),
    pairs: [],
    dexVenues: [],
    perpMarkets: [],
    perpVenues: PERP_VENUES.map((venue) => ({
      id: venue.id,
      name: venue.name,
      url: venue.url,
      logo: venue.logo,
      volume24hUsd: null,
      tvlUsd: null,
      tvlChange24hPct: null,
    })),
  };
}

export function dappRankScore(row: ExploreDappRow): number {
  return (row.volume24hUsd ?? 0) + (row.tvlUsd ?? 0);
}

export function rankExploreDapps(rows: ExploreDappRow[]): ExploreDappRow[] {
  const order = new Map(EXPLORE_DAPPS.map((item, index) => [item.id, index]));
  return [...rows].sort((a, b) => {
    const delta = dappRankScore(b) - dappRankScore(a);
    if (delta !== 0) return delta;
    return (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99);
  });
}

export function isExploreSnapshot(value: unknown): value is ExploreSnapshot {
  if (!value || typeof value !== "object") return false;
  const body = value as ExploreSnapshot;
  return Array.isArray(body.dapps) && Array.isArray(body.pairs) && typeof body.updatedAt === "number";
}
