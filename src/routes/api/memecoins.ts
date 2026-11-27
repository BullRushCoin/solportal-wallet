import { createFileRoute } from "@tanstack/react-router";
import { loadMemeFeed } from "@/lib/vela/memecoins.server";

export const Route = createFileRoute("/api/memecoins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const view = new URL(request.url).searchParams.get("view") === "trending" ? "trending" : "new";
          const feed = await loadMemeFeed(view);
          return Response.json(feed, { headers: { "cache-control": "public, max-age=10, s-maxage=15, stale-while-revalidate=30" } });
        } catch {
          return Response.json({ error: "feed unavailable" }, { status: 502 });
        }
      },
    },
  },
});
