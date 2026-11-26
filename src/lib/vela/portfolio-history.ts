export type PortfolioRange = "1D" | "1W" | "1M" | "1Y";
export const PORTFOLIO_RANGES: PortfolioRange[] = ["1D", "1W", "1M", "1Y"];

export type SeriesPoint = { t: number; p: number };
export type HoldingSeries = { amount: number; points: SeriesPoint[]; fallbackPrice: number };

/**
 * Value of today's holdings over time: amount × price at each timestamp.
 * Uses the densest series as the time grid and carries each token's last
 * known price forward (or back, before its first candle). Tokens with no
 * history count at their current price, so the line still sums to the
 * balance shown on Home.
 */
export function combinePortfolio(holdings: HoldingSeries[]): SeriesPoint[] {
  const withHistory = holdings.filter((item) => item.points.length > 1);
  if (withHistory.length === 0) return [];
  const grid = [...withHistory].sort((a, b) => b.points.length - a.points.length)[0]!.points.map((point) => point.t);
  const flat = holdings
    .filter((item) => item.points.length <= 1)
    .reduce((sum, item) => sum + item.amount * (item.points[0]?.p ?? item.fallbackPrice), 0);

  const cursors = withHistory.map(() => 0);
  return grid.map((t) => {
    let total = flat;
    withHistory.forEach((item, index) => {
      const pts = item.points;
      let i = cursors[index]!;
      while (i + 1 < pts.length && pts[i + 1]!.t <= t) i += 1;
      cursors[index] = i;
      const price = pts[i]!.t <= t ? pts[i]!.p : pts[0]!.p;
      total += item.amount * price;
    });
    return { t, p: total };
  });
}

/** Parse "mint:amount,mint:amount" (max 20 entries). */
export function parseHoldingsParam(value: string | null): Array<{ mint: string; amount: number; price: number }> {
  if (!value) return [];
  return value
    .split(",")
    .slice(0, 20)
    .map((part) => {
      const [mint = "", amount = "", price = ""] = part.split(":");
      return { mint: mint.trim(), amount: Number(amount), price: Number(price) || 0 };
    })
    .filter((item) => item.mint && Number.isFinite(item.amount) && item.amount > 0);
}
