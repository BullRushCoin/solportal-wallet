import { createFileRoute } from "@tanstack/react-router";
import { frameAllowed, isPublicHost } from "@/lib/vela/frame-policy";
import { safeHttpUrl } from "@/lib/vela/open-url";

const cache = new Map<string, { at: number; embeddable: boolean }>();
const TTL_MS = 60 * 60_000;

export const Route = createFileRoute("/api/frame-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const self = new URL(request.url);
        const target = safeHttpUrl(self.searchParams.get("url") ?? "");
        if (!target) return Response.json({ embeddable: false, error: "invalid url" }, { status: 400 });
        const url = new URL(target);
        if (!isPublicHost(url.hostname)) return Response.json({ embeddable: false, error: "host not allowed" }, { status: 400 });
        const key = url.origin + url.pathname;
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < TTL_MS) return Response.json({ embeddable: hit.embeddable });
        try {
          const res = await fetch(url, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" },
            signal: AbortSignal.timeout(6000),
          });
          void res.body?.cancel();
          const embeddable = frameAllowed(
            { xFrameOptions: res.headers.get("x-frame-options"), csp: res.headers.get("content-security-policy") },
            self.hostname,
          );
          cache.set(key, { at: Date.now(), embeddable });
          return Response.json({ embeddable });
        } catch {
          // Unknown: let the client try the frame; it shows the Safari fallback beside it.
          return Response.json({ embeddable: true, uncertain: true });
        }
      },
    },
  },
});
