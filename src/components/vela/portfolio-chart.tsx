import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUsd } from "@/lib/vela/format";
import { PORTFOLIO_RANGES, type PortfolioRange, type SeriesPoint } from "@/lib/vela/portfolio-history";

type Holding = { mint: string; amount: number; price: number };

const cache = new Map<string, { at: number; points: SeriesPoint[] }>();
const TTL_MS = 120_000;

function label(t: number, range: PortfolioRange): string {
  const d = new Date(t);
  if (range === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return d.toLocaleString("en-US", { weekday: "short", hour: "numeric" });
  if (range === "1M") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const RANGE_WORD: Record<PortfolioRange, string> = { "1D": "today", "1W": "past week", "1M": "past month", "1Y": "past year" };

export function PortfolioChart({ holdings, total }: { holdings: Holding[]; total: number }) {
  const [range, setRange] = useState<PortfolioRange>("1D");
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
  const up = (delta ?? 0) >= 0;
  const values = series.map((point) => point.p);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const pad = (hi - lo) * 0.12 || hi * 0.01 || 1;
  const color = up ? "var(--color-accent)" : "var(--color-danger)";

  return (
    <div className="mt-4">
      <p className={`text-sm tabular-nums ${delta === null ? "text-muted" : up ? "text-accent" : "text-danger"}`}>
        {delta === null
          ? points === null
            ? "Loading history…"
            : "History unavailable right now"
          : `${up ? "+" : "−"}${formatUsd(Math.abs(delta))} (${up ? "+" : "−"}${Math.abs(pct ?? 0).toFixed(2)}%) ${RANGE_WORD[range]}`}
      </p>
      <div className="mt-2 h-36">
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis hide domain={[lo - pad, hi + pad]} />
              <Tooltip
                labelFormatter={(t) => label(Number(t), range)}
                formatter={(v) => [formatUsd(Number(v)), "Balance"]}
                contentStyle={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  color: "var(--color-fg)",
                }}
              />
              <Area type="monotone" dataKey="p" stroke={color} strokeWidth={2} fill="url(#portfolioFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-card border border-dashed border-line text-xs text-muted">
            {points === null ? "Loading chart…" : "Not enough price history yet"}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {PORTFOLIO_RANGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRange(item)}
            className={`h-8 flex-1 rounded-full font-mono text-xs ${
              range === item ? "bg-accent text-on-accent" : "border border-line text-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
