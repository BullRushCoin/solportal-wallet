import { createFileRoute } from "@tanstack/react-router";
import { fallbackExploreSnapshot } from "@/lib/vela/explore";
import { loadExploreSnapshot } from "@/lib/vela/explore.server";

export const Route = createFileRoute("/api/explore")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const snapshot = await loadExploreSnapshot();
          return Response.json(snapshot);
        } catch {
          return Response.json(fallbackExploreSnapshot());
        }
      },
    },
  },
});
