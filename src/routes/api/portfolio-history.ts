import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadPriceHistory } from "@/lib/vela/helius.server";
import { combinePortfolio, parseHoldingsParam, PORTFOLIO_RANGES, type PortfolioRange } from "@/lib/vela/portfolio-history";

const STABLES = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PYUSD
]);
const MAX_LOOKUPS = 6; // GeckoTerminal free tier is ~30 calls/min; keep each request light.

export const Route = createFileRoute("/api/portfolio-history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const range = (params.get("range") ?? "1D").toUpperCase() as PortfolioRange;
        if (!PORTFOLIO_RANGES.includes(range)) return Response.json({ error: "invalid range" }, { status: 400 });
        const holdings = parseHoldingsParam(params.get("h")).filter((item) => isSolanaAddress(item.mint));
        if (!holdings.length) return Response.json({ range, points: [] });

        const ranked = [...holdings].sort((a, b) => b.amount * b.price - a.amount * a.price);
        let lookups = 0;
        const series = [];
        for (const item of ranked) {
          const value = item.amount * item.price;
          const worthIt = !STABLES.has(item.mint) && value >= 0.01 && lookups < MAX_LOOKUPS;
          let points: Array<{ t: number; p: number }> = [];
          if (worthIt) {
            lookups += 1;
            points = await loadPriceHistory(item.mint, range).catch(() => []);
          }
          series.push({ amount: item.amount, points, fallbackPrice: item.price });
        }
        return Response.json({ range, points: combinePortfolio(series) });
      },
    },
  },
});
