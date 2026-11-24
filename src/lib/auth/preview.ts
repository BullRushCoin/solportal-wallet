/**
 * Shared LIVE-PREVIEW OAuth client (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL, which can't be pre-registered per app. The broker instead exposes ONE
 * shared "preview" client that accepts any
 * `https://*.grok-sandbox.com/api/auth/oauth2/callback/*`
 * (broker: `app-builder-deployer/auth/src/preview-oauth.ts`).
 *
 * When federated sign-in is on, the preview client id/secret come from
 * `GROK_PREVIEW_CLIENT_ID` / `GROK_PREVIEW_CLIENT_SECRET` (or the deployer-
 * injected `GROK_AUTH_*` overrides in `server.ts`). They are not committed.
 * With `VITE_AUTH_ENABLED=false` (the shipped default) the secret is unused
 * and the app still builds.
 *
 * The preview secret must match the broker's `GROK_PREVIEW_CLIENT_SECRET`
 * (the broker stores only the secret's `base64url(SHA-256)` hash). This is a
 * dedicated, low-privilege client (preview-only, `*.grok-sandbox.com`).
 */
function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

export const PREVIEW_CLIENT_ID = readEnv("GROK_PREVIEW_CLIENT_ID") ?? "grok_preview";

/** Undefined when unset — never bake a secret into the repo. */
export const PREVIEW_CLIENT_SECRET = readEnv("GROK_PREVIEW_CLIENT_SECRET");

/** The shared auth broker issuer (OIDC discovery lives under it). */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/**
 * Host patterns whose callbacks the preview client accepts. Better Auth derives
 * the live preview's real origin from the request host and validates it against
 * this list (wildcard-matched), so the OAuth `redirect_uri` becomes the concrete
 * `https://<preview-host>/api/auth/oauth2/callback/...` the broker allows.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
