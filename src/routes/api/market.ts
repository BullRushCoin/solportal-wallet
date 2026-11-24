import { createFileRoute } from "@tanstack/react-router";
import { fallbackMarketSnapshot } from "@/lib/vela/market";
import { loadMarketSnapshot } from "@/lib/vela/helius.server";

export const Route = createFileRoute("/api/market")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const snapshot = await loadMarketSnapshot();
          return Response.json(snapshot);
        } catch {
          return Response.json(fallbackMarketSnapshot());
        }
      },
    },
  },
});
