import { createFileRoute } from "@tanstack/react-router";

/**
 * Devnet JSON-RPC proxy. Keeps the Helius key on the server and only forwards the
 * handful of methods the devnet wallet needs. Devnet SOL has no value.
 */
const ALLOWED = new Set([
  "getBalance",
  "getLatestBlockhash",
  "sendTransaction",
  "simulateTransaction",
  "getSignatureStatuses",
  "requestAirdrop",
  "getMinimumBalanceForRentExemption",
  "getAccountInfo",
  "getParsedTokenAccountsByOwner",
  "getTokenAccountsByOwner",
  "getSignaturesForAddress",
  "getFeeForMessage",
  "getVersion",
  "getSlot",
]);

const PUBLIC_DEVNET = "https://api.devnet.solana.com";

function heliusDevnet(): string | null {
  const key = process.env.HELIUS_API_KEY?.trim();
  return key ? `https://devnet.helius-rpc.com/?api-key=${key}` : null;
}

async function forward(url: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function hasRpcError(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.some((item) => item && typeof item === "object" && "error" in (item as Record<string, unknown>));
  } catch {
    return true;
  }
}

export const Route = createFileRoute("/api/devnet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        if (body.length > 64_000) return Response.json({ error: "too large" }, { status: 413 });
        let calls: Array<{ method?: unknown }>;
        try {
          const parsed = JSON.parse(body) as unknown;
          calls = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{ method?: unknown }>;
        } catch {
          return Response.json({ error: "bad json" }, { status: 400 });
        }
        if (calls.length === 0 || calls.length > 10 || calls.some((call) => typeof call.method !== "string" || !ALLOWED.has(call.method))) {
          return Response.json({ error: "method not allowed" }, { status: 403 });
        }
        const isAirdrop = calls.some((call) => call.method === "requestAirdrop");
        const primary = heliusDevnet() ?? PUBLIC_DEVNET;
        try {
          let res = await forward(primary, body);
          let text = await res.text();
          // The faucet is flaky on any one provider; try the public devnet node for airdrops.
          if (isAirdrop && primary !== PUBLIC_DEVNET && (!res.ok || hasRpcError(text))) {
            res = await forward(PUBLIC_DEVNET, body);
            text = await res.text();
          }
          return new Response(text, {
            status: res.status,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch {
          return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Devnet RPC unreachable" } }, { status: 502 });
        }
      },
    },
  },
});
