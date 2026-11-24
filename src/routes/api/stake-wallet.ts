import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { loadWatchedWallet } from "@/lib/vela/helius.server";
import { loadWatchedStake, mergeWatchedLstHoldings } from "@/lib/vela/stake.server";

export const Route = createFileRoute("/api/stake-wallet")({
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
          const stake = await loadWatchedStake(address);
          try {
            const wallet = await loadWatchedWallet(address);
            const solPrice = wallet.sol.priceUsd;
            const merged = mergeWatchedLstHoldings(
              stake,
              wallet.tokens.map((token) => ({
                mint: token.mint,
                symbol: token.symbol,
                amount: token.amount,
                priceUsd: token.priceUsd,
                valueUsd: token.valueUsd,
                image: token.image,
              })),
              solPrice,
            );
            return Response.json(merged);
          } catch {
            return Response.json(stake);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "HELIUS_UNAVAILABLE") {
            return Response.json(
              { error: "Live staking data is unavailable. HELIUS_API_KEY is not configured on the server." },
              { status: 503 },
            );
          }
          return Response.json({ error: "Failed to load staking positions. Try again in a moment." }, { status: 502 });
        }
      },
    },
  },
});
