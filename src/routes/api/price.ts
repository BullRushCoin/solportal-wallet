import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadLivePrice } from "@/lib/vela/helius.server";

export const Route = createFileRoute("/api/price")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const mint = new URL(request.url).searchParams.get("mint")?.trim() ?? "";
        if (!isSolanaAddress(mint)) return Response.json({ error: "invalid mint" }, { status: 400 });
        try {
          const price = await loadLivePrice(mint);
          return Response.json(price, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json({ error: "price unavailable" }, { status: 502 });
        }
      },
    },
  },
});
