import { useEffect, useState } from "react";

type Point = { t: number; p: number };

const cache = new Map<string, { at: number; points: Point[] }>();
const pending = new Map<string, Promise<Point[]>>();
const TTL_MS = 120_000;
const MAX_CONCURRENT = 2;
let active = 0;
const queue: Array<() => void> = [];

function runQueued<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active += 1;
      job()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          queue.shift()?.();
        });
    };
    if (active < MAX_CONCURRENT) start();
    else queue.push(start);
  });
}

function loadSparkline(mint: string): Promise<Point[]> {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.points);
  const inflight = pending.get(mint);
  if (inflight) return inflight;
  const job = runQueued(async () => {
    const res = await fetch(`/api/history?mint=${encodeURIComponent(mint)}&range=1D`);
    const body = (res.ok ? await res.json() : { points: [] }) as { points?: Point[] };
    const points = Array.isArray(body.points) ? body.points : [];
    if (points.length > 1) cache.set(mint, { at: Date.now(), points });
    return points;
  })
    .catch(() => hit?.points ?? [])
    .finally(() => pending.delete(mint));
  pending.set(mint, job);
  return job;
}

/** 24h mini chart for an asset row. Renders nothing until there is data. */
export function Sparkline({ mint, width = 72, height = 28 }: { mint: string; width?: number; height?: number }) {
  const [points, setPoints] = useState<Point[]>(() => cache.get(mint)?.points ?? []);

  useEffect(() => {
    let alive = true;
    const refresh = () => void loadSparkline(mint).then((next) => alive && next.length > 1 && setPoints(next));
    refresh();
    const timer = window.setInterval(refresh, TTL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [mint]);

  if (points.length < 2) return <span style={{ width, height }} className="shrink-0" aria-hidden />;

  const values = points.map((point) => point.p);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Floor the range at 0.5% of price so stablecoins draw flat instead of magnified noise.
  const span = Math.max(max - min, max * 0.005) || 1;
  const mid = (max + min) / 2;
  const lo = mid - span / 2;
  const pad = 2;
  const coords = points.map((point, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = pad + (1 - (point.p - lo) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const up = values[values.length - 1]! >= values[0]!;
  const color = up ? "#34d399" : "var(--color-danger)";
  const id = `spark-${mint.slice(0, 8)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-label={up ? "Up over 24 hours" : "Down over 24 hours"}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
