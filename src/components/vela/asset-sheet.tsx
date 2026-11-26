import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Globe, MessageCircle, Send as SendIcon, Wallet } from "lucide-react";
import type { TokenLinks } from "@/lib/vela/social";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmt, formatChangePct, formatUsd } from "@/lib/vela/format";
import { useVela, type AssetSheetToken } from "@/lib/vela/store";
import { Overlay, TokenMark } from "@/components/vela/ui";
import { WatchStar } from "@/components/vela/watch-star";

type Range = "1H" | "1D" | "1W";
type Point = { t: number; p: number };

const RANGES: Range[] = ["1H", "1D", "1W"];
const POLL_MS = 5_000;
const MAX_LIVE_POINTS = 240;

/** Price with enough precision for micro-caps ($0.0000221) and normal coins ($142.37). */
function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value === 0) return "0.00";
  const leadingZeros = Math.max(0, Math.floor(-Math.log10(value)));
  return value.toFixed(Math.min(12, leadingZeros + 4));
}

function splitPrice(value: number): { whole: string; frac: string } {
  const text = formatPrice(value);
  const dot = text.indexOf(".");
  return dot === -1 ? { whole: text, frac: "" } : { whole: text.slice(0, dot), frac: text.slice(dot) };
}

function timeLabel(t: number, range: Range): string {
  const d = new Date(t);
  if (range === "1W") return d.toLocaleString("en-US", { weekday: "short", hour: "numeric" });
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function AssetSheet({ token, amount, viewOnly }: { token: AssetSheetToken; amount: number; viewOnly?: boolean }) {
  const setSheet = useVela((state) => state.setSheet);
  const setMore = useVela((state) => state.setMore);
  const openSwap = useVela((state) => state.openSwap);

  const [range, setRange] = useState<Range>("1D");
  const [history, setHistory] = useState<Point[]>([]);
  const [live, setLive] = useState<Point[]>(() => (token.priceUsd ? [{ t: Date.now(), p: token.priceUsd }] : []));
  const [change24h, setChange24h] = useState<number | null>(token.change24hPct ?? null);
  const [isLive, setIsLive] = useState(false);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const lastPrice = useRef<number | null>(token.priceUsd);
  const [links, setLinks] = useState<TokenLinks | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/token-links?mint=${encodeURIComponent(token.mint)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<TokenLinks>) : null))
      .then((body) => body && setLinks(body))
      .catch(() => {});
    return () => controller.abort();
  }, [token.mint]);

  // Chart history for the selected range.
  useEffect(() => {
    const controller = new AbortController();
    setHistory([]);
    void fetch(`/api/history?mint=${encodeURIComponent(token.mint)}&range=${range}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { points: [] }))
      .then((body: { points?: Point[] }) => setHistory(Array.isArray(body.points) ? body.points : []))
      .catch(() => {});
    return () => controller.abort();
  }, [token.mint, range]);

  // Live price polling.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/price?mint=${encodeURIComponent(token.mint)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("price");
        const body = (await res.json()) as { priceUsd: number | null; change24hPct: number | null };
        if (stopped || body.priceUsd === null) return;
        const price = body.priceUsd;
        const prev = lastPrice.current;
        if (prev !== null && price !== prev) {
          setFlash(price > prev ? "up" : "down");
          window.setTimeout(() => setFlash(null), 600);
        }
        lastPrice.current = price;
        setChange24h(body.change24hPct);
        setIsLive(true);
        setLive((points) => [...points, { t: Date.now(), p: price }].slice(-MAX_LIVE_POINTS));
      } catch {
        if (!stopped) setIsLive(false);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token.mint]);

  const series = useMemo(() => {
    const lastHistoryT = history.length ? history[history.length - 1]!.t : 0;
    const merged = [...history, ...live.filter((point) => point.t > lastHistoryT)];
    // With no history (rate-limited or brand-new coin) the live ticks alone draw the chart.
    return merged.length ? merged : live;
  }, [history, live]);

  const price = lastPrice.current ?? token.priceUsd ?? null;
  const { whole, frac } = price !== null ? splitPrice(price) : { whole: "—", frac: "" };
  const values = series.map((point) => point.p);
  const hi = values.length ? Math.max(...values) : null;
  const lo = values.length ? Math.min(...values) : null;
  const pad = hi !== null && lo !== null ? (hi - lo || hi * 0.002) * 0.15 : 0;
  const last = series[series.length - 1];
  const value = price !== null ? amount * price : null;
  const up = (change24h ?? 0) >= 0;

  const swap = () =>
    openSwap({
      input: token.symbol,
      output: token.symbol === "USDC" ? "SOL" : "USDC",
      token: {
        symbol: token.symbol,
        name: token.name,
        mint: token.mint,
        decimals: token.decimals,
        priceUsd: price,
        image: token.image,
      },
    });

  return (
    <Overlay label={`${token.name} price`} onClose={() => setSheet(null)}>
      <div className="flex items-center justify-center gap-2">
        <span className="scale-75">
          <TokenMark symbol={token.symbol} src={token.image} />
        </span>
        <p className="text-base">
          {token.name}{" "}
          {change24h !== null ? (
            <span className={up ? "text-accent" : "text-danger"}>{formatChangePct(change24h)}</span>
          ) : null}
        </p>
        <span className="-mr-2">
          <WatchStar
            size="sm"
            item={{ mint: token.mint, symbol: token.symbol, name: token.name, decimals: token.decimals, image: token.image ?? null }}
          />
        </span>
      </div>

      <p
        className={`mt-2 text-center font-semibold tracking-tight tabular-nums transition-colors duration-500 ${
          flash === "up" ? "text-accent" : flash === "down" ? "text-danger" : ""
        }`}
      >
        <span className="align-top text-2xl text-muted">$</span>
        <span className="text-6xl">{whole}</span>
        <span className="text-2xl text-muted">{frac}</span>
      </p>

      <div className="mt-3 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">
          <span className={`size-2 rounded-full ${isLive ? "animate-pulse bg-emerald-400" : "bg-muted"}`} />
          {isLive ? "Live" : "Connecting…"}
        </span>
      </div>

      <div className="relative mt-5 h-56">
        {hi !== null ? (
          <p className="absolute top-0 left-0 z-10 font-mono text-xs text-muted">${formatPrice(hi)}</p>
        ) : null}
        {lo !== null ? (
          <p className="absolute bottom-0 left-0 z-10 font-mono text-xs text-muted">${formatPrice(lo)}</p>
        ) : null}
        {series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 20, right: 8, bottom: 20, left: 0 }}>
              <defs>
                <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis hide domain={[(lo ?? 0) - pad, (hi ?? 0) + pad]} />
              <Tooltip
                labelFormatter={(t) => timeLabel(Number(t), range)}
                formatter={(v) => [`$${formatPrice(Number(v))}`, "Price"]}
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
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                fill="url(#assetFill)"
                isAnimationActive={false}
              />
              {last ? (
                <ReferenceDot x={last.t} y={last.p} r={6} fill="var(--color-accent)" stroke="var(--color-fg)" strokeWidth={2} />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">Loading chart…</div>
        )}
      </div>

      <div className="mt-2 flex justify-center gap-2">
        {RANGES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRange(item)}
            className={`rounded-full px-3 py-1 font-mono text-xs ${
              range === item ? "bg-accent text-on-accent" : "border border-line text-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x divide-line rounded-card border border-line bg-surface-2 py-4 text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{formatAmt(amount, 4)}</p>
          <p className="mt-1 text-sm text-muted">{token.symbol}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value !== null ? formatUsd(value) : "—"}</p>
          <p className="mt-1 text-sm text-muted">Value</p>
        </div>
      </div>
      {links && (links.x || links.website || links.telegram || links.discord) ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {links.x ? <LinkChip label="X" icon={<XLogo />} url={links.x} /> : null}
          {links.telegram ? <LinkChip label="Telegram" icon={<SendIcon className="size-4" />} url={links.telegram} /> : null}
          {links.discord ? <LinkChip label="Discord" icon={<MessageCircle className="size-4" />} url={links.discord} /> : null}
          {links.website ? <LinkChip label="Website" icon={<Globe className="size-4" />} url={links.website} /> : null}
        </div>
      ) : null}
      {viewOnly ? <p className="mt-2 text-center text-xs text-muted">Watch only · actions use your sandbox wallet</p> : null}

      <div className="mt-5 grid grid-cols-4 gap-2">
        <Action icon={<Wallet className="size-5" />} label="Buy" primary onClick={() => { setSheet(null); setMore("buy"); }} />
        <Action icon={<ArrowLeftRight className="size-5" />} label="Swap" onClick={() => { setSheet(null); swap(); }} />
        <Action icon={<ArrowUpRight className="size-5" />} label="Send" onClick={() => setSheet({ kind: "send" })} />
        <Action icon={<ArrowDownLeft className="size-5" />} label="Receive" onClick={() => setSheet({ kind: "receive" })} />
      </div>
    </Overlay>
  );
}

function Action({ icon, label, onClick, primary }: { icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2">
      <span
        className={`grid size-14 place-items-center rounded-full ${
          primary ? "bg-accent text-on-accent" : "border border-line bg-surface-2 text-fg"
        }`}
      >
        {icon}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </button>
  );
}

function LinkChip({ label, icon, url }: { label: string; icon: React.ReactNode; url: string }) {
  return (
    <button
      type="button"
      onClick={() => useVela.getState().openExternal(url)}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface-2 px-3 text-sm"
    >
      {icon}
      {label}
    </button>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
    </svg>
  );
}
