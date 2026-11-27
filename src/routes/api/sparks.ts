import { createFileRoute } from "@tanstack/react-router";
import { TOP_COINS } from "@/lib/vela/market-tickers";

/** 24h sparklines for the Top coins list: Coinbase Exchange 15-minute candles (public, keyless). */
const TTL_MS = 10 * 60_000;
let cache: { at: number; value: Record<string, number[]> } | null = null;
let inflight: Promise<Record<string, number[]>> | null = null;

async function candles(symbol: string): Promise<number[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=900`, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": "solportal-wallet" },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return [];
    // Rows are [time, low, high, open, close, volume], newest first. Keep the last 24h, oldest first.
    return rows
      .slice(0, 96)
      .map((row) => (Array.isArray(row) ? Number(row[4]) : NaN))
      .filter((close) => Number.isFinite(close) && close > 0)
      .reverse();
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function build(): Promise<Record<string, number[]>> {
  const lists = await Promise.all(TOP_COINS.map((coin) => candles(coin.symbol)));
  const out: Record<string, number[]> = {};
  TOP_COINS.forEach((coin, i) => {
    const points = lists[i] ?? [];
    if (points.length > 1) out[coin.mint] = points;
    else if (cache?.value[coin.mint]) out[coin.mint] = cache.value[coin.mint]!;
  });
  return out;
}

export const Route = createFileRoute("/api/sparks")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        if (!cache || now - cache.at > TTL_MS) {
          inflight ??= build().finally(() => {
            inflight = null;
          });
          const value = await inflight;
          if (Object.keys(value).length) cache = { at: Date.now(), value };
        }
        return Response.json(
          { sparks: cache?.value ?? {} },
          { headers: { "cache-control": "public, max-age=120, s-maxage=600, stale-while-revalidate=600" } },
        );
      },
    },
  },
});
