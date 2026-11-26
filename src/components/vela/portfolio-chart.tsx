import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUsd } from "@/lib/vela/format";
import { PORTFOLIO_RANGES, type PortfolioRange } from "@/lib/vela/portfolio-history";
import type { PortfolioHistory } from "@/lib/vela/use-portfolio-history";

function label(t: number, range: PortfolioRange): string {
  const d = new Date(t);
  if (range === "1D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1W") return d.toLocaleString("en-US", { weekday: "short", hour: "numeric" });
  if (range === "1M") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Area chart + range tabs. History is fetched by `usePortfolioHistory` so the balance card can show the change line. */
export function PortfolioChart({
  history,
  range,
  onRange,
}: {
  history: PortfolioHistory;
  range: PortfolioRange;
  onRange: (range: PortfolioRange) => void;
}) {
  const { series, points, up } = history;
  const values = series.map((point) => point.p);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const pad = (hi - lo) * 0.12 || hi * 0.01 || 1;
  const color = up ? "var(--color-accent)" : "var(--color-danger)";

  return (
    <div className="mt-4">
      <div className="h-32">
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
            onClick={() => onRange(item)}
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
