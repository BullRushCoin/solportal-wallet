import { jupHeaders } from "@/lib/vela/jupiter-api.server";
import { createFileRoute } from "@tanstack/react-router";
import { buildQuoteUrl, JUPITER_LITE_API } from "@/lib/vela/jupiter";
import { parseQuoteParams, quoteCacheKey, trimJupiterQuote } from "@/lib/vela/swap-quote";

const TTL_MS = 4_000;
const cache = new Map<string, { at: number; body: unknown; status: number }>();
const NO_STORE = { "cache-control": "no-store" };

/**
 * Live Jupiter quote with the 85 bps platform fee: GET /api/quote?inputMint&outputMint&amount(raw)&slippageBps.
 * Identical requests within 4 s share one upstream call. Quotes only; nothing is ever signed or sent.
 */
export const Route = createFileRoute("/api/quote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const parsed = parseQuoteParams(new URL(request.url).searchParams);
        if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
        const key = quoteCacheKey(parsed.value);
        const now = Date.now();
        const hit = cache.get(key);
        if (hit && now - hit.at < TTL_MS) return Response.json(hit.body, { status: hit.status, headers: NO_STORE });
        let status = 200;
        let body: unknown;
        try {
          const res = await fetch(buildQuoteUrl(parsed.value, JUPITER_LITE_API), {
            headers: jupHeaders({ accept: "application/json" }),
            signal: AbortSignal.timeout(8_000),
          });
          const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
          const quote = res.ok ? trimJupiterQuote(json) : null;
          if (quote) {
            body = { quote, at: now };
          } else {
            status = res.status >= 400 && res.status < 500 ? 422 : 502;
            body = { error: typeof json?.error === "string" ? json.error : "Quote unavailable", code: json?.errorCode ?? null };
          }
        } catch {
          status = 502;
          body = { error: "Quote unavailable" };
        }
        cache.set(key, { at: now, body, status });
        if (cache.size > 500) cache.delete(cache.keys().next().value!);
        return Response.json(body, { status, headers: NO_STORE });
      },
    },
  },
});
