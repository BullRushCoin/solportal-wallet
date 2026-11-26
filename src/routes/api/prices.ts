import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { fetchJupiterPrices } from "@/lib/vela/helius.server";
import { parseMintList } from "@/lib/vela/market-tickers";

type Quote = { priceUsd: number | null; change24hPct: number | null };
const TTL_MS = 10_000;
const cache = new Map<string, { at: number; value: Record<string, Quote> }>();

/** Batch live prices: GET /api/prices?mints=a,b,c (max 50) → { prices: { [mint]: {priceUsd, change24hPct} } }. */
export const Route = createFileRoute("/api/prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const mints = parseMintList(new URL(request.url).searchParams.get("mints")).filter(isSolanaAddress);
        if (!mints.length) return Response.json({ error: "no valid mints" }, { status: 400 });
        const key = [...mints].sort().join(",");
        const now = Date.now();
        const hit = cache.get(key);
        if (hit && now - hit.at < TTL_MS) return Response.json({ prices: hit.value, at: hit.at });
        const quotes = await fetchJupiterPrices(mints).catch(() => []);
        if (!quotes.length && hit) return Response.json({ prices: hit.value, at: hit.at });
        const prices: Record<string, Quote> = {};
        for (const mint of mints) {
          const quote = quotes.find((item) => item.mint === mint);
          prices[mint] = { priceUsd: quote && quote.priceUsd > 0 ? quote.priceUsd : null, change24hPct: quote?.change24hPct ?? null };
        }
        cache.set(key, { at: now, value: prices });
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
        return Response.json({ prices, at: now }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
