import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { parseMintList } from "@/lib/vela/market-tickers";
import { mapJupiterSearch, SEARCH_LIMIT, type PickerToken } from "@/lib/vela/token-picker";

const TTL_MS = 60_000;
const SEARCH_URL = "https://lite-api.jup.ag/tokens/v2/search";
const cache = new Map<string, { at: number; tokens: PickerToken[] }>();

/**
 * Token search for the Swap picker: GET /api/token-search?q=<name, symbol or mint> → { tokens } (max 20).
 * GET /api/token-search?mints=a,b,c (max 50) looks up metadata (icon, verified, price) for known mints.
 */
export const Route = createFileRoute("/api/token-search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const mints = parseMintList(params.get("mints"), 50).filter(isSolanaAddress);
        const q = mints.length ? [...mints].sort().join(",") : (params.get("q") ?? "").trim().slice(0, 64);
        const limit = mints.length ? mints.length : SEARCH_LIMIT;
        if (!q) return Response.json({ tokens: [] });
        const key = q.toLowerCase();
        const now = Date.now();
        const hit = cache.get(key);
        if (hit && now - hit.at < TTL_MS) {
          return Response.json({ tokens: hit.tokens }, { headers: { "cache-control": "public, max-age=60" } });
        }
        try {
          const res = await fetch(`${SEARCH_URL}?query=${encodeURIComponent(q)}`, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) throw new Error(String(res.status));
          const tokens = mapJupiterSearch(await res.json(), limit);
          cache.set(key, { at: now, tokens });
          if (cache.size > 500) cache.delete(cache.keys().next().value!);
          return Response.json({ tokens }, { headers: { "cache-control": "public, max-age=60" } });
        } catch {
          if (hit) return Response.json({ tokens: hit.tokens, stale: true });
          return Response.json({ error: "Token search unavailable", tokens: [] }, { status: 502 });
        }
      },
    },
  },
});
