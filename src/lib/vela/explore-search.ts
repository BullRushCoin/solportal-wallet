/** Pure helpers for the Explore search / URL bar. */
import type { DiscoverApp } from "@/lib/vela/discover";

/** True when the input should open as a website rather than filter (e.g. "jup.ag", "https://x.com/a"). */
export function looksLikeUrl(input: string): boolean {
  const text = input.trim();
  if (!text || /\s/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return true;
  const host = text.split(/[/?#]/)[0]!.replace(/:\d+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) return false;
  const tld = host.split(".").pop() ?? "";
  return /^[a-z][a-z0-9-]*[a-z0-9]$/i.test(tld) && tld.length >= 2;
}

export function matchApps(apps: DiscoverApp[], query: string): DiscoverApp[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return apps.filter((app) => `${app.name} ${app.tagline} ${app.url} ${app.keywords ?? ""} ${app.tabs.join(" ")}`.toLowerCase().includes(q));
}

export type SearchToken = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number | null;
  image: string | null;
  priceUsd: number | null;
  marketCapUsd?: number | null;
};

/** Tokens whose symbol, name, or mint match. Exact symbol hits first; one row per mint. */
export function matchTokens(tokens: SearchToken[], query: string, limit = 8): SearchToken[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const scored: Array<{ token: SearchToken; score: number }> = [];
  for (const token of tokens) {
    if (seen.has(token.mint)) continue;
    const symbol = token.symbol.toLowerCase();
    const name = token.name.toLowerCase();
    let score = -1;
    if (symbol === q) score = 0;
    else if (symbol.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (symbol.includes(q) || name.includes(q)) score = 3;
    else if (q.length >= 4 && token.mint.toLowerCase().startsWith(q)) score = 4;
    if (score < 0) continue;
    seen.add(token.mint);
    scored.push({ token, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((item) => item.token);
}

/** Token prices that can be tiny ($0.00001234) without scientific notation. */
export function formatTokenPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (value >= 1) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  const zeros = Math.max(0, Math.floor(-Math.log10(value)));
  return `$${value.toFixed(Math.min(12, zeros + 3))}`;
}

/** 1234 → "1.2K", 2500000 → "2.5M". */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value < 1000) return String(Math.round(value));
  if (value < 1e6) return `${(value / 1e3).toFixed(value < 1e4 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(value / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Hostname without www., or null. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
