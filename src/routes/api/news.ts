import { createFileRoute } from "@tanstack/react-router";
import { loadNews } from "@/lib/vela/social.server";

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await loadNews());
        } catch {
          return Response.json({ headlines: [], trending: [], updatedAt: Date.now() });
        }
      },
    },
  },
});
