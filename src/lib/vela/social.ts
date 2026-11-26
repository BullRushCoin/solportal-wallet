export type Headline = {
  title: string;
  url: string;
  source: string;
  publishedAt: number | null;
  /** Article image from the feed (media:thumbnail, media:content, enclosure, or first <img>). */
  image?: string | null;
};
export type TrendingCoin = {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24hPct: number | null;
  image: string | null;
  decimals: number;
  /** Market cap reported by Jupiter, or null. */
  marketCapUsd?: number | null;
};
export type NewsSnapshot = { headlines: Headline[]; trending: TrendingCoin[]; updatedAt: number };
export type TokenLinks = { website: string | null; x: string | null; telegram: string | null; discord: string | null };

function unescapeAttr(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

function httpsImage(value: string | undefined): string | null {
  if (!value) return null;
  const url = unescapeAttr(value.trim());
  return /^https:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
}

/** Pull one image URL out of an RSS <item> block, or null. Pure: no network. */
export function rssItemImage(item: string): string | null {
  const attr = (pattern: RegExp) => httpsImage(item.match(pattern)?.[1]);
  const thumb = attr(/<media:thumbnail[^>]*\burl="([^"]+)"/i);
  if (thumb) return thumb;
  for (const match of item.matchAll(/<media:content\b([^>]*)>/gi)) {
    const attrs = match[1] ?? "";
    const url = httpsImage(attrs.match(/\burl="([^"]+)"/i)?.[1]);
    const type = attrs.match(/\btype="([^"]+)"/i)?.[1] ?? "";
    const medium = attrs.match(/\bmedium="([^"]+)"/i)?.[1] ?? "";
    if (url && (type.startsWith("image") || medium === "image" || (!type && !medium))) return url;
  }
  const enclosure = item.match(/<enclosure\b([^>]*)>/i)?.[1] ?? "";
  if (/\btype="image/i.test(enclosure)) {
    const url = httpsImage(enclosure.match(/\burl="([^"]+)"/i)?.[1]);
    if (url) return url;
  }
  const img = item.match(/<img[^>]+src=["']([^"']+)["']/i) ?? item.match(/&lt;img[^&]+src=(?:&quot;|")([^"&]+)/i);
  return httpsImage(img?.[1]);
}
