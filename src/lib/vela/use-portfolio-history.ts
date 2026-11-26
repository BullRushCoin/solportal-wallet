import { useEffect, useMemo, useState } from "react";
import { formatUsd } from "@/lib/vela/format";
import type { PortfolioRange, SeriesPoint } from "@/lib/vela/portfolio-history";

export type PortfolioHolding = { mint: string; amount: number; price: number };

export type PortfolioHistory = {
  /** `null` while loading. */
  points: SeriesPoint[] | null;
  series: SeriesPoint[];
  delta: number | null;
  pct: number | null;
  up: boolean;
};

const cache = new Map<string, { at: number; points: SeriesPoint[] }>();
const TTL_MS = 120_000;

export const RANGE_WORD: Record<PortfolioRange, string> = { "1D": "today", "1W": "past week", "1M": "past month", "1Y": "past year" };

export function usePortfolioHistory(holdings: PortfolioHolding[], total: number, range: PortfolioRange): PortfolioHistory {
  const [points, setPoints] = useState<SeriesPoint[] | null>(null);

  // Stable key: amounts rounded so live price ticks don't refetch history.
  const param = useMemo(
    () =>
      holdings
        .filter((item) => item.amount > 0)
        .map((item) => `${item.mint}:${Number(item.amount.toPrecision(8))}:${Number(item.price.toPrecision(2))}`)
        .sort()
        .join(","),
    [holdings],
  );

  useEffect(() => {
    if (!param) {
      setPoints([]);
      return;
    }
    const key = `${range}|${param}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      setPoints(hit.points);
      return;
    }
    setPoints(null);
    const controller = new AbortController();
    void fetch(`/api/portfolio-history?range=${range}&h=${encodeURIComponent(param)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ points?: SeriesPoint[] }>) : { points: [] }))
      .then((body) => {
        const next = body.points ?? [];
        if (next.length > 1) cache.set(key, { at: Date.now(), points: next });
        setPoints(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setPoints([]);
      });
    return () => controller.abort();
  }, [range, param]);

  const series = useMemo(() => {
    if (!points || points.length < 2) return points ?? [];
    const now = Date.now();
    const lastT = points[points.length - 1]!.t;
    return now > lastT ? [...points, { t: now, p: total }] : points;
  }, [points, total]);

  const first = series[0]?.p ?? null;
  const delta = first !== null && series.length > 1 ? total - first : null;
  const pct = delta !== null && first ? (delta / first) * 100 : null;
  return { points, series, delta, pct, up: (delta ?? 0) >= 0 };
}

/** Change line text for the balance card ("+$12.30 (+1.02%) today"). `up: null` = neutral. */
export function describeChange(history: PortfolioHistory, range: PortfolioRange): { text: string; up: boolean | null } {
  const { delta, pct, points } = history;
  if (delta === null) return { text: points === null ? "Loading history…" : "History unavailable right now", up: null };
  const up = delta >= 0;
  return {
    text: `${up ? "+" : "−"}${formatUsd(Math.abs(delta))} (${up ? "+" : "−"}${Math.abs(pct ?? 0).toFixed(2)}%) ${RANGE_WORD[range]}`,
    up,
  };
}
