import { createFileRoute } from "@tanstack/react-router";
import { loadMemeFeed } from "@/lib/vela/memecoins.server";

export const Route = createFileRoute("/api/memecoins")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const feed = await loadMemeFeed();
          return Response.json(feed, { headers: { "cache-control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30" } });
        } catch {
          return Response.json({ error: "feed unavailable" }, { status: 502 });
        }
      },
    },
  },
});
