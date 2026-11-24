import { EXPLORE_DAPPS } from "@/lib/vela/explore-dapps";
import { fallbackExploreSnapshot, type ExploreSnapshot } from "@/lib/vela/explore";
import {
  annotateExploreDapps,
  buildPerpVenues,
  dexVenuesFromVolumes,
  jupiterPerpMarkets,
  mergeExplorePairs,
  parseDriftMarkets,
  parseGeckoTerminalPools,
  parseLlamaDexOverview,
  parseLlamaLiteProtocols,
} from "@/lib/vela/explore-parse";
import { JUPITER_PERP_MARKETS } from "@/lib/vela/explore-dapps";

const CACHE_TTL_MS = 30_000;
const LLAMA_LITE = "https://api.llama.fi/lite/protocols2";
const LLAMA_DEXS =
  "https://api.llama.fi/overview/dexs/solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
const GECKO_TRENDING =
  "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?include=base_token,quote_token,dex";
const GECKO_VOLUME =
  "https://api.geckoterminal.com/api/v2/networks/solana/pools?page=1&include=base_token,quote_token,dex&sort=h24_volume_usd_desc";
const JUP_STATS = "https://perps-api.jup.ag/v1/market-stats";
const JUP_POOL = "https://perps-api.jup.ag/v1/pool-info";
const JUP_JLP = "https://perps-api.jup.ag/v1/jlp-info";
const DRIFT_URLS = [
  "https://data.api.drift.trade/stats/markets",
  "https://data.api.drift.trade/marketStats",
  "https://dlob.drift.trade/stats/markets",
];

type CacheEntry = { at: number; value: ExploreSnapshot };
let cache: CacheEntry | null = null;

export function clearExploreCaches() {
  cache = null;
}

async function getJson(url: string, timeoutMs = 12_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "SolPortal/1.0 (explore)" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

async function loadDriftMarkets(): Promise<unknown | null> {
  for (const url of DRIFT_URLS) {
    const body = await settled(getJson(url, 6_000));
    if (body) return body;
  }
  return null;
}

export async function loadExploreSnapshot(): Promise<ExploreSnapshot> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value;

  const sources: string[] = [];
  const fallbacks: string[] = [];

  const [lite, dexs, trending, volume, jlp, drift] = await Promise.all([
    settled(getJson(LLAMA_LITE, 18_000)),
    settled(getJson(LLAMA_DEXS, 12_000)),
    settled(getJson(GECKO_TRENDING, 10_000)),
    settled(getJson(GECKO_VOLUME, 10_000)),
    settled(getJson(JUP_JLP, 8_000)),
    loadDriftMarkets(),
  ]);

  const tvlPoints = lite ? parseLlamaLiteProtocols(lite) : new Map();
  if (lite) sources.push("defillama-protocols");
  else fallbacks.push("defillama-protocols");

  const volumes = dexs ? parseLlamaDexOverview(dexs) : [];
  if (dexs) sources.push("defillama-dexs");
  else fallbacks.push("defillama-dexs");

  const dapps = annotateExploreDapps(EXPLORE_DAPPS, tvlPoints, volumes);
  const dexVenues = dexVenuesFromVolumes(volumes);
  const trendingPairs = trending ? parseGeckoTerminalPools(trending, true) : [];
  const volumePairs = volume ? parseGeckoTerminalPools(volume, false) : [];
  if (trending || volume) sources.push("geckoterminal");
  else fallbacks.push("geckoterminal");
  const pairs = mergeExplorePairs(trendingPairs, volumePairs);

  const statsByMint: Record<string, unknown> = {};
  const poolByMint: Record<string, unknown> = {};
  const jupResults = await Promise.all(
    JUPITER_PERP_MARKETS.map(async (market) => {
      const [stats, pool] = await Promise.all([
        settled(getJson(`${JUP_STATS}?mint=${market.mint}`, 8_000)),
        settled(getJson(`${JUP_POOL}?mint=${market.mint}`, 8_000)),
      ]);
      return { mint: market.mint, stats, pool };
    }),
  );
  for (const row of jupResults) {
    if (row.stats) statsByMint[row.mint] = row.stats;
    if (row.pool) poolByMint[row.mint] = row.pool;
  }
  const jupMarkets = jupiterPerpMarkets(statsByMint, poolByMint, jlp);
  if (jupMarkets.length) sources.push("jupiter-perps");
  else fallbacks.push("jupiter-perps");

  const driftMarkets = drift ? parseDriftMarkets(drift) : [];
  if (driftMarkets.length) sources.push("drift");
  else fallbacks.push("drift");

  const perpMarkets = [...jupMarkets, ...driftMarkets].sort(
    (a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0),
  );
  const jupiterVolume = jupMarkets.reduce((sum, row) => sum + (row.volume24hUsd ?? 0), 0);
  const perpVenues = buildPerpVenues(tvlPoints, jupMarkets.length ? jupiterVolume : null);

  const snapshot: ExploreSnapshot = {
    updatedAt: now,
    live: sources.length > 0,
    sources,
    fallbacks,
    dapps,
    pairs,
    dexVenues,
    perpMarkets,
    perpVenues,
  };

  cache = { at: now, value: snapshot };
  return snapshot;
}

export { fallbackExploreSnapshot };
