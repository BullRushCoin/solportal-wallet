import { createFileRoute } from "@tanstack/react-router";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

/**
 * Optional in-app devnet faucet. Solana closed the public RPC faucet, so this drips a little
 * devnet SOL from a SolPortal-owned devnet wallet when DEVNET_FAUCET_SECRET (a JSON array of the
 * devnet keypair's 64 secret-key bytes) is set in Vercel. Devnet SOL has no value.
 * Without it, the app sends people to faucet.solana.com.
 */
const DRIP_SOL = 0.5;
const COOLDOWN_MS = 60 * 60_000;
const lastDrip = new Map<string, number>();

function faucetKey(): Keypair | null {
  const raw = process.env.DEVNET_FAUCET_SECRET?.trim();
  if (!raw) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

function rpc(): string {
  const key = process.env.HELIUS_API_KEY?.trim();
  return key ? `https://devnet.helius-rpc.com/?api-key=${key}` : "https://api.devnet.solana.com";
}

export const Route = createFileRoute("/api/devnet-faucet")({
  server: {
    handlers: {
      GET: async () => Response.json({ enabled: Boolean(faucetKey()), dripSol: DRIP_SOL }, { headers: { "cache-control": "no-store" } }),
      POST: async ({ request }) => {
        const faucet = faucetKey();
        if (!faucet) return Response.json({ error: "faucet-off" }, { status: 503 });
        let to: PublicKey;
        try {
          const body = (await request.json()) as { address?: string };
          to = new PublicKey(String(body.address ?? ""));
        } catch {
          return Response.json({ error: "bad-address" }, { status: 400 });
        }
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        const now = Date.now();
        for (const id of [to.toBase58(), ip]) {
          const last = lastDrip.get(id);
          if (last && now - last < COOLDOWN_MS) return Response.json({ error: "cooldown" }, { status: 429 });
        }
        try {
          const connection = new Connection(rpc(), "confirmed");
          const balance = await connection.getBalance(faucet.publicKey);
          if (balance < (DRIP_SOL + 0.01) * LAMPORTS_PER_SOL) return Response.json({ error: "faucet-empty" }, { status: 503 });
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          const tx = new Transaction({ feePayer: faucet.publicKey, blockhash, lastValidBlockHeight }).add(
            SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: to, lamports: Math.round(DRIP_SOL * LAMPORTS_PER_SOL) }),
          );
          tx.sign(faucet);
          const signature = await connection.sendRawTransaction(tx.serialize());
          lastDrip.set(to.toBase58(), now);
          lastDrip.set(ip, now);
          return Response.json({ signature });
        } catch {
          return Response.json({ error: "send-failed" }, { status: 502 });
        }
      },
    },
  },
});
