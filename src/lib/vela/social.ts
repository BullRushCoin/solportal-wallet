export type Headline = { title: string; url: string; source: string; publishedAt: number | null };
export type TrendingCoin = {
  mint: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  change24hPct: number | null;
  image: string | null;
  decimals: number;
};
export type NewsSnapshot = { headlines: Headline[]; trending: TrendingCoin[]; updatedAt: number };
export type TokenLinks = { website: string | null; x: string | null; telegram: string | null; discord: string | null };
