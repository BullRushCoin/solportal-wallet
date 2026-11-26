/** Decide from response headers whether a page allows being shown in another site's iframe. */
export function frameAllowed(headers: { xFrameOptions: string | null; csp: string | null }, embedderHost: string): boolean {
  const xfo = headers.xFrameOptions?.trim().toLowerCase() ?? "";
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return false;
  const csp = headers.csp?.toLowerCase() ?? "";
  const match = csp.match(/frame-ancestors([^;]*)/);
  if (!match) return true;
  const sources = match[1]!.trim().split(/\s+/).filter(Boolean);
  if (sources.includes("*")) return true;
  if (sources.length === 0 || sources.includes("'none'")) return false;
  return sources.some((source) => {
    const host = source.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host.startsWith("*.")) return embedderHost.endsWith(host.slice(1));
    return host === embedderHost;
  });
}

/** Block localhost, IP literals, and internal names so the checker can't probe private networks. */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[")) return false;
  return true;
}
