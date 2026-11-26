/**
 * Pure helpers for the Market tab's "Memecoins" feed: parse GeckoTerminal new pools and
 * DexScreener payloads, merge them into one card list, read mint safety from a parsed
 * mint account, and format ages. No network here, so everything is unit-testable.
 */
import { asArray, asNumber, asRecord, asString, httpImageUrl } from "@/lib/vela/helius-parse";

export type MemeSocials = { x: string | null; telegram: string | null; discord: string | null; website: string | null };

export type MemeSafety = {
  /** null = not checked (badge left out). */
  mintRevoked: boolean | null;
  freezeRevoked: boolean | null;
  /** Token-2022 extensions that can take or tax tokens after you buy. */
  riskyExtensions: string[];
};

export type MemeCoin = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number | null;
  image: string | null;
  /** Pool / pair creation time, ms epoch. */
  createdAt: number | null;
  marketCapUsd: number | null;
  /** "mc" when the source reported market cap, "fdv" when only fully diluted value was available. */
  marketCapKind: "mc" | "fdv" | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  volume5mUsd: number | null;
  buys24h: number | null;
  sells24h: number | null;
  priceUsd: number | null;
  dex: string | null;
  dexUrl: string;
  socials: MemeSocials;
  safety: MemeSafety | null;
  sources: Array<"geckoterminal" | "dexscreener">;
};

export type MemeFeed = { coins: MemeCoin[]; updatedAt: number; sources: string[]; stale: boolean };

const QUOTE_MINTS = new Set([
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
]);

export function dexScreenerUrl(mint: string): string {
  return `https://dexscreener.com/solana/${mint}`;
}

function num(value: unknown): number | null {
  const n = asNumber(value);
  return n !== null && Number.isFinite(n) ? n : null;
}

function emptySocials(): MemeSocials {
  return { x: null, telegram: null, discord: null, website: null };
}

function httpUrl(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Classify one social link from DexScreener (`{type,url}` or `{label,url}`). */
export function addSocial(socials: MemeSocials, link: unknown): MemeSocials {
  const rec = asRecord(link);
  const url = httpUrl(rec?.url);
  if (!rec || !url) return socials;
  const kind = (asString(rec.type) ?? asString(rec.label) ?? "").toLowerCase();
  const host = new URL(url).hostname.replace(/^www\./, "");
  const next = { ...socials };
  if (kind === "twitter" || kind === "x" || host === "x.com" || host === "twitter.com") next.x ??= url;
  else if (kind === "telegram" || host === "t.me") next.telegram ??= url;
  else if (kind === "discord" || host.endsWith("discord.gg") || host.endsWith("discord.com")) next.discord ??= url;
  else if (kind === "website" || kind === "" || kind === "web") next.website ??= url;
  return next;
}

/** GeckoTerminal `/networks/solana/new_pools?include=base_token`. */
export function parseGeckoNewPools(payload: unknown): MemeCoin[] {
  const root = asRecord(payload);
  const tokens = new Map<string, Record<string, unknown>>();
  for (const item of asArray(root?.included)) {
    const rec = asRecord(item);
    if (asString(rec?.type) !== "token") continue;
    const attrs = asRecord(rec?.attributes);
    const id = asString(rec?.id);
    if (attrs && id) tokens.set(id, attrs);
  }
  const coins: MemeCoin[] = [];
  const seen = new Set<string>();
  for (const item of asArray(root?.data)) {
    const pool = asRecord(item);
    const attrs = asRecord(pool?.attributes);
    if (!attrs) continue;
    const rel = asRecord(pool?.relationships);
    const baseId = asString(asRecord(asRecord(rel?.base_token)?.data)?.id);
    const dex = asString(asRecord(asRecord(rel?.dex)?.data)?.id);
    const token = baseId ? tokens.get(baseId) : undefined;
    const mint = asString(token?.address) ?? (baseId?.startsWith("solana_") ? baseId.slice(7) : null);
    if (!mint || QUOTE_MINTS.has(mint) || seen.has(mint)) continue;
    seen.add(mint);
    const symbol = asString(token?.symbol) ?? asString(attrs.name)?.split(" / ")[0] ?? "?";
    const tx = asRecord(asRecord(attrs.transactions)?.h24);
    const vol = asRecord(attrs.volume_usd);
    const created = asString(attrs.pool_created_at);
    const createdAt = created ? Date.parse(created) : NaN;
    const mc = num(attrs.market_cap_usd);
    const fdv = num(attrs.fdv_usd);
    coins.push({
      mint,
      symbol,
      name: asString(token?.name) ?? symbol,
      decimals: num(token?.decimals),
      image: httpImageUrl(token?.image_url),
      createdAt: Number.isFinite(createdAt) ? createdAt : null,
      marketCapUsd: mc ?? fdv,
      marketCapKind: mc !== null ? "mc" : fdv !== null ? "fdv" : null,
      liquidityUsd: num(attrs.reserve_in_usd),
      volume24hUsd: num(vol?.h24),
      volume5mUsd: num(vol?.m5),
      buys24h: num(tx?.buys),
      sells24h: num(tx?.sells),
      priceUsd: num(attrs.base_token_price_usd),
      dex,
      dexUrl: dexScreenerUrl(mint),
      socials: emptySocials(),
      safety: null,
      sources: ["geckoterminal"],
    });
  }
  return coins;
}

/** DexScreener `/token-profiles/latest/v1`: Solana mints with icon and socials. */
export function parseDexProfiles(payload: unknown): Array<{ mint: string; icon: string | null; socials: MemeSocials }> {
  const out: Array<{ mint: string; icon: string | null; socials: MemeSocials }> = [];
  const seen = new Set<string>();
  for (const item of asArray(payload)) {
    const rec = asRecord(item);
    if (asString(rec?.chainId) !== "solana") continue;
    const mint = asString(rec?.tokenAddress);
    if (!mint || seen.has(mint) || QUOTE_MINTS.has(mint)) continue;
    seen.add(mint);
    let socials = emptySocials();
    for (const link of asArray(rec?.links)) socials = addSocial(socials, link);
    out.push({ mint, icon: httpImageUrl(rec?.icon), socials });
  }
  return out;
}

/** DexScreener `/tokens/v1/solana/{mints}`: the most liquid pair per base mint. */
export function parseDexPairs(payload: unknown): Map<string, MemeCoin> {
  const best = new Map<string, { liq: number; coin: MemeCoin }>();
  for (const item of asArray(payload)) {
    const pair = asRecord(item);
    if (asString(pair?.chainId) !== "solana") continue;
    const base = asRecord(pair?.baseToken);
    const mint = asString(base?.address);
    if (!mint) continue;
    const liq = num(asRecord(pair?.liquidity)?.usd);
    const info = asRecord(pair?.info);
    let socials = emptySocials();
    for (const link of asArray(info?.socials)) socials = addSocial(socials, link);
    for (const link of asArray(info?.websites)) socials = addSocial(socials, { type: "website", url: asRecord(link)?.url });
    const tx = asRecord(asRecord(pair?.txns)?.h24);
    const vol = asRecord(pair?.volume);
    const mc = num(pair?.marketCap);
    const fdv = num(pair?.fdv);
    const symbol = asString(base?.symbol) ?? "?";
    const coin: MemeCoin = {
      mint,
      symbol,
      name: asString(base?.name) ?? symbol,
      decimals: null,
      image: httpImageUrl(info?.imageUrl),
      createdAt: num(pair?.pairCreatedAt),
      marketCapUsd: mc ?? fdv,
      marketCapKind: mc !== null ? "mc" : fdv !== null ? "fdv" : null,
      liquidityUsd: liq,
      volume24hUsd: num(vol?.h24),
      volume5mUsd: num(vol?.m5),
      buys24h: num(tx?.buys),
      sells24h: num(tx?.sells),
      priceUsd: num(pair?.priceUsd),
      dex: asString(pair?.dexId),
      dexUrl: httpUrl(pair?.url) ?? dexScreenerUrl(mint),
      socials,
      safety: null,
      sources: ["dexscreener"],
    };
    const prev = best.get(mint);
    if (!prev || (liq ?? 0) > prev.liq) best.set(mint, { liq: liq ?? 0, coin });
  }
  return new Map([...best].map(([mint, entry]) => [mint, entry.coin]));
}

function mergeSocials(a: MemeSocials, b: MemeSocials): MemeSocials {
  return { x: a.x ?? b.x, telegram: a.telegram ?? b.telegram, discord: a.discord ?? b.discord, website: a.website ?? b.website };
}

/**
 * One list, newest first. GeckoTerminal new pools lead; DexScreener fills socials and any
 * numbers GeckoTerminal lacked, and contributes freshly profiled tokens of its own.
 */
export function mergeFeed(
  gecko: MemeCoin[],
  profiles: Array<{ mint: string; icon: string | null; socials: MemeSocials }>,
  pairs: Map<string, MemeCoin>,
  limit = 30,
): MemeCoin[] {
  const byMint = new Map<string, MemeCoin>();
  for (const coin of gecko) {
    const ds = pairs.get(coin.mint);
    byMint.set(
      coin.mint,
      ds
        ? {
            ...coin,
            image: coin.image ?? ds.image,
            marketCapUsd: coin.marketCapUsd ?? ds.marketCapUsd,
            marketCapKind: coin.marketCapKind ?? ds.marketCapKind,
            liquidityUsd: coin.liquidityUsd ?? ds.liquidityUsd,
            volume24hUsd: coin.volume24hUsd ?? ds.volume24hUsd,
            volume5mUsd: coin.volume5mUsd ?? ds.volume5mUsd,
            buys24h: coin.buys24h ?? ds.buys24h,
            sells24h: coin.sells24h ?? ds.sells24h,
            socials: mergeSocials(coin.socials, ds.socials),
            sources: ["geckoterminal", "dexscreener"],
          }
        : coin,
    );
  }
  for (const profile of profiles) {
    const existing = byMint.get(profile.mint);
    if (existing) {
      byMint.set(profile.mint, { ...existing, image: existing.image ?? profile.icon, socials: mergeSocials(existing.socials, profile.socials) });
      continue;
    }
    const ds = pairs.get(profile.mint);
    if (!ds) continue; // No pair yet: nothing honest to show for mcap/liquidity.
    byMint.set(profile.mint, { ...ds, image: ds.image ?? profile.icon, socials: mergeSocials(ds.socials, profile.socials) });
  }
  return [...byMint.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, limit);
}

const RISKY_EXTENSIONS: Record<string, string> = {
  permanentDelegate: "Permanent delegate",
  transferHook: "Transfer hook",
  transferFeeConfig: "Transfer fee",
  nonTransferable: "Non-transferable",
  pausableConfig: "Pausable",
};

/** Mint safety from one `getMultipleAccounts` (jsonParsed) value. Null when it isn't a mint. */
export function parseMintSafety(account: unknown): MemeSafety | null {
  const parsed = asRecord(asRecord(asRecord(account)?.data)?.parsed);
  if (asString(parsed?.type) !== "mint") return null;
  const info = asRecord(parsed?.info);
  if (!info) return null;
  const riskyExtensions: string[] = [];
  for (const ext of asArray(info.extensions)) {
    const rec = asRecord(ext);
    const name = asString(rec?.extension);
    if (!name || !(name in RISKY_EXTENSIONS)) continue;
    if (name === "transferFeeConfig") {
      const state = asRecord(rec?.state);
      const newer = asNumber(asRecord(state?.newerTransferFee)?.transferFeeBasisPoints) ?? 0;
      const older = asNumber(asRecord(state?.olderTransferFee)?.transferFeeBasisPoints) ?? 0;
      if (newer === 0 && older === 0) continue;
    }
    if (name === "transferHook" && !asString(asRecord(rec?.state)?.programId)) continue;
    if (name === "permanentDelegate" && !asString(asRecord(rec?.state)?.delegate)) continue;
    riskyExtensions.push(RISKY_EXTENSIONS[name]!);
  }
  return {
    mintRevoked: info.mintAuthority === null || info.mintAuthority === undefined,
    freezeRevoked: info.freezeAuthority === null || info.freezeAuthority === undefined,
    riskyExtensions,
  };
}

/** "52s", "14m 52s", "3h 05m", "2d 4h". */
export function formatAge(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600) % 24;
  const d = Math.floor(total / 86400);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Share of trades that were buys, 0..1, or null with no trades. */
export function buyRatio(buys: number | null, sells: number | null): number | null {
  const b = buys ?? 0;
  const s = sells ?? 0;
  if (b + s === 0) return null;
  return b / (b + s);
}

export const MEME_SORTS = [
  { id: "new", label: "New" },
  { id: "trending", label: "Trending" },
  { id: "mcap", label: "Market cap" },
  { id: "volume", label: "Volume" },
  { id: "liquidity", label: "Liquidity" },
] as const;
export type MemeSort = (typeof MEME_SORTS)[number]["id"];

/** Trending = recent activity: 5m volume first, then trade count, then 24h volume. */
function trendScore(coin: MemeCoin): number {
  const trades = (coin.buys24h ?? 0) + (coin.sells24h ?? 0);
  return (coin.volume5mUsd ?? 0) * 1000 + trades * 10 + (coin.volume24hUsd ?? 0) / 1000;
}

export function sortMemeCoins(coins: MemeCoin[], sort: MemeSort): MemeCoin[] {
  const key = (coin: MemeCoin): number => {
    switch (sort) {
      case "new":
        return coin.createdAt ?? 0;
      case "trending":
        return trendScore(coin);
      case "mcap":
        return coin.marketCapUsd ?? -1;
      case "volume":
        return coin.volume24hUsd ?? coin.volume5mUsd ?? -1;
      case "liquidity":
        return coin.liquidityUsd ?? -1;
    }
  };
  return [...coins].sort((a, b) => key(b) - key(a));
}
