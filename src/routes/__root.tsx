import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { useEffect } from "react";
import { installCrashReporter } from "@/lib/vela/crash-report";
import { DEFAULT_CARD_SKIN_SRC } from "@/lib/vela/card-skins";
import appCss from "../styles.css?url";

const APP_NAME = "SolPortal";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "SolPortal is a non-custodial Solana wallet with Jupiter swaps, an Explore directory, and an in-app dApp signer.",
      },
      { name: "theme-color", content: "#09090b" },
      { name: "apple-mobile-web-app-title", content: "SolPortal" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      // Default Home balance-card skin; the card itself loads eagerly with high fetch priority.
      { rel: "preload", as: "image", type: "image/webp", href: DEFAULT_CARD_SKIN_SRC, fetchPriority: "high" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
    scripts: [
      { children: "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};" },
      { src: "/_vercel/insights/script.js", defer: true },
    ],
  }),
  component: RootDocument,
});

function CrashReporter() {
  useEffect(() => installCrashReporter(), []);
  return null;
}

/** Installable app: register the service worker on the real site only (not in embedded previews). */
function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.self !== window.top) return;
    if (!/^https:/.test(window.location.protocol)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

function RootDocument() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <CrashReporter />
        <ServiceWorker />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
