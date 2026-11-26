import { TOKENS } from "@/lib/vela/tokens";
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  httpImageUrl,
  parseAsset,
  imageFromTokenInfo,
  parseAssetBatch,
  parseAssetsByOwner,
  parseJupiterPrices,
  type AssetQuote,
  type JupiterPriceQuote,
  type WatchedWallet,
} from "@/lib/vela/helius-parse";
import { fallbackMarketSnapshot, type MarketSnapshot, type MarketTokenQuote } from "@/lib/vela/market";

const MARKET_TTL_MS = 45_000;
const WALLET_TTL_MS = 30_000;
const HELIUS_RPC = "https://mainnet.helius-rpc.com";
const JUPITER_PRICE_V3 = "https://lite-api.jup.ag/price/v3";
const JUPITER_PRICE_V2 = "https://lite-api.jup.ag/price/v2";
const JUPITER_TOKEN_V1 = "https://lite-api.jup.ag/tokens/v1/token";
const JUPITER_TOKEN_SEARCH_V2 = "https://lite-api.jup.ag/tokens/v2/search";

type CacheEntry<T> = { at: number; value: T };

let marketCache: CacheEntry<MarketSnapshot> | null = null;
const walletCache = new Map<string, CacheEntry<WatchedWallet>>();

export function heliusApiKey(): string | undefined {
  const key = process.env.HELIUS_API_KEY?.trim();
  return key || undefined;
}

function heliusEndpoint(key: string): string {
  return `${HELIUS_RPC}/?api-key=${key}`;
}

async function postJson(url: string, body: unknown, timeoutMs = 8_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url: string, timeoutMs = 8_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function heliusCall(key: string, method: string, params: unknown): Promise<unknown> {
  return postJson(heliusEndpoint(key), { jsonrpc: "2.0", id: "solportal", method, params });
}

export async function heliusRpc(method: string, params: unknown): Promise<unknown> {
  const key = heliusApiKey();
  if (!key) throw new Error("HELIUS_UNAVAILABLE");
  return heliusCall(key, method, params);
}


export async function fetchJupiterPrices(mints: string[]): Promise<JupiterPriceQuote[]> {
  const ids = mints.join(",");
  try {
    const v3 = await getJson(`${JUPITER_PRICE_V3}?ids=${encodeURIComponent(ids)}`);
    const parsed = parseJupiterPrices(v3);
    if (parsed.length) return parsed;
  } catch {
    // Fall through to v2.
  }
  try {
    const v2 = await getJson(`${JUPITER_PRICE_V2}?ids=${encodeURIComponent(ids)}&showExtraInfo=true`);
    return parseJupiterPrices(v2);
  } catch {
    return [];
  }
}

async function fetchJupiterLogo(mint: string): Promise<string | null> {
  try {
    return imageFromTokenInfo(await getJson(`${JUPITER_TOKEN_V1}/${encodeURIComponent(mint)}`));
  } catch {
    return null;
  }
}

async function fetchHeliusAssets(key: string, mints: string[]): Promise<AssetQuote[]> {
  const rpc = await heliusCall(key, "getAssetBatch", { ids: mints, displayOptions: { showFungible: true } });
  return parseAssetBatch(rpc);
}

export async function loadMarketSnapshot(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (marketCache && now - marketCache.at < MARKET_TTL_MS) return marketCache.value;

  const fallback = fallbackMarketSnapshot(now);
  const mints = TOKENS.map((token) => token.mint);
  let heliusQuotes: AssetQuote[] = [];
  let jupiterQuotes: JupiterPriceQuote[] = [];
  const logoByMint = new Map<string, string>();

  const key = heliusApiKey();
  const jobs: Array<Promise<void>> = [
    fetchJupiterPrices(mints)
      .then((quotes) => {
        jupiterQuotes = quotes;
      })
      .catch(() => {
        jupiterQuotes = [];
      }),
  ];
  if (key) {
    jobs.push(
      fetchHeliusAssets(key, mints)
        .then((quotes) => {
          heliusQuotes = quotes;
        })
        .catch(() => {
          heliusQuotes = [];
        }),
    );
  }

  await Promise.all(jobs);

  for (const quote of heliusQuotes) {
    const image = httpImageUrl(quote.image);
    if (image) logoByMint.set(quote.mint, image);
  }

  const missingLogos = mints.filter((mint) => !logoByMint.has(mint));
  if (missingLogos.length) {
    const logos = await Promise.all(missingLogos.map((mint) => fetchJupiterLogo(mint).then((image) => [mint, image] as const)));
    for (const [mint, image] of logos) {
      if (image) logoByMint.set(mint, image);
    }
  }

  const jupByMint = new Map(jupiterQuotes.map((quote) => [quote.mint, quote]));
  const heliusByMint = new Map(heliusQuotes.map((quote) => [quote.mint, quote]));

  const tokens: Record<string, MarketTokenQuote> = { ...fallback.tokens };
  let liveCount = 0;
  for (const token of TOKENS) {
    const helius = heliusByMint.get(token.mint);
    const jup = jupByMint.get(token.mint);
    const priceUsd = (jup?.priceUsd && jup.priceUsd > 0 ? jup.priceUsd : null) ?? (helius?.priceUsd && helius.priceUsd > 0 ? helius.priceUsd : null);
    const change24hPct = jup?.change24hPct ?? null;
    const image = logoByMint.get(token.mint) ?? null;
    if (priceUsd === null && !image && change24hPct === null) continue;
    liveCount += 1;
    tokens[token.symbol] = {
      symbol: token.symbol,
      mint: token.mint,
      name: token.name,
      priceUsd: priceUsd ?? token.priceUsd,
      change24hPct,
      image,
      source: priceUsd !== null ? "live" : "fallback",
    };
  }

  const snapshot: MarketSnapshot = {
    tokens,
    updatedAt: now,
    live: liveCount > 0,
  };
  marketCache = { at: now, value: snapshot };
  return snapshot;
}

export async function loadWatchedWallet(address: string): Promise<WatchedWallet> {
  const now = Date.now();
  const cached = walletCache.get(address);
  if (cached && now - cached.at < WALLET_TTL_MS) return cached.value;

  const key = heliusApiKey();
  if (!key) {
    throw new Error("HELIUS_UNAVAILABLE");
  }

  const rpc = await heliusCall(key, "getAssetsByOwner", {
    ownerAddress: address,
    page: 1,
    limit: 1000,
    displayOptions: { showFungible: true, showNativeBalance: true },
  });
  const wallet = parseAssetsByOwner(address, rpc);

  const mints = [TOKENS[0]?.mint, ...wallet.tokens.map((token) => token.mint)].filter((mint): mint is string => Boolean(mint));
  const unique = [...new Set(mints)];
  let jupiterQuotes: JupiterPriceQuote[] = [];
  try {
    jupiterQuotes = unique.length ? await fetchJupiterPrices(unique) : [];
  } catch {
    jupiterQuotes = [];
  }
  const jupByMint = new Map(jupiterQuotes.map((quote) => [quote.mint, quote]));
  const solMint = TOKENS.find((token) => token.symbol === "SOL")?.mint;
  const solJup = solMint ? jupByMint.get(solMint) : undefined;
  if (solJup?.priceUsd && !(wallet.sol.priceUsd && wallet.sol.priceUsd > 0)) {
    wallet.sol.priceUsd = solJup.priceUsd;
    wallet.sol.valueUsd = wallet.sol.amount * solJup.priceUsd;
  }
  for (const token of wallet.tokens) {
    const jup = jupByMint.get(token.mint);
    if (jup) {
      token.change24hPct = jup.change24hPct;
      if (!(token.priceUsd && token.priceUsd > 0) && jup.priceUsd > 0) {
        token.priceUsd = jup.priceUsd;
        token.valueUsd = token.amount * jup.priceUsd;
      }
    }
  }
  const values = [wallet.sol.valueUsd, ...wallet.tokens.map((token) => token.valueUsd)].filter((v): v is number => v !== null);
  wallet.totalUsd = values.length ? values.reduce((sum, v) => sum + v, 0) : null;

  walletCache.set(address, { at: now, value: wallet });
  return wallet;
}

/** Test helper: drop in-memory caches between cases. */
export function clearHeliusCaches(): void {
  marketCache = null;
  walletCache.clear();
  tokenCache.clear();
  priceCache.clear();
  historyCache.clear();
  poolCache.clear();
}

export type TokenLookup = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  change24hPct: number | null;
  image: string | null;
};

const TOKEN_TTL_MS = 60_000;
const tokenCache = new Map<string, CacheEntry<TokenLookup | null>>();

/**
 * Look up any SPL / Token-2022 coin by its mint address.
 * Uses Helius DAS when HELIUS_API_KEY is set, and Jupiter's public token + price APIs either way.
 * Returns null when the address is not a known fungible token.
 */
export async function lookupToken(mint: string): Promise<TokenLookup | null> {
  const now = Date.now();
  const cached = tokenCache.get(mint);
  if (cached && now - cached.at < TOKEN_TTL_MS) return cached.value;

  const key = heliusApiKey();
  const [heliusAsset, jupInfo, prices] = await Promise.all([
    key
      ? heliusCall(key, "getAsset", { id: mint, displayOptions: { showFungible: true } })
          .then((rpc) => asRecord(asRecord(rpc)?.result))
          .catch(() => null)
      : Promise.resolve(null),
    getJson(`${JUPITER_TOKEN_SEARCH_V2}?query=${encodeURIComponent(mint)}`)
      .then((payload) => asRecord((Array.isArray(payload) ? payload : []).find((item) => asRecord(item)?.id === mint)))
      .catch(() => null),
    fetchJupiterPrices([mint]).catch(() => [] as JupiterPriceQuote[]),
  ]);

  const tokenInfo = asRecord(heliusAsset?.token_info);
  const meta = asRecord(asRecord(heliusAsset?.content)?.metadata);
  const iface = asString(heliusAsset?.interface) ?? "";
  const heliusDecimals = asNumber(tokenInfo?.decimals);
  const looksNft = /NFT|ProgrammableNFT|MplCore/i.test(iface) && (heliusDecimals ?? 0) === 0;

  const symbol = asString(jupInfo?.symbol) ?? asString(tokenInfo?.symbol) ?? asString(meta?.symbol);
  const name = asString(jupInfo?.name) ?? asString(meta?.name) ?? symbol;
  const decimals = asNumber(jupInfo?.decimals) ?? heliusDecimals;

  let result: TokenLookup | null = null;
  if (!looksNft && symbol && decimals !== null) {
    const jup = prices.find((quote) => quote.mint === mint);
    const heliusPrice = asNumber(asRecord(tokenInfo?.price_info)?.price_per_token);
    const heliusImage = heliusAsset ? parseAsset(heliusAsset) : null;
    const heliusImageUrl =
      heliusImage?.kind === "fungible" ? heliusImage.holding.image : heliusImage?.kind === "quote" ? heliusImage.quote.image : null;
    result = {
      mint,
      symbol,
      name: name ?? symbol,
      decimals,
      priceUsd: jup?.priceUsd && jup.priceUsd > 0 ? jup.priceUsd : heliusPrice && heliusPrice > 0 ? heliusPrice : null,
      change24hPct: jup?.change24hPct ?? null,
      image: imageFromTokenInfo(jupInfo) ?? httpImageUrl(heliusImageUrl),
    };
  }

  tokenCache.set(mint, { at: now, value: result });
  return result;
}

// ---------- Live price + chart history for a single coin ----------

export type LivePrice = { mint: string; priceUsd: number | null; change24hPct: number | null; at: number };
export type PricePoint = { t: number; p: number };
export type ChartRange = "1H" | "1D" | "1W" | "1M" | "1Y";

const PRICE_TTL_MS = 4_000;
const HISTORY_TTL_MS = 120_000;
const POOL_TTL_MS = 60 * 60_000;
const GECKO = "https://api.geckoterminal.com/api/v2/networks/solana";

const priceCache = new Map<string, CacheEntry<LivePrice>>();
const historyCache = new Map<string, CacheEntry<PricePoint[]>>();
const poolCache = new Map<string, CacheEntry<string[]>>();

export async function loadLivePrice(mint: string): Promise<LivePrice> {
  const now = Date.now();
  const cached = priceCache.get(mint);
  if (cached && now - cached.at < PRICE_TTL_MS) return cached.value;
  const quotes = await fetchJupiterPrices([mint]);
  const quote = quotes.find((item) => item.mint === mint);
  const value: LivePrice = {
    mint,
    priceUsd: quote?.priceUsd && quote.priceUsd > 0 ? quote.priceUsd : null,
    change24hPct: quote?.change24hPct ?? null,
    at: now,
  };
  if (value.priceUsd === null && cached) return cached.value;
  priceCache.set(mint, { at: now, value });
  return value;
}

/** Most-liquid pools for a mint (up to 3), from GeckoTerminal (free, no key). */
async function topPoolsFor(mint: string): Promise<string[]> {
  const now = Date.now();
  const cached = poolCache.get(mint);
  if (cached && now - cached.at < POOL_TTL_MS) return cached.value;
  const payload = asRecord(await getJson(`${GECKO}/tokens/${encodeURIComponent(mint)}/pools?page=1`));
  const pools = asArray(payload?.data)
    .map((item) => asRecord(asRecord(item)?.attributes))
    .filter((attrs): attrs is Record<string, unknown> => Boolean(attrs))
    .map((attrs) => ({ address: asString(attrs.address), liquidity: asNumber(attrs.reserve_in_usd) ?? 0 }))
    .filter((pool): pool is { address: string; liquidity: number } => Boolean(pool.address))
    .sort((a, b) => b.liquidity - a.liquidity);
  const addresses = pools.slice(0, 3).map((pool) => pool.address);
  poolCache.set(mint, { at: now, value: addresses });
  return addresses;
}

const RANGE_QUERY: Record<ChartRange, { timeframe: "minute" | "hour" | "day"; aggregate: number; limit: number }> = {
  "1H": { timeframe: "minute", aggregate: 1, limit: 60 },
  "1D": { timeframe: "minute", aggregate: 15, limit: 96 },
  "1W": { timeframe: "hour", aggregate: 1, limit: 168 },
  "1M": { timeframe: "hour", aggregate: 4, limit: 180 },
  "1Y": { timeframe: "day", aggregate: 1, limit: 365 },
};

export async function loadPriceHistory(mint: string, range: ChartRange): Promise<PricePoint[]> {
  const now = Date.now();
  const key = `${mint}:${range}`;
  const cached = historyCache.get(key);
  if (cached && now - cached.at < HISTORY_TTL_MS) return cached.value;
  try {
    const pools = await topPoolsFor(mint);
    if (!pools.length) return [];
    const { timeframe, aggregate, limit } = RANGE_QUERY[range];
    // Long ranges: the most liquid pool can be young, so fall back to the next pool
    // when the first one covers less than half the window.
    const tries = range === "1M" || range === "1Y" ? pools.length : 1;
    let points: PricePoint[] = [];
    for (let i = 0; i < tries; i += 1) {
      const payload = asRecord(
        await getJson(
          `${GECKO}/pools/${pools[i]}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${encodeURIComponent(mint)}`,
        ),
      );
      const list = asArray(asRecord(asRecord(payload?.data)?.attributes)?.ohlcv_list);
      const candidate = list
        .map((row) => {
          const cells = asArray(row);
          const t = asNumber(cells[0]);
          const close = asNumber(cells[4]);
          return t !== null && close !== null && close > 0 ? { t: t * 1000, p: close } : null;
        })
        .filter((point): point is PricePoint => point !== null)
        .sort((a, b) => a.t - b.t);
      if (candidate.length > points.length) points = candidate;
      if (points.length >= limit / 2) break;
    }
    historyCache.set(key, { at: now, value: points });
    return points;
  } catch {
    // Rate limited or unknown token: serve stale history if we have it, else an empty series
    // (the client still draws a live chart from its own polling).
    return cached?.value ?? [];
  }
}
