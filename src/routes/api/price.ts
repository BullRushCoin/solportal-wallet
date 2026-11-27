import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadLivePrice } from "@/lib/vela/helius.server";

const SOL_MINT = "So11111111111111111111111111111111111111112";

export const Route = createFileRoute("/api/price")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // No mint means SOL, so a bare /api/price answers with the SOL price instead of an error.
        const mint = new URL(request.url).searchParams.get("mint")?.trim() || SOL_MINT;
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
