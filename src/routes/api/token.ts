import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { lookupToken } from "@/lib/vela/helius.server";

export const Route = createFileRoute("/api/token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const mint = new URL(request.url).searchParams.get("mint")?.trim() ?? "";
        if (!mint) {
          return Response.json({ error: "mint is required" }, { status: 400 });
        }
        if (!isSolanaAddress(mint)) {
          return Response.json({ error: "That doesn't look like a Solana token address." }, { status: 400 });
        }
        try {
          const token = await lookupToken(mint);
          if (!token) {
            return Response.json({ error: "No token found at that address." }, { status: 404 });
          }
          return Response.json(token);
        } catch {
          return Response.json({ error: "Couldn't reach token data. Try again in a moment." }, { status: 502 });
        }
      },
    },
  },
});
