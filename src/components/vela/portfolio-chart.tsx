import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatUsd } from "@/lib/vela/format";
import { PORTFOLIO_RANGES, type PortfolioRange } from "@/lib/vela/portfolio-history";
import type { ChartTheme, PortfolioHistory } from "@/lib/vela/use-portfolio-history";

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
  theme,
}: {
  history: PortfolioHistory;
  range: PortfolioRange;
  onRange: (range: PortfolioRange) => void;
  /** Skin colors when drawn inside the balance card. */
  theme?: ChartTheme;
}) {
  const { series, points, up } = history;
  const values = series.map((point) => point.p);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 0;
  const pad = (hi - lo) * 0.12 || hi * 0.01 || 1;
  const color = theme?.line ?? (up ? "var(--color-accent)" : "var(--color-danger)");
  const fillOpacity = theme?.fillOpacity ?? 0.3;

  return (
    <div className={theme ? "" : "mt-4"}>
      <div className={theme ? "-mx-1 h-[92px]" : "h-32"}>
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis hide domain={[lo - pad, hi + pad]} />
              <Tooltip
                labelFormatter={(t) => label(Number(t), range)}
                formatter={(v) => [formatUsd(Number(v)), "Balance"]}
                cursor={{ stroke: color, strokeOpacity: 0.5, strokeDasharray: "3 3" }}
                wrapperStyle={{ zIndex: 5 }}
                itemStyle={{ color: "var(--color-accent)" }}
                labelStyle={{ color: "var(--color-muted)" }}
                contentStyle={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  color: "var(--color-fg)",
                }}
              />
              <Area
                type="monotone"
                dataKey="p"
                stroke={color}
                strokeWidth={theme ? 2.25 : 2}
                fill="url(#portfolioFill)"
                style={theme ? { filter: theme.lineShadow } : undefined}
                activeDot={{ r: 4, fill: color, stroke: theme?.tabActiveBg ?? "var(--color-bg)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="grid h-full place-items-center rounded-card border border-dashed border-line text-xs text-muted"
            style={theme ? { borderColor: theme.tabBorder, color: theme.tabFg } : undefined}
          >
            {points === null ? "Loading chart…" : "Not enough price history yet"}
          </div>
        )}
      </div>
      <div className={`flex justify-between gap-2 ${theme ? "mt-1.5" : "mt-2"}`}>
        {PORTFOLIO_RANGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onRange(item)}
            aria-pressed={range === item}
            className={`flex-1 rounded-full font-mono text-xs ${theme ? "h-7 border backdrop-blur-sm" : "h-8"} ${
              theme ? "" : range === item ? "bg-accent text-on-accent" : "border border-line text-muted"
            }`}
            style={
              theme
                ? range === item
                  ? { background: theme.tabActiveBg, color: theme.tabActiveFg, borderColor: theme.tabActiveBg }
                  : { background: theme.tabBg, color: theme.tabFg, borderColor: theme.tabBorder }
                : undefined
            }
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
