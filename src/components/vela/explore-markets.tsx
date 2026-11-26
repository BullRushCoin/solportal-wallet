import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Heart } from "lucide-react";
import { formatCompactUsd } from "@/lib/vela/format";
import { formatCount, formatTokenPrice } from "@/lib/vela/explore-search";
import { sortMemeCoins, type MemeCoin, type MemeFeed } from "@/lib/vela/memecoins";
import { openCoinSheet } from "@/lib/vela/open-coin";
import type { NewsSnapshot } from "@/lib/vela/social";
import { useVela } from "@/lib/vela/store";
import { useLivePrices } from "@/lib/vela/use-live";
import { ChangeText, CoinImage, SectionHeader } from "@/components/vela/explore-ui";

type Row = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number | null;
  image: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  capLabel: "MC" | "FDV";
  change24hPct: number | null;
};

function fromMeme(coin: MemeCoin): Row {
  return {
    mint: coin.mint,
    symbol: coin.symbol,
    name: coin.name,
    decimals: coin.decimals,
    image: coin.image,
    priceUsd: coin.priceUsd,
    marketCapUsd: coin.marketCapUsd,
    capLabel: coin.marketCapKind === "fdv" ? "FDV" : "MC",
    change24hPct: null,
  };
}

// ---------- Hot Markets ----------

export function HotMarkets({ feed, loading }: { feed: MemeFeed | null; loading: boolean }) {
  const coins = useMemo(() => (feed ? sortMemeCoins(feed.coins, "trending").slice(0, 10) : []), [feed]);
  const mints = useMemo(() => coins.map((coin) => coin.mint), [coins]);
  const prices = useLivePrices(mints, 30_000);

  return (
    <section className="mt-7">
      <div className="px-5">
        <SectionHeader title="Hot Markets" onMore={() => useVela.getState().setTab("market")} />
      </div>
      <div className="mt-2 flex snap-x gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {coins.length === 0
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-[8.5rem] w-40 shrink-0 rounded-card border border-line bg-surface p-3">
                {loading ? <div className="h-full animate-pulse rounded-control bg-surface-2/60" /> : i === 0 ? <p className="text-xs text-muted">Live market data is unavailable right now.</p> : null}
              </div>
            ))
          : coins.map((coin) => <HotCard key={coin.mint} coin={coin} change={prices[coin.mint]?.change24hPct ?? null} livePrice={prices[coin.mint]?.priceUsd ?? null} />)}
      </div>
    </section>
  );
}

function HotCard({ coin, change, livePrice }: { coin: MemeCoin; change: number | null; livePrice: number | null }) {
  const buys = coin.buys24h;
  const sells = coin.sells24h;
  const trades = buys !== null || sells !== null ? (buys ?? 0) + (sells ?? 0) : null;
  const hasChange = change !== null && Number.isFinite(change);
  return (
    <button
      type="button"
      onClick={() => openCoinSheet({ ...coin, priceUsd: livePrice ?? coin.priceUsd, change24hPct: change })}
      className="flex w-40 shrink-0 snap-start flex-col rounded-card border border-line bg-surface p-3 text-left transition active:scale-[0.98]"
    >
      <span className="flex items-center gap-2">
        <CoinImage src={coin.image} symbol={coin.symbol} small />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{coin.symbol}</span>
          <span className="block truncate text-[11px] text-muted">
            {coin.marketCapUsd !== null ? `${coin.marketCapKind === "fdv" ? "FDV" : "MC"} ${formatCompactUsd(coin.marketCapUsd)}` : "MC —"}
          </span>
        </span>
      </span>
      <span className="mt-3 flex">
        {hasChange ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${change >= 0 ? "bg-emerald-400/15 text-emerald-400" : "bg-danger/15 text-danger"}`}>
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        ) : trades !== null ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular-nums"
            aria-label={`${buys ?? 0} buys, ${sells ?? 0} sells in 24h`}
          >
            <span className="inline-flex items-center text-emerald-400">
              <ArrowUp className="size-3" aria-hidden />
              {formatCount(buys ?? 0)}
            </span>
            <span className="inline-flex items-center text-danger">
              <ArrowDown className="size-3" aria-hidden />
              {formatCount(sells ?? 0)}
            </span>
          </span>
        ) : (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">—</span>
        )}
      </span>
      {trades !== null ? (
        <span className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          <span className="truncate">{formatCount(trades)} trades in 24h</span>
        </span>
      ) : null}
    </button>
  );
}

// ---------- Explore Markets ----------

const CHIPS = [
  { id: "watchlist", label: "Watchlist" },
  { id: "trending", label: "Trending" },
  { id: "memes", label: "Memes" },
  { id: "new", label: "New" },
] as const;
type Chip = (typeof CHIPS)[number]["id"];

export function ExploreMarkets({ feed, news }: { feed: MemeFeed | null; news: NewsSnapshot | null }) {
  const watchlist = useVela((state) => state.watchlist);
  const [chip, setChip] = useState<Chip>("trending");
  const [expanded, setExpanded] = useState(false);

  const all = useMemo<Row[]>(() => {
    const memes = feed?.coins ?? [];
    const memeByMint = new Map(memes.map((coin) => [coin.mint, coin]));
    const trendByMint = new Map((news?.trending ?? []).map((coin) => [coin.mint, coin]));
    if (chip === "watchlist") {
      return watchlist.map((item) => {
        const meme = memeByMint.get(item.mint);
        const trend = trendByMint.get(item.mint);
        return {
          mint: item.mint,
          symbol: item.symbol,
          name: item.name,
          decimals: item.decimals,
          image: item.image ?? meme?.image ?? trend?.image ?? null,
          priceUsd: meme?.priceUsd ?? trend?.priceUsd ?? null,
          marketCapUsd: trend?.marketCapUsd ?? meme?.marketCapUsd ?? null,
          capLabel: !trend?.marketCapUsd && meme?.marketCapKind === "fdv" ? "FDV" : "MC",
          change24hPct: trend?.change24hPct ?? null,
        };
      });
    }
    if (chip === "trending") {
      return (news?.trending ?? []).map((coin) => ({
        mint: coin.mint,
        symbol: coin.symbol,
        name: coin.name,
        decimals: coin.decimals,
        image: coin.image,
        priceUsd: coin.priceUsd,
        marketCapUsd: coin.marketCapUsd ?? null,
        capLabel: "MC",
        change24hPct: coin.change24hPct,
      }));
    }
    return sortMemeCoins(memes, chip === "new" ? "new" : "volume").map(fromMeme);
  }, [chip, feed, news, watchlist]);

  const rows = useMemo(() => all.slice(0, expanded ? 15 : 5), [all, expanded]);
  const mints = useMemo(() => rows.map((row) => row.mint), [rows]);
  const prices = useLivePrices(mints, 30_000);
  const loading = chip === "trending" ? !news : chip === "watchlist" ? false : !feed;

  return (
    <section className="mt-7 px-5">
      <SectionHeader title="Explore Markets" onMore={() => useVela.getState().setTab("market")} />
      <div role="tablist" aria-label="Market lists" className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHIPS.map((item) => {
          const active = chip === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setChip(item.id);
                setExpanded(false);
              }}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                active ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"
              }`}
            >
              {item.id === "watchlist" ? <Heart className="size-3.5" fill={active ? "currentColor" : "none"} aria-hidden /> : null}
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-card border border-line bg-surface">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            {chip === "watchlist"
              ? "Tap the star on any coin to add it to your watchlist."
              : loading
                ? "Loading live markets…"
                : "Live market data is unavailable right now."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row, i) => {
              const quote = prices[row.mint];
              const price = quote?.priceUsd ?? row.priceUsd;
              const change = quote?.change24hPct ?? row.change24hPct;
              return (
                <li key={row.mint}>
                  <button
                    type="button"
                    onClick={() => openCoinSheet({ ...row, priceUsd: price, change24hPct: change })}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span className="relative shrink-0">
                      <CoinImage src={row.image} symbol={row.symbol} />
                      <RankBadge rank={i + 1} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{row.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {row.symbol}
                        {row.marketCapUsd !== null ? ` · ${formatCompactUsd(row.marketCapUsd)} ${row.capLabel}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums">{formatTokenPrice(price)}</span>
                      <ChangeText pct={change} className="block text-xs" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {all.length > 5 ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="h-11 w-full border-t border-line text-sm font-medium text-accent"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

const MEDALS: Record<number, string> = { 1: "bg-[#e0b86a] text-[#1a1408]", 2: "bg-[#c9ccd3] text-[#16171a]", 3: "bg-[#c4834a] text-[#1d1006]" };

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`absolute -top-1 -left-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface px-1 font-mono text-[9px] leading-none font-bold ${
        MEDALS[rank] ?? "bg-surface-2 text-muted"
      }`}
    >
      {rank}
    </span>
  );
}
