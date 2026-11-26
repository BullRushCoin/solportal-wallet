import { createFileRoute } from "@tanstack/react-router";
import { looksLikePhrase } from "@/lib/vela/support-kb";

/**
 * Forwards an escalated support question to the owner's inbox.
 * The destination lives only in the SUPPORT_EMAIL server env var; it is never
 * sent to the browser. Delivery uses FormSubmit (free, no API key).
 */
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

function limited(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > MAX_PER_WINDOW;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const kept = Array.from(value).filter((ch) => {
    const code = ch.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || code >= 32;
  });
  return kept.join("").trim().slice(0, max);
}

async function handle(request: Request): Promise<Response> {
  const to = process.env.SUPPORT_EMAIL?.trim();
  if (!to) return Response.json({ ok: false, error: "Support inbox is not configured yet." }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (clean(body.website, 100)) return Response.json({ ok: true }); // honeypot

  const question = clean(body.question, 2000);
  const contact = clean(body.contact, 200);
  const topic = clean(body.topic, 80) || "General";
  const wallet = clean(body.wallet, 64);
  const transcript = clean(body.transcript, 4000);
  if (question.length < 5) return Response.json({ ok: false, error: "Please describe the issue." }, { status: 400 });
  if (looksLikePhrase(question)) {
    return Response.json({ ok: false, error: "That looks like a recovery phrase. Never share it, not even with support." }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (limited(ip)) return Response.json({ ok: false, error: "Too many messages. Try again in a few minutes." }, { status: 429 });

  const message = [
    `Question: ${question}`,
    `Topic: ${topic}`,
    `Reply to: ${contact || "not given"}`,
    `Active wallet: ${wallet || "unknown"}`,
    "",
    "Chat so far:",
    transcript || "(none)",
  ].join("\n");

  try {
    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.SUPPORT_FROM?.trim() || "SolPortal Support <onboarding@resend.dev>",
          to: [to.toLowerCase()],
          subject: `SolPortal support: ${topic}`,
          text: message,
          ...(contact.includes("@") ? { reply_to: contact } : {}),
        }),
      });
      if (!res.ok) throw new Error(`resend ${res.status}`);
      return Response.json({ ok: true });
    }
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Referer: "https://solportal-wallet.vercel.app/" },
      body: JSON.stringify({
        _subject: `SolPortal support: ${topic}`,
        _template: "box",
        _captcha: "false",
        ...(contact.includes("@") ? { _replyto: contact } : {}),
        name: "SolPortal Support Bot",
        message,
      }),
    });
    const out = (await res.json().catch(() => ({}))) as { success?: string | boolean };
    if (!res.ok || String(out.success) === "false") throw new Error("send failed");
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[support] send failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "Couldn't reach the support inbox. Try again shortly." }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/support")({
  server: { handlers: { POST: async ({ request }) => handle(request) } },
});
