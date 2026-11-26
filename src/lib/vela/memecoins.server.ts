import { heliusApiKey, heliusRpc } from "@/lib/vela/helius.server";
import { asArray, asRecord } from "@/lib/vela/helius-parse";
import {
  mergeFeed,
  parseDexPairs,
  parseDexProfiles,
  parseGeckoNewPools,
  parseMintSafety,
  type MemeCoin,
  type MemeFeed,
  type MemeSafety,
} from "@/lib/vela/memecoins";

/** Free, keyless sources only. */
const GECKO_NEW_POOLS = "https://api.geckoterminal.com/api/v2/networks/solana/new_pools?include=base_token&page=1";
const DEX_PROFILES = "https://api.dexscreener.com/token-profiles/latest/v1";
const DEX_TOKENS = "https://api.dexscreener.com/tokens/v1/solana";
const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

const FEED_TTL_MS = 18_000;
const SAFETY_TTL_MS = 5 * 60_000;
const SAFETY_PER_CYCLE = 10;

type Entry<T> = { at: number; value: T };

const GECKO_KEEP_MS = 3 * 60_000;
const GECKO_BACKOFF_MS = 30_000;

let feedCache: Entry<MemeFeed> | null = null;
/** Last good GeckoTerminal list, reused for a few minutes when it rate-limits us. */
let geckoCache: Entry<MemeCoin[]> | null = null;
let geckoBackoffUntil = 0;
let inflight: Promise<MemeFeed> | null = null;
const safetyCache = new Map<string, Entry<MemeSafety | null>>();

async function getJson(url: string, timeoutMs = 7_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method: string, params: unknown): Promise<unknown> {
  // Helius when the deploy has a key; the public mainnet RPC (free) otherwise.
  if (heliusApiKey()) return heliusRpc(method, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const res = await fetch(PUBLIC_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "solportal-memes", method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Mint + freeze authority (and risky Token-2022 extensions) for the newest cards, one batched call. */
async function attachSafety(coins: MemeCoin[]): Promise<MemeCoin[]> {
  const now = Date.now();
  const todo = coins
    .map((coin) => coin.mint)
    .filter((mint) => {
      const hit = safetyCache.get(mint);
      return !hit || now - hit.at > SAFETY_TTL_MS;
    })
    .slice(0, SAFETY_PER_CYCLE);
  if (todo.length) {
    try {
      const payload = asRecord(await rpc("getMultipleAccounts", [todo, { encoding: "jsonParsed", commitment: "confirmed" }]));
      const values = asArray(asRecord(payload?.result)?.value);
      if (values.length === todo.length) {
        todo.forEach((mint, i) => safetyCache.set(mint, { at: now, value: parseMintSafety(values[i]) }));
      }
    } catch {
      // Leave those badges out this cycle.
    }
  }
  if (safetyCache.size > 2000) {
    for (const [mint, entry] of safetyCache) if (now - entry.at > SAFETY_TTL_MS) safetyCache.delete(mint);
  }
  return coins.map((coin) => ({ ...coin, safety: safetyCache.get(coin.mint)?.value ?? null }));
}

async function buildFeed(): Promise<MemeFeed> {
  const sources: string[] = [];
  const now = Date.now();
  const [geckoRaw, profilesRaw] = await Promise.all([
    now < geckoBackoffUntil
      ? Promise.resolve(null)
      : getJson(GECKO_NEW_POOLS).catch(() => {
          geckoBackoffUntil = Date.now() + GECKO_BACKOFF_MS;
          return null;
        }),
    getJson(DEX_PROFILES).catch(() => null),
  ]);
  let gecko = geckoRaw ? parseGeckoNewPools(geckoRaw) : [];
  if (gecko.length) geckoCache = { at: now, value: gecko };
  else if (geckoCache && now - geckoCache.at < GECKO_KEEP_MS) gecko = geckoCache.value;
  const profiles = profilesRaw ? parseDexProfiles(profilesRaw) : [];
  if (gecko.length) sources.push("geckoterminal");
  if (profiles.length) sources.push("dexscreener");

  // DexScreener pair data (socials, gaps) for every mint, 30 per request.
  const mints = [...new Set([...gecko.map((coin) => coin.mint), ...profiles.map((profile) => profile.mint)])];
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length && chunks.length < 2; i += 30) chunks.push(mints.slice(i, i + 30));
  const pairPayloads = await Promise.all(chunks.map((chunk) => getJson(`${DEX_TOKENS}/${chunk.join(",")}`).catch(() => [])));
  const pairs = parseDexPairs(pairPayloads.flatMap((payload) => asArray(payload)));
  if (pairs.size && !sources.includes("dexscreener")) sources.push("dexscreener");

  const merged = mergeFeed(gecko, profiles, pairs);
  if (!merged.length) throw new Error("feed empty");
  const coins = await attachSafety(merged);
  return { coins, updatedAt: Date.now(), sources, stale: false };
}

/** Cached ~18 s and de-duplicated across concurrent requests so upstreams never see a burst. */
export async function loadMemeFeed(): Promise<MemeFeed> {
  const now = Date.now();
  if (feedCache && now - feedCache.at < FEED_TTL_MS) return feedCache.value;
  if (inflight) return inflight;
  inflight = buildFeed()
    .then((feed) => {
      feedCache = { at: Date.now(), value: feed };
      return feed;
    })
    .catch((err: unknown) => {
      // Rate limited or down: serve the last good feed, marked stale.
      if (feedCache) return { ...feedCache.value, stale: true };
      throw err;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
