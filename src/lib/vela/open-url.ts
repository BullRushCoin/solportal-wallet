/**
 * Allow only http(s) URLs before opening them in a real browser tab.
 * javascript:, data:, file:, and other schemes are rejected.
 */
export function safeHttpUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const candidate =
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function openSafeHttpUrl(input: string): boolean {
  const url = safeHttpUrl(input);
  if (!url || typeof window === "undefined" || typeof window.open !== "function") return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
