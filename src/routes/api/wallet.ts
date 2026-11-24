import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadWatchedWallet } from "@/lib/vela/helius.server";

export const Route = createFileRoute("/api/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
        if (!address) {
          return Response.json({ error: "address is required" }, { status: 400 });
        }
        if (!isSolanaAddress(address)) {
          return Response.json({ error: "invalid Solana address" }, { status: 400 });
        }
        try {
          const wallet = await loadWatchedWallet(address);
          return Response.json(wallet);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "HELIUS_UNAVAILABLE") {
            return Response.json(
              { error: "Live wallet data is unavailable. HELIUS_API_KEY is not configured on the server." },
              { status: 503 },
            );
          }
          return Response.json({ error: "Failed to load wallet from the network. Try again in a moment." }, { status: 502 });
        }
      },
    },
  },
});
