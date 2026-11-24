import { createFileRoute } from "@tanstack/react-router";
import { fallbackStakeMarket } from "@/lib/vela/stake";
import { loadStakeMarket } from "@/lib/vela/stake.server";

export const Route = createFileRoute("/api/stake")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await loadStakeMarket());
        } catch {
          return Response.json(fallbackStakeMarket());
        }
      },
    },
  },
});
