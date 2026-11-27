/**
 * Jupiter's API gateway. lite-api.jup.ag is being retired; api.jup.ag serves the same paths.
 * Without a key it allows about 0.5 requests/second per IP. Set JUPITER_API_KEY (free at
 * portal.jup.ag) on the server to raise the limit. The key never ships to the client.
 */
export const JUP_BASE = "https://api.jup.ag";

export function jupHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.JUPITER_API_KEY?.trim();
  return key ? { ...extra, "x-api-key": key } : { ...extra };
}

/** Headers for any URL: adds the Jupiter key only when the request goes to api.jup.ag. */
export function headersFor(url: string, extra: Record<string, string> = {}): Record<string, string> {
  return url.startsWith(JUP_BASE) ? jupHeaders(extra) : { ...extra };
}
