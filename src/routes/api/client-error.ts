import { createFileRoute } from "@tanstack/react-router";

/** Client crash reports. Logged to Vercel runtime logs only; nothing is stored. */
const hits = new Map<string, { n: number; t: number }>();

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value.slice(0, max)) {
    const code = ch.charCodeAt(0);
    out += code === 10 || code >= 32 ? ch : " ";
  }
  return out;
}

export const Route = createFileRoute("/api/client-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const now = Date.now();
        const hit = hits.get(ip);
        if (hit && now - hit.t < 60_000) {
          if (++hit.n > 20) return new Response(null, { status: 204 });
        } else hits.set(ip, { n: 1, t: now });
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(await request.text()) as Record<string, unknown>;
        } catch {
          return new Response(null, { status: 204 });
        }
        console.error(
          "[client-error]",
          JSON.stringify({
            message: text(body.message, 500),
            stack: text(body.stack, 2000),
            url: text(body.url, 300),
            ua: text(request.headers.get("user-agent"), 200),
          }),
        );
        return new Response(null, { status: 204 });
      },
    },
  },
});
