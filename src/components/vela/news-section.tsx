import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatChangePct, formatWhen } from "@/lib/vela/format";
import type { NewsSnapshot } from "@/lib/vela/social";
import { useVela } from "@/lib/vela/store";
import { TOKENS } from "@/lib/vela/tokens";
import { SectionLabel, TokenMark } from "@/components/vela/ui";

const REFRESH_MS = 5 * 60_000;

function priceText(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1) return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  const zeros = Math.max(0, Math.floor(-Math.log10(value)));
  return `$${value.toFixed(Math.min(10, zeros + 4))}`;
}

export function NewsSection() {
  const setSheet = useVela((state) => state.setSheet);
  const holdings = useVela((state) => state.holdings);
  const [news, setNews] = useState<NewsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/news")
        .then((res) => (res.ok ? (res.json() as Promise<NewsSnapshot>) : Promise.reject(new Error("news"))))
        .then((body) => alive && (setNews(body), setFailed(false)))
        .catch(() => alive && setFailed(true));
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!news) {
    return <p className="mt-6 text-sm text-muted">{failed ? "News is unavailable right now." : "Loading news…"}</p>;
  }

  return (
    <>
      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <SectionLabel>Trending on Solana</SectionLabel>
          <span className="text-xs text-muted">Jupiter · last hour</span>
        </div>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {news.trending.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">No trending data right now.</li>
          ) : (
            news.trending.map((coin, index) => {
              const known = TOKENS.find((token) => token.mint === coin.mint);
              const amount = known ? (holdings[known.symbol] ?? 0) : 0;
              return (
                <li key={coin.mint}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-3 text-left"
                    onClick={() =>
                      setSheet({
                        kind: "asset",
                        amount,
                        token: {
                          symbol: coin.symbol,
                          name: coin.name,
                          mint: coin.mint,
                          decimals: coin.decimals,
                          priceUsd: coin.priceUsd,
                          change24hPct: coin.change24hPct,
                          image: coin.image,
                        },
                      })
                    }
                  >
                    <span className="w-5 font-mono text-xs text-muted">{index + 1}</span>
                    <TokenMark symbol={coin.symbol} src={coin.image} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{coin.symbol}</span>
                      <span className="block truncate text-xs text-muted">{coin.name}</span>
                    </span>
                    <span className="min-w-[5rem] text-right">
                      <span className="block text-sm tabular-nums">{priceText(coin.priceUsd)}</span>
                      {coin.change24hPct !== null ? (
                        <span className={`block text-xs tabular-nums ${coin.change24hPct >= 0 ? "text-emerald-400" : "text-danger"}`}>
                          {formatChangePct(coin.change24hPct)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div className="mt-6">
        <SectionLabel>Solana headlines</SectionLabel>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {news.headlines.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">No headlines right now.</li>
          ) : (
            news.headlines.map((item) => (
              <li key={item.url}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  onClick={() => useVela.getState().openExternal(item.url)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-medium text-pretty">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {item.source}
                      {item.publishedAt ? ` · ${formatWhen(item.publishedAt)}` : ""}
                    </span>
                  </span>
                  <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted" />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}
