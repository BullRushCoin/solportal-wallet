import { createFileRoute } from "@tanstack/react-router";
import { isSolanaAddress } from "@/lib/vela/address";
import { type IncineratorInput } from "@/lib/vela/incinerator";
import { parseIncineratorTokenQuery } from "@/lib/vela/incinerator-parse";
import { loadIncineratorForAddress, loadIncineratorForHoldings } from "@/lib/vela/incinerator.server";

function readHoldings(url: URL, body: unknown): IncineratorInput[] {
  const fromQuery = parseIncineratorTokenQuery(url.searchParams.get("tokens"));
  if (fromQuery.length) return fromQuery;
  if (Array.isArray(body)) return body as IncineratorInput[];
  if (body && typeof body === "object" && Array.isArray((body as { tokens?: unknown }).tokens)) {
    return (body as { tokens: IncineratorInput[] }).tokens;
  }
  return [];
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const address = url.searchParams.get("address")?.trim() ?? "";
  let body: unknown = null;
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }
  try {
    if (address) {
      if (!isSolanaAddress(address)) {
        return Response.json({ error: "invalid Solana address" }, { status: 400 });
      }
      const plan = await loadIncineratorForAddress(address);
      return Response.json(plan);
    }
    const tokens = readHoldings(url, body);
    if (!tokens.length) {
      return Response.json({ error: "address or tokens is required" }, { status: 400 });
    }
    const plan = await loadIncineratorForHoldings(tokens);
    return Response.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "HELIUS_UNAVAILABLE") {
      return Response.json(
        { error: "Live wallet data is unavailable. HELIUS_API_KEY is not configured on the server." },
        { status: 503 },
      );
    }
    return Response.json({ error: "Failed to build an incinerator plan. Try again in a moment." }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/incinerator")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
