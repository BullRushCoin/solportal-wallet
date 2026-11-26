/** Sends uncaught browser errors to /api/client-error (shows in Vercel logs). */
export function installCrashReporter(): void {
  if (typeof window === "undefined" || (window as { __spCrash?: boolean }).__spCrash) return;
  (window as { __spCrash?: boolean }).__spCrash = true;
  let sent = 0;
  const send = (message: string, stack?: string) => {
    if (sent++ > 10) return;
    const payload = JSON.stringify({ message, stack, url: location.pathname });
    try {
      if (!navigator.sendBeacon?.("/api/client-error", payload)) {
        void fetch("/api/client-error", { method: "POST", body: payload, keepalive: true });
      }
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("error", (event) => send(String(event.message), event.error instanceof Error ? event.error.stack : undefined));
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    send(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : undefined);
  });
}
