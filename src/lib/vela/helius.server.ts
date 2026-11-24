import { TOKENS } from "@/lib/vela/tokens";
import {
  httpImageUrl,
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


async function fetchJupiterPrices(mints: string[]): Promise<JupiterPriceQuote[]> {
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
}
