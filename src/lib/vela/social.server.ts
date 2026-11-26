import type { Headline, NewsSnapshot, TokenLinks, TrendingCoin } from "@/lib/vela/social";

const NEWS_TTL_MS = 5 * 60_000;
const LINKS_TTL_MS = 6 * 60 * 60_000;

/** Free RSS feeds. `all` feeds are Solana-only; the rest are filtered by keyword. */
const FEEDS: Array<{ url: string; source: string; all?: boolean }> = [
  { url: "https://cointelegraph.com/rss/tag/solana", source: "Cointelegraph", all: true },
  { url: "https://decrypt.co/feed", source: "Decrypt" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
  { url: "https://thedefiant.io/api/feed", source: "The Defiant" },
];
const SOLANA_WORDS =
  /\b(solana|sol|jupiter|phantom|bonk|pump\.fun|raydium|helius|firedancer|jito|marinade|backpack|meteora|orca|drift|kamino|wif|pyth|saga|seeker)\b/i;

let newsCache: { at: number; value: NewsSnapshot } | null = null;
const linksCache = new Map<string, { at: number; value: TokenLinks }>();

async function getText(url: string, timeoutMs = 8_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 SolPortal" } });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function tag(block: string, name: string): string | null {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decode(match[1]!) : null;
}

async function loadFeed(feed: (typeof FEEDS)[number]): Promise<Headline[]> {
  const xml = await getText(feed.url);
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const out: Headline[] = [];
  for (const item of items.slice(0, 40)) {
    const title = tag(item, "title");
    const link = tag(item, "link") ?? tag(item, "guid");
    if (!title || !link || !/^https?:\/\//.test(link)) continue;
    if (!feed.all && !SOLANA_WORDS.test(`${title} ${tag(item, "description") ?? ""}`)) continue;
    const date = Date.parse(tag(item, "pubDate") ?? "");
    out.push({ title, url: link, source: feed.source, publishedAt: Number.isFinite(date) ? date : null });
  }
  return out;
}

async function loadTrending(): Promise<TrendingCoin[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("https://lite-api.jup.ag/tokens/v2/toptrending/1h?limit=40", { signal: controller.signal });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows
      .filter((row) => row.isVerified === true && typeof row.id === "string")
      .slice(0, 15)
      .map((row) => {
        const stats = (row.stats24h ?? {}) as Record<string, unknown>;
        return {
          mint: row.id as string,
          symbol: String(row.symbol ?? "?"),
          name: String(row.name ?? row.symbol ?? "Unknown"),
          priceUsd: typeof row.usdPrice === "number" ? row.usdPrice : null,
          change24hPct: typeof stats.priceChange === "number" ? stats.priceChange : null,
          image: typeof row.icon === "string" ? row.icon : null,
          decimals: typeof row.decimals === "number" ? row.decimals : 6,
        };
      });
  } finally {
    clearTimeout(timer);
  }
}

export async function loadNews(): Promise<NewsSnapshot> {
  const now = Date.now();
  if (newsCache && now - newsCache.at < NEWS_TTL_MS) return newsCache.value;
  const [feeds, trending] = await Promise.all([
    Promise.allSettled(FEEDS.map(loadFeed)),
    loadTrending().catch(() => [] as TrendingCoin[]),
  ]);
  const seen = new Set<string>();
  const headlines = feeds
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    .slice(0, 25);
  const value: NewsSnapshot = {
    headlines: headlines.length ? headlines : (newsCache?.value.headlines ?? []),
    trending: trending.length ? trending : (newsCache?.value.trending ?? []),
    updatedAt: now,
  };
  newsCache = { at: now, value };
  return value;
}

export async function loadTokenLinks(mint: string): Promise<TokenLinks> {
  const now = Date.now();
  const hit = linksCache.get(mint);
  if (hit && now - hit.at < LINKS_TTL_MS) return hit.value;
  const empty: TokenLinks = { website: null, x: null, telegram: null, discord: null };
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`);
    if (!res.ok) return hit?.value ?? empty;
    const pairs = (await res.json()) as Array<{ info?: { websites?: Array<{ url?: string }>; socials?: Array<{ type?: string; url?: string }> } }>;
    const info = pairs.find((pair) => pair.info)?.info;
    const social = (type: string) => info?.socials?.find((item) => item.type === type)?.url ?? null;
    const value: TokenLinks = {
      website: info?.websites?.[0]?.url ?? null,
      x: social("twitter"),
      telegram: social("telegram"),
      discord: social("discord"),
    };
    linksCache.set(mint, { at: now, value });
    return value;
  } catch {
    return hit?.value ?? empty;
  }
}
