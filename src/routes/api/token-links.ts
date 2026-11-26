import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadTokenLinks } from "@/lib/vela/social.server";

export const Route = createFileRoute("/api/token-links")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const mint = new URL(request.url).searchParams.get("mint")?.trim() ?? "";
        if (!isSolanaAddress(mint)) return Response.json({ error: "invalid mint" }, { status: 400 });
        return Response.json(await loadTokenLinks(mint));
      },
    },
  },
});
