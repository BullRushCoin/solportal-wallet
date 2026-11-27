import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Globe, Star, Info, MessageCircle, Pause, Play, Send as SendIcon } from "lucide-react";
import { formatCompactUsd, formatUsd, shortAddr } from "@/lib/vela/format";
import { TICKER_COINS } from "@/lib/vela/market-tickers";
import { buyRatio, formatAge, MEME_SORTS, sortMemeCoins, type MemeCoin, type MemeSort } from "@/lib/vela/memecoins";
import { useVela, type WatchItem } from "@/lib/vela/store";
import { useLivePrices, useMemeFeed, useNow, type LiveQuote } from "@/lib/vela/use-live";
import { TokenMark } from "@/components/vela/ui";
import { WatchStar } from "@/components/vela/watch-star";

const TICKER_MINTS = TICKER_COINS.map((coin) => coin.mint);

export function MarketView() {
  return (
    <div className="pt-5 pb-8">
      <div className="px-5">
        <h1 className="text-3xl font-semibold tracking-tight">Market</h1>
      </div>
      <Ticker />
      <WatchStrip />
      <div className="px-5">
        <Memecoins />
      </div>
    </div>
  );
}

function priceText(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 0.01) return formatUsd(value);
  if (value === 0) return "$0.00";
  const zeros = Math.max(0, Math.floor(-Math.log10(value)));
  return `$${value.toFixed(Math.min(12, zeros + 3))}`;
}

function Change({ pct, className }: { pct: number | null | undefined; className?: string }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return <span className={`text-muted ${className ?? ""}`}>—</span>;
  const up = pct >= 0;
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${up ? "text-emerald-400" : "text-danger"} ${className ?? ""}`}>
      <Arrow className="size-3.5" aria-hidden />
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// ---------- Ticker ----------

function Ticker() {
  const prices = useLivePrices(TICKER_MINTS, 30_000);
  const setSheet = useVela((state) => state.setSheet);
  const chips = (copy: number) =>
    TICKER_COINS.map((coin) => {
      const quote = prices[coin.mint];
      return (
        <button
          key={`${copy}-${coin.mint}`}
          type="button"
          tabIndex={copy === 0 ? 0 : -1}
          aria-hidden={copy === 0 ? undefined : true}
          onClick={() =>
            setSheet({
              kind: "asset",
              amount: 0,
              token: {
                symbol: coin.symbol,
                name: coin.name,
                mint: coin.mint,
                decimals: coin.decimals,
                priceUsd: quote?.priceUsd ?? null,
                change24hPct: quote?.change24hPct ?? null,
              },
            })
          }
          className="mr-2 inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm"
        >
          <span className="font-semibold">{coin.symbol}</span>
          <Change pct={quote?.change24hPct} className="text-xs" />
        </button>
      );
    });
  return (
    <div className="ticker-viewport mt-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="24 hour price changes">
      <div className="ticker-track flex w-max pl-5">
        {chips(0)}
        {chips(1)}
      </div>
    </div>
  );
}

// ---------- Watchlist ----------

/** Slim row of starred coins under the ticker; hidden until something is starred. */
function WatchStrip() {
  const watchlist = useVela((state) => state.watchlist);
  const setSheet = useVela((state) => state.setSheet);
  const mints = useMemo(() => watchlist.map((item) => item.mint), [watchlist]);
  const prices = useLivePrices(mints, 30_000);
  if (!watchlist.length) return null;
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Watchlist">
      <span className="grid h-8 shrink-0 place-items-center text-[#e0b86a]" aria-hidden>
        <Star className="size-4 fill-current" />
      </span>
      {watchlist.map((item) => {
        const quote = prices[item.mint];
        return (
          <button
            key={item.mint}
            type="button"
            onClick={() =>
              setSheet({
                kind: "asset",
                amount: 0,
                token: { ...item, priceUsd: quote?.priceUsd ?? null, change24hPct: quote?.change24hPct ?? null },
              })
            }
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#e0b86a]/30 bg-surface px-2.5 text-xs"
          >
            <TokenMark symbol={item.symbol} src={item.image} small />
            <span className="font-semibold">{item.symbol}</span>
            <Change pct={quote?.change24hPct} className="text-[11px]" />
          </button>
        );
      })}
    </div>
  );
}

function WatchList() {
  const watchlist = useVela((state) => state.watchlist);
  const mints = useMemo(() => watchlist.map((item) => item.mint), [watchlist]);
  const prices = useLivePrices(mints, 30_000);
  if (!watchlist.length) {
    return (
      <p className="mt-3 rounded-card border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
        Tap the star on any coin to save it here.
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
      {watchlist.map((item) => (
        <WatchRow key={item.mint} item={item} quote={prices[item.mint]} />
      ))}
    </ul>
  );
}

function WatchRow({ item, quote }: { item: WatchItem; quote: LiveQuote | undefined }) {
  const setSheet = useVela((state) => state.setSheet);
  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
        onClick={() =>
          setSheet({
            kind: "asset",
            amount: 0,
            token: { ...item, priceUsd: quote?.priceUsd ?? null, change24hPct: quote?.change24hPct ?? null },
          })
        }
      >
        <TokenMark symbol={item.symbol} src={item.image} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.symbol}</span>
          <span className="block truncate text-xs text-muted">{item.name}</span>
        </span>
        <span className="text-right">
          <span className="block text-sm tabular-nums">{priceText(quote?.priceUsd)}</span>
          <Change pct={quote?.change24hPct} className="text-xs" />
        </span>
      </button>
      <WatchStar size="sm" item={item} />
    </li>
  );
}

// ---------- Memecoins ----------

function Memecoins() {
  const [paused, setPaused] = useState(false);
  const [info, setInfo] = useState(false);
  const [sort, setSort] = useState<MemeSort | "watchlist">("new");
  const watching = sort === "watchlist";
  const { feed, error, loading } = useMemeFeed(paused || watching, 15_000, sort === "trending" ? "trending" : "new");
  const now = useNow(1_000);
  // Trending comes pre-ranked from its own feed; the rest sort the new-pools feed.
  const coins = useMemo(() => (feed ? (sort === "trending" || sort === "watchlist" ? feed.coins : sortMemeCoins(feed.coins, sort)) : []), [feed, sort]);
  const live = !paused && !error && !feed?.stale;

  return (
    <section className="mt-7">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Memecoins</h2>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          aria-label={paused ? "Resume live feed" : "Pause live feed"}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 text-xs"
        >
          <span className={`size-2 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-muted"}`} />
          {paused ? "Paused" : "Live"}
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => setInfo((value) => !value)}
          aria-expanded={info}
          aria-label="About the badges"
          className="ml-auto grid size-9 place-items-center rounded-full text-muted"
        >
          <Info className="size-5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        {watching
          ? "Coins you've starred, with live prices."
          : `${sort === "trending" ? "Hottest Solana pools over the last 6 hours." : "New Solana pools."} Not advice: most new coins go to zero.`}
      </p>
      <div role="tablist" aria-label="Sort memecoins" className="[scrollbar-width:none] -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
        <button
          type="button"
          role="tab"
          aria-selected={watching}
          onClick={() => setSort("watchlist")}
          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs ${watching ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"}`}
        >
          <Star className={`size-3.5 ${watching ? "fill-current" : ""}`} aria-hidden />
          Watchlist
        </button>
        {MEME_SORTS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={sort === option.id}
            onClick={() => setSort(option.id)}
            className={`h-8 shrink-0 rounded-full border px-3 text-xs ${sort === option.id ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {info ? (
        <div role="note" className="mt-3 rounded-control border border-line bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          <p>
            <span className="text-emerald-400">Mint revoked</span> means nobody can print more supply.{" "}
            <span className="text-danger">Mint on</span> means the creator still can.
          </p>
          <p className="mt-1.5">
            <span className="text-emerald-400">Freeze revoked</span> means your tokens can't be frozen.{" "}
            <span className="text-danger">Freeze on</span> means the creator can lock wallets so they can't sell.
          </p>
          <p className="mt-1.5">
            Red extension badges (Transfer fee, Permanent delegate, Transfer hook, Pausable, Non-transferable) are Token-2022 features
            that can tax, move, or block your tokens.
          </p>
          <p className="mt-1.5">
            Badges come straight from the on-chain mint account and are checked for the newest coins first, so a card with no badges
            hasn't been checked yet. MC is market cap (FDV when only fully diluted value is reported), Liq is pool liquidity, and B/S
            counts buys and sells over 24h. Data: GeckoTerminal and DexScreener.
          </p>
        </div>
      ) : null}

      {watching ? (
        <WatchList />
      ) : loading && !feed ? (
        <ul className="mt-3 space-y-3" aria-label="Loading">
          {[0, 1, 2].map((key) => (
            <li key={key} className="h-36 animate-pulse rounded-card border border-line bg-surface" />
          ))}
        </ul>
      ) : !feed?.coins.length ? (
        <p className="mt-3 rounded-card border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
          {error ? "Couldn't reach the feed. It will retry on its own." : "No new pools right now."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {coins.map((coin) => (
            <MemeCard key={coin.mint} coin={coin} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MemeCard({ coin, now }: { coin: MemeCoin; now: number }) {
  const setSheet = useVela((state) => state.setSheet);
  const setToast = useVela((state) => state.setToast);
  const openExternal = useVela((state) => state.openExternal);
  const ratio = buyRatio(coin.buys24h, coin.sells24h);
  const open = () =>
    setSheet({
      kind: "asset",
      amount: 0,
      token: {
        symbol: coin.symbol,
        name: coin.name,
        mint: coin.mint,
        decimals: coin.decimals ?? 6,
        priceUsd: coin.priceUsd,
        image: coin.image,
      },
    });
  const copyMint = (event: React.MouseEvent) => {
    event.stopPropagation();
    void navigator.clipboard
      ?.writeText(coin.mint)
      .then(() => setToast("Mint address copied"))
      .catch(() => {});
  };
  const socials: Array<{ key: string; url: string; label: string; icon: React.ReactNode }> = [];
  if (coin.socials.x) socials.push({ key: "x", url: coin.socials.x, label: "X", icon: <XLogo /> });
  if (coin.socials.telegram) socials.push({ key: "tg", url: coin.socials.telegram, label: "Telegram", icon: <SendIcon className="size-3.5" /> });
  if (coin.socials.discord) socials.push({ key: "dc", url: coin.socials.discord, label: "Discord", icon: <MessageCircle className="size-3.5" /> });
  if (coin.socials.website) socials.push({ key: "web", url: coin.socials.website, label: "Website", icon: <Globe className="size-3.5" /> });

  return (
    <li>
      <article
        role="button"
        tabIndex={0}
        aria-label={`${coin.symbol} details`}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        }}
        className="rounded-card border border-line bg-surface p-3 text-left"
      >
        <div className="flex items-start gap-3">
          <TokenMark symbol={coin.symbol} src={coin.image} />
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-1.5">
              <span className="truncate font-semibold">{coin.symbol}</span>
              {coin.name.toLowerCase() !== coin.symbol.toLowerCase() ? <span className="truncate text-xs text-muted">{coin.name}</span> : null}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {coin.createdAt ? <span className="font-mono text-accent tabular-nums">{formatAge(now - coin.createdAt)}</span> : null}
              <button type="button" onClick={copyMint} className="font-mono" aria-label="Copy mint address">
                {shortAddr(coin.mint)}
              </button>
              {socials.map((social) => (
                <button
                  key={social.key}
                  type="button"
                  aria-label={social.label}
                  onClick={(event) => {
                    event.stopPropagation();
                    openExternal(social.url);
                  }}
                  className="grid size-6 place-items-center rounded-full border border-line text-fg"
                >
                  {social.icon}
                </button>
              ))}
            </p>
          </div>
          <WatchStar
            size="sm"
            item={{ mint: coin.mint, symbol: coin.symbol, name: coin.name, decimals: coin.decimals ?? 6, image: coin.image }}
          />
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <Metric label={coin.marketCapKind === "fdv" ? "FDV" : "MC"} value={coin.marketCapUsd} />
          <Metric label="Liq" value={coin.liquidityUsd} />
          {coin.volume24hUsd === null && coin.volume5mUsd !== null ? (
            <Metric label="Vol 5m" value={coin.volume5mUsd} />
          ) : (
            <Metric label="Vol 24h" value={coin.volume24hUsd} />
          )}
        </dl>

        {ratio !== null ? (
          <div className="mt-3">
            <div className="flex justify-between text-xs tabular-nums">
              <span className="text-emerald-400">B {coin.buys24h ?? 0}</span>
              <span className="text-danger">S {coin.sells24h ?? 0}</span>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-danger/70" aria-hidden>
              <span className="h-full bg-emerald-400" style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <SafetyBadges coin={coin} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openExternal(coin.dexUrl);
            }}
            className="ml-auto h-7 rounded-full border border-line px-2.5 font-mono text-[11px] text-muted"
          >
            DexScreener
          </button>
        </div>
      </article>
    </li>
  );
}

function SafetyBadges({ coin }: { coin: MemeCoin }) {
  const safety = coin.safety;
  if (!safety) return null;
  return (
    <>
      {safety.mintRevoked !== null ? <Badge good={safety.mintRevoked} text={safety.mintRevoked ? "Mint revoked" : "Mint on"} /> : null}
      {safety.freezeRevoked !== null ? (
        <Badge good={safety.freezeRevoked} text={safety.freezeRevoked ? "Freeze revoked" : "Freeze on"} />
      ) : null}
      {safety.riskyExtensions.map((ext) => (
        <Badge key={ext} good={false} text={ext} />
      ))}
    </>
  );
}

function Badge({ good, text }: { good: boolean; text: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] ${
        good ? "border-emerald-400/40 text-emerald-400" : "border-danger/50 text-danger"
      }`}
    >
      {text}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-control border border-line bg-surface-2 px-2 py-1.5">
      <dt className="font-mono text-[10px] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums">{value !== null ? formatCompactUsd(value) : "—"}</dd>
    </div>
  );
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
    </svg>
  );
}
