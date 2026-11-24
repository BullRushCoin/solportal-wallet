import {
  PERP_VENUES,
  JUPITER_PERP_MARKETS,
  WSOL_MINT,
  type ExploreDappCatalogItem,
} from "@/lib/vela/explore-dapps";
import {
  catalogDappRow,
  rankExploreDapps,
  type ExploreDappRow,
  type ExploreDexVenue,
  type ExplorePairRow,
  type ExplorePerpMarket,
  type ExplorePerpVenue,
} from "@/lib/vela/explore";

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function solanaTvl(protocol: Record<string, unknown>): { tvl: number | null; prevDay: number | null } {
  const chainTvls = obj(protocol.chainTvls);
  const sol = chainTvls ? obj(chainTvls.Solana) ?? (typeof chainTvls.Solana === "number" ? { tvl: chainTvls.Solana } : null) : null;
  if (sol) {
    const tvl = num(sol.tvl) ?? (typeof chainTvls?.Solana === "number" ? num(chainTvls.Solana) : null);
    return { tvl, prevDay: num(sol.tvlPrevDay) };
  }
  const chains = protocol.chains;
  const onSolana = Array.isArray(chains) && chains.some((item) => String(item).toLowerCase() === "solana");
  if (onSolana || !chains) {
    return { tvl: num(protocol.tvl), prevDay: num(protocol.tvlPrevDay) };
  }
  return { tvl: null, prevDay: null };
}

function changePct(current: number | null, previous: number | null, explicit?: number | null): number | null {
  if (explicit !== null && explicit !== undefined && Number.isFinite(explicit)) return explicit;
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type LlamaTvlPoint = {
  name: string;
  tvlUsd: number | null;
  tvlPrevDay: number | null;
  change1dPct: number | null;
  logo: string | null;
};

export function parseLlamaLiteProtocols(body: unknown): Map<string, LlamaTvlPoint> {
  const root = obj(body);
  const list = Array.isArray(body) ? body : root && Array.isArray(root.protocols) ? root.protocols : [];
  const map = new Map<string, LlamaTvlPoint>();
  for (const row of list) {
    const item = obj(row);
    if (!item) continue;
    const name = text(item.name);
    if (!name) continue;
    const { tvl, prevDay } = solanaTvl(item);
    const next: LlamaTvlPoint = {
      name,
      tvlUsd: tvl,
      tvlPrevDay: prevDay,
      change1dPct: changePct(tvl, prevDay, num(item.change_1d)),
      logo: text(item.logo),
    };
    const prev = map.get(name);
    if (!prev || (prev.tvlUsd === null && next.tvlUsd !== null)) map.set(name, next);
  }
  return map;
}

function sumNamedTvl(points: Map<string, LlamaTvlPoint>, names: string[]): { tvl: number | null; change: number | null } {
  let tvl = 0;
  let prev = 0;
  let has = false;
  let hasPrev = false;
  const changes: number[] = [];
  for (const name of names) {
    const point = points.get(name);
    if (!point || point.tvlUsd === null) continue;
    has = true;
    tvl += point.tvlUsd;
    if (point.tvlPrevDay !== null) {
      hasPrev = true;
      prev += point.tvlPrevDay;
    }
    if (point.change1dPct !== null) changes.push(point.change1dPct);
  }
  if (!has) return { tvl: null, change: null };
  if (hasPrev) return { tvl, change: changePct(tvl, prev) };
  if (changes.length === 1) return { tvl, change: changes[0] };
  return { tvl, change: null };
}

export type LlamaVolumePoint = {
  slug: string;
  name: string;
  volume24hUsd: number | null;
  volumeChange24hPct: number | null;
  logo: string | null;
  url: string | null;
};

export function parseLlamaDexOverview(body: unknown): LlamaVolumePoint[] {
  const root = obj(body);
  const list = root && Array.isArray(root.protocols) ? root.protocols : [];
  const rows: LlamaVolumePoint[] = [];
  for (const row of list) {
    const item = obj(row);
    if (!item) continue;
    const slug = text(item.slug) ?? text(item.module);
    if (!slug) continue;
    rows.push({
      slug,
      name: text(item.displayName) ?? text(item.name) ?? slug,
      volume24hUsd: num(item.total24h),
      volumeChange24hPct: num(item.change_1d),
      logo: text(item.logo),
      url: text(item.url),
    });
  }
  return rows;
}

export function annotateExploreDapps(
  catalog: ExploreDappCatalogItem[],
  tvlPoints: Map<string, LlamaTvlPoint>,
  volumes: LlamaVolumePoint[],
): ExploreDappRow[] {
  const bySlug = new Map(volumes.map((item) => [item.slug, item]));
  const rows = catalog.map((item) => {
    const base = catalogDappRow(item);
    const tvl = sumNamedTvl(tvlPoints, item.llamaNames);
    let volume: number | null = null;
    let volumeChange: number | null = null;
    let volumeSumPrev = 0;
    let volumeHasPrev = false;
    for (const slug of item.volumeSlugs) {
      const point = bySlug.get(slug);
      if (!point || point.volume24hUsd === null) continue;
      volume = (volume ?? 0) + point.volume24hUsd;
      if (point.volumeChange24hPct !== null) {
        const prev = point.volume24hUsd / (1 + point.volumeChange24hPct / 100);
        if (Number.isFinite(prev)) {
          volumeSumPrev += prev;
          volumeHasPrev = true;
        }
      }
    }
    if (volume !== null && volumeHasPrev) volumeChange = changePct(volume, volumeSumPrev);
    else if (volume !== null && item.volumeSlugs.length === 1) {
      volumeChange = bySlug.get(item.volumeSlugs[0])?.volumeChange24hPct ?? null;
    }
    return {
      ...base,
      tvlUsd: tvl.tvl,
      tvlChange24hPct: tvl.change,
      volume24hUsd: volume,
      volumeChange24hPct: volumeChange,
    };
  });
  return rankExploreDapps(rows);
}

const OFFICIAL_DEX_URL: Record<string, string> = {
  "orca-dex": "https://www.orca.so",
  "raydium-amm": "https://raydium.io",
  pumpswap: "https://pump.fun",
  "pump.fun": "https://pump.fun",
  "meteora-dlmm": "https://app.meteora.ag",
  "meteora-damm-v1": "https://app.meteora.ag",
  "meteora-damm-v2": "https://app.meteora.ag",
  "phoenix-spot": "https://www.phoenix.trade",
};

export function dexVenuesFromVolumes(volumes: LlamaVolumePoint[], limit = 12): ExploreDexVenue[] {
  return volumes
    .filter((item) => item.volume24hUsd !== null && item.volume24hUsd > 0)
    .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
    .slice(0, limit)
    .map((item) => ({
      id: item.slug,
      name: item.name,
      logo: item.logo,
      url: OFFICIAL_DEX_URL[item.slug] ?? "https://defillama.com/protocol/" + item.slug,
      volume24hUsd: item.volume24hUsd ?? 0,
      volumeChange24hPct: item.volumeChange24hPct,
    }));
}

function geckoIncluded(body: unknown): Map<string, Record<string, unknown>> {
  const root = obj(body);
  const included = root && Array.isArray(root.included) ? root.included : [];
  const map = new Map<string, Record<string, unknown>>();
  for (const row of included) {
    const item = obj(row);
    if (!item) continue;
    const id = text(item.id);
    const type = text(item.type);
    if (id && type) map.set(`${type}:${id}`, item);
  }
  return map;
}

function includedAttrs(map: Map<string, Record<string, unknown>>, type: string, id: string | null): Record<string, unknown> | null {
  if (!id) return null;
  const row = map.get(`${type}:${id}`);
  return row ? obj(row.attributes) : null;
}

function relId(row: Record<string, unknown>, rel: string): string | null {
  const relationships = obj(row.relationships);
  const link = relationships ? obj(relationships[rel]) : null;
  const data = link ? obj(link.data) : null;
  return data ? text(data.id) : null;
}

function normalizeBaseSymbol(symbol: string, mint: string): string {
  if (mint === WSOL_MINT) return "SOL";
  const upper = symbol.toUpperCase();
  if (upper === "WSOL" || upper === "WSOLANA") return "SOL";
  return symbol;
}

function geckoPoolUrl(address: string): string {
  return `https://www.geckoterminal.com/solana/pools/${address}`;
}

export function parseGeckoTerminalPools(body: unknown, trending = false): ExplorePairRow[] {
  const root = obj(body);
  const list = root && Array.isArray(root.data) ? root.data : [];
  const included = geckoIncluded(body);
  const rows: ExplorePairRow[] = [];
  for (const row of list) {
    const item = obj(row);
    if (!item) continue;
    const attrs = obj(item.attributes);
    if (!attrs) continue;
    const address = text(attrs.address);
    if (!address) continue;
    const baseId = relId(item, "base_token");
    const quoteId = relId(item, "quote_token");
    const dexId = relId(item, "dex");
    const base = includedAttrs(included, "token", baseId);
    const quote = includedAttrs(included, "token", quoteId);
    const dex = includedAttrs(included, "dex", dexId);
    const baseMint = text(base?.address);
    if (!baseMint) continue;
    const priceUsd = num(attrs.base_token_price_usd);
    if (priceUsd === null || priceUsd <= 0) continue;
    const volume = obj(attrs.volume_usd);
    const change = obj(attrs.price_change_percentage);
    const volume24h = num(volume?.h24) ?? 0;
    const liquidity = num(attrs.reserve_in_usd);
    const rawSymbol = text(base?.symbol) ?? "UNK";
    const baseSymbol = normalizeBaseSymbol(rawSymbol, baseMint);
    const quoteSymbol = text(quote?.symbol) ?? "";
    rows.push({
      id: address,
      name: text(attrs.name) ?? `${baseSymbol} / ${quoteSymbol}`.trim(),
      dex: text(dex?.name) ?? dexId?.replace(/^.*_/, "") ?? "DEX",
      baseSymbol,
      baseName: text(base?.name) ?? baseSymbol,
      baseMint,
      baseDecimals: num(base?.decimals) ?? 9,
      quoteSymbol,
      priceUsd,
      change24hPct: num(change?.h24),
      volume24hUsd: volume24h,
      liquidityUsd: liquidity,
      logo: text(base?.image_url),
      pairUrl: geckoPoolUrl(address),
      trending,
    });
  }
  return rows;
}

export function mergeExplorePairs(trending: ExplorePairRow[], volume: ExplorePairRow[], limit = 15): ExplorePairRow[] {
  const map = new Map<string, ExplorePairRow>();
  for (const row of volume) map.set(row.id, { ...row, trending: false });
  for (const row of trending) {
    const existing = map.get(row.id);
    map.set(row.id, existing ? { ...existing, trending: true } : { ...row, trending: true });
  }
  return [...map.values()]
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, limit);
}

const JLP_USD_DECIMALS = 1e6;

export function parseJupiterMarketStats(body: unknown): {
  price: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
} {
  const item = obj(body);
  return {
    price: item ? num(item.price) : null,
    change24hPct: item ? num(item.priceChange24H) : null,
    volume24hUsd: item ? num(item.volume) : null,
  };
}

export function parseJupiterPoolInfo(body: unknown): { longBorrowPct: number | null; shortBorrowPct: number | null } {
  const item = obj(body);
  return {
    longBorrowPct: item ? num(item.longBorrowRatePercent) : null,
    shortBorrowPct: item ? num(item.shortBorrowRatePercent) : null,
  };
}

export function parseJupiterOpenInterest(body: unknown, jlpSymbol: string): number | null {
  const item = obj(body);
  const custodies = item && Array.isArray(item.custodies) ? item.custodies : [];
  for (const row of custodies) {
    const custody = obj(row);
    if (!custody) continue;
    if (text(custody.symbol) !== jlpSymbol) continue;
    const longUsd = num(custody.guaranteedUsd);
    const shortUsd = num(custody.globalShortSizes);
    if (longUsd === null && shortUsd === null) return null;
    return ((longUsd ?? 0) + (shortUsd ?? 0)) / JLP_USD_DECIMALS;
  }
  return null;
}

export function jupiterPerpMarkets(
  statsByMint: Record<string, unknown>,
  poolByMint: Record<string, unknown>,
  jlpInfo: unknown,
): ExplorePerpMarket[] {
  const rows: ExplorePerpMarket[] = [];
  for (const market of JUPITER_PERP_MARKETS) {
    const stats = parseJupiterMarketStats(statsByMint[market.mint]);
    if (stats.price === null) continue;
    const pool = parseJupiterPoolInfo(poolByMint[market.mint]);
    rows.push({
      id: `jup-${market.symbol}`,
      venue: "Jupiter Perps",
      symbol: market.symbol,
      baseSymbol: market.baseSymbol,
      markPrice: stats.price,
      change24hPct: stats.change24hPct,
      volume24hUsd: stats.volume24hUsd,
      fundingRatePct: pool.longBorrowPct,
      fundingLabel: "Borrow",
      openInterestUsd: parseJupiterOpenInterest(jlpInfo, market.jlpSymbol),
      tradeUrl: market.tradeUrl,
      logo: market.logo,
    });
  }
  return rows;
}

function driftMarketRows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const root = obj(body);
  if (!root) return [];
  for (const key of ["markets", "marketStats", "data", "perpMarkets", "stats"]) {
    if (Array.isArray(root[key])) return root[key] as unknown[];
  }
  return [];
}

export function parseDriftMarkets(body: unknown): ExplorePerpMarket[] {
  const rows: ExplorePerpMarket[] = [];
  for (const row of driftMarketRows(body)) {
    const item = obj(row);
    if (!item) continue;
    const symbol = text(item.symbol) ?? text(item.marketName) ?? text(item.market_name) ?? text(item.name);
    if (!symbol || !/perp/i.test(symbol)) continue;
    const price =
      num(item.markPrice) ??
      num(item.mark_price) ??
      num(item.last) ??
      num(item.oraclePrice) ??
      num(item.oracle_price) ??
      num(item.price);
    if (price === null || price <= 0) continue;
    const base = symbol.replace(/[-_]?PERP$/i, "").replace(/-PERP/i, "");
    const marketSlug = symbol.includes("-") ? symbol : `${base}-PERP`;
    rows.push({
      id: `drift-${marketSlug}`,
      venue: "Drift",
      symbol: marketSlug,
      baseSymbol: base,
      markPrice: price,
      change24hPct: num(item.priceChange24h) ?? num(item.priceChange24H) ?? num(item.change24h) ?? num(item.priceChange),
      volume24hUsd: num(item.volume24h) ?? num(item.volume24hUsd) ?? num(item.quoteVolume24h) ?? num(item.volume),
      fundingRatePct: num(item.fundingRate) ?? num(item.funding_rate) ?? num(item.lastFundingRate),
      fundingLabel: "Funding",
      openInterestUsd: num(item.openInterest) ?? num(item.open_interest) ?? num(item.openInterestUsd) ?? num(item.oi),
      tradeUrl: `https://app.drift.trade/trade/${encodeURIComponent(marketSlug)}`,
      logo: null,
    });
  }
  return rows.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0));
}

export function buildPerpVenues(
  tvlPoints: Map<string, LlamaTvlPoint>,
  jupiterVolume: number | null,
): ExplorePerpVenue[] {
  return PERP_VENUES.map((venue) => {
    const tvl = sumNamedTvl(tvlPoints, [...venue.llamaNames]);
    return {
      id: venue.id,
      name: venue.name,
      url: venue.url,
      logo: venue.logo,
      volume24hUsd: venue.id === "jupiter-perps" ? jupiterVolume : null,
      tvlUsd: tvl.tvl,
      tvlChange24hPct: tvl.change,
    };
  }).sort((a, b) => (b.volume24hUsd ?? b.tvlUsd ?? 0) - (a.volume24hUsd ?? a.tvlUsd ?? 0));
}
