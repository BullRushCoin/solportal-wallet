import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadPriceHistory, type ChartRange } from "@/lib/vela/helius.server";

const RANGES: ChartRange[] = ["1H", "1D", "1W", "1M", "1Y"];

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const mint = params.get("mint")?.trim() ?? "";
        const range = (params.get("range") ?? "1D").toUpperCase() as ChartRange;
        if (!isSolanaAddress(mint)) return Response.json({ error: "invalid mint" }, { status: 400 });
        if (!RANGES.includes(range)) return Response.json({ error: "invalid range" }, { status: 400 });
        const points = await loadPriceHistory(mint, range);
        return Response.json({ mint, range, points });
      },
    },
  },
});
