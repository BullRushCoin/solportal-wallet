import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Search } from "lucide-react";
import { CATEGORIES, DIRECTORY, type Category } from "@/lib/vela/dapps";
import { formatChangePct, formatCompactUsd, formatUsd, formatWhen } from "@/lib/vela/format";
import { openSafeHttpUrl } from "@/lib/vela/open-url";
import { useExplore } from "@/lib/vela/use-explore";
import { useVela } from "@/lib/vela/store";
import type { ExploreDappRow, ExplorePairRow, ExplorePerpMarket, ExploreSnapshot } from "@/lib/vela/explore";
import { SectionLabel } from "@/components/vela/ui";

export function ExploreView() {
  const openDapp = useVela((state) => state.openDapp);
  const setSheet = useVela((state) => state.setSheet);
  const bookmarks = useVela((state) => state.bookmarks);
  const recents = useVela((state) => state.recents);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const explore = useExplore();

  const sponsored = DIRECTORY.filter((dapp) => dapp.sponsored);
  const directoryList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DIRECTORY.filter((dapp) => (category === "All" ? true : dapp.category === category))
      .filter((dapp) => (q ? `${dapp.name} ${dapp.blurb} ${dapp.host}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.trending - a.trending);
  }, [category, query]);

  const dapps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return explore.dapps
      .filter((dapp) => (category === "All" ? true : dapp.category === category))
      .filter((dapp) => (q ? `${dapp.name} ${dapp.blurb} ${dapp.category}`.toLowerCase().includes(q) : true));
  }, [category, explore.dapps, query]);

  const recentDapps = recents
    .map((id) => DIRECTORY.find((dapp) => dapp.id === id))
    .filter((dapp): dapp is (typeof DIRECTORY)[number] => Boolean(dapp));

  const showMarkets = category === "All" || category === "DEX";
  const searching = Boolean(query.trim());

  return (
    <div className="px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <button className="h-11 text-sm text-accent" onClick={() => setSheet({ kind: "url" })}>
          Open link
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
        Trending dapps, DEX pairs, and perps use live public data. Tap a dapp or venue to open the real site in a new tab. Pair rows open a prefilled sandbox Swap; nothing broadcasts.
      </p>
      <label className="mt-4 flex h-12 items-center gap-2 rounded-control border border-line bg-surface px-3">
        <Search className="size-4 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dApps"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm ${
              category === item ? "border-accent bg-accent text-on-accent" : "border-line text-muted"
            }`}
          >
            {item === "DEX" ? "DEXs / Perps" : item}
          </button>
        ))}
      </div>

      {bookmarks.length > 0 ? (
        <div className="mt-5">
          <SectionLabel>Bookmarks</SectionLabel>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {bookmarks.map((bookmark) => (
              <button
                key={bookmark.id}
                className="h-10 shrink-0 rounded-full border border-line bg-surface px-3 text-sm"
                onClick={() => openDapp(bookmark.dappId)}
              >
                {bookmark.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {category === "All" && !searching ? (
        <div className="mt-6">
          <SectionLabel>Sponsored</SectionLabel>
          <div className="mt-3 space-y-3">
            {sponsored.map((dapp) => (
              <button
                key={dapp.id}
                onClick={() => openDapp(dapp.id)}
                className="block w-full rounded-card border border-line bg-surface p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs tracking-widest text-accent uppercase">Sponsored</p>
                  <p className="text-xs text-muted">{dapp.category}</p>
                </div>
                <p className="mt-2 text-xl font-semibold">{dapp.name}</p>
                <p className="mt-1 text-sm text-pretty text-muted">{dapp.campaign}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {recentDapps.length > 0 && !searching ? (
        <div className="mt-6">
          <SectionLabel>Recents</SectionLabel>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {recentDapps.map((dapp) => (
              <button
                key={dapp.id}
                className="h-10 shrink-0 rounded-full border border-line bg-surface px-3 text-sm"
                onClick={() => openDapp(dapp.id)}
              >
                {dapp.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <SectionLabel>{searching ? "Results" : "Trending"}</SectionLabel>
          <LiveStamp snapshot={explore} />
        </div>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {dapps.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">Nothing in this category.</li>
          ) : (
            dapps.map((dapp, index) => (
              <li key={dapp.id}>
                <DappRow dapp={dapp} rank={index + 1} />
              </li>
            ))
          )}
        </ul>
      </div>

      {showMarkets && !searching ? (
        <>
          <DexSection snapshot={explore} />
          <PerpsSection snapshot={explore} />
        </>
      ) : null}

      {searching && directoryList.length > 0 ? (
        <div className="mt-6">
          <SectionLabel>Sandbox previews</SectionLabel>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
            {directoryList.map((dapp) => (
              <li key={dapp.id}>
                <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => openDapp(dapp.id)}>
                  <span className="grid size-10 place-items-center rounded-full bg-surface-2 font-semibold text-accent">
                    {dapp.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{dapp.name}</span>
                    <span className="block truncate text-xs text-muted">{dapp.blurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DappRow({ dapp, rank }: { dapp: ExploreDappRow; rank: number }) {
  const metric = dapp.volume24hUsd ?? dapp.tvlUsd;
  const change = dapp.volume24hUsd !== null ? dapp.volumeChange24hPct : dapp.tvlChange24hPct;
  const metricLabel = dapp.volume24hUsd !== null ? "Vol" : dapp.tvlUsd !== null ? "TVL" : null;
  return (
    <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => openListedUrl(dapp.url)}>
      <span className="w-6 font-mono text-xs text-muted">{rank}</span>
      <Mark src={dapp.logo} label={dapp.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-medium">{dapp.name}</span>
          <ExternalLink className="size-3 shrink-0 text-muted" />
        </span>
        <span className="block truncate text-xs text-muted">
          {dapp.category} · {dapp.blurb}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {metric !== null && metricLabel ? (
          <>
            <span className="block text-sm tabular-nums">{formatCompactUsd(metric)}</span>
            <span className="block text-xs text-muted">
              {metricLabel} {change !== null ? <Change value={change} /> : null}
            </span>
          </>
        ) : (
          <span className="text-xs text-muted">Open</span>
        )}
      </span>
    </button>
  );
}

function DexSection({ snapshot }: { snapshot: ExploreSnapshot }) {
  return (
    <div className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <SectionLabel>DEX</SectionLabel>
        <LiveStamp snapshot={snapshot} />
      </div>
      <p className="mt-2 text-xs text-pretty text-muted">
        Live Solana pairs from GeckoTerminal. Tap a token to prefill Swap; open the pair page for the chart.
      </p>
      <div className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {snapshot.pairs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{snapshot.live ? "No live pairs yet." : "Live pair data is unavailable. The list will retry shortly."}</p>
        ) : (
          snapshot.pairs.map((pair) => <PairRow key={pair.id} pair={pair} />)
        )}
      </div>
      <div className="mt-5"><SectionLabel>DEX volume · 24h</SectionLabel></div>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {snapshot.dexVenues.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">DefiLlama DEX volume is unavailable.</li>
        ) : (
          snapshot.dexVenues.map((venue, index) => (
            <li key={venue.id}>
              <VenueRow
                rank={index + 1}
                name={venue.name}
                logo={venue.logo}
                url={venue.url}
                primary={formatCompactUsd(venue.volume24hUsd)}
                change={venue.volumeChange24hPct}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function PerpsSection({ snapshot }: { snapshot: ExploreSnapshot }) {
  return (
    <div className="mt-8">
      <div className="flex items-end justify-between gap-3">
        <SectionLabel>Perps</SectionLabel>
        <LiveStamp snapshot={snapshot} />
      </div>
      <p className="mt-2 text-xs text-pretty text-muted">
        Live markets from Jupiter Perps{snapshot.sources.includes("drift") ? " and Drift" : ""}. Tap a market to open the real trade page. DefiLlama derivatives volume is a paid API, so the venue list uses live Jupiter volume plus protocol TVL.
      </p>
      <div className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {snapshot.perpMarkets.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Live perp markets are unavailable. The list will retry shortly.</p>
        ) : (
          snapshot.perpMarkets.map((market) => <PerpRow key={market.id} market={market} />)
        )}
      </div>
      <div className="mt-5"><SectionLabel>Perp venues</SectionLabel></div>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {snapshot.perpVenues.map((venue, index) => (
          <li key={venue.id}>
            <VenueRow
              rank={index + 1}
              name={venue.name}
              logo={venue.logo}
              url={venue.url}
              primary={venue.volume24hUsd !== null ? formatCompactUsd(venue.volume24hUsd) : venue.tvlUsd !== null ? formatCompactUsd(venue.tvlUsd) : "Open"}
              change={venue.volume24hUsd !== null ? null : venue.tvlChange24hPct}
              caption={venue.volume24hUsd !== null ? "Vol 24h" : venue.tvlUsd !== null ? "TVL" : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PairRow({ pair }: { pair: ExplorePairRow }) {
  const openSwap = useVela((state) => state.openSwap);
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <button
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() =>
          openSwap({
            input: pair.baseSymbol,
            output: pair.baseSymbol === "SOL" ? "USDC" : "SOL",
            token: {
              symbol: pair.baseSymbol,
              name: pair.baseName,
              mint: pair.baseMint,
              decimals: pair.baseDecimals,
              priceUsd: pair.priceUsd,
              image: pair.logo,
            },
          })
        }
      >
        <Mark src={pair.logo} label={pair.baseSymbol} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-medium">{pair.baseSymbol}</span>
            {pair.trending ? <span className="font-mono text-[10px] tracking-widest text-accent uppercase">Hot</span> : null}
          </span>
          <span className="block truncate text-xs text-muted">
            {pair.name} · {pair.dex}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm tabular-nums">{formatUsd(pair.priceUsd)}</span>
          <span className="block text-xs">
            <Change value={pair.change24hPct} />
          </span>
        </span>
      </button>
      <button
        type="button"
        className="grid size-10 shrink-0 place-items-center text-muted"
        aria-label={`Open ${pair.name} pair page`}
        onClick={() => openListedUrl(pair.pairUrl)}
      >
        <ExternalLink className="size-4" />
      </button>
    </div>
  );
}

function PerpRow({ market }: { market: ExplorePerpMarket }) {
  return (
    <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => openListedUrl(market.tradeUrl)}>
      <Mark src={market.logo} label={market.baseSymbol} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-medium">{market.symbol}</span>
          <ExternalLink className="size-3 shrink-0 text-muted" />
        </span>
        <span className="block truncate text-xs text-muted">
          {market.venue}
          {market.volume24hUsd !== null ? ` · Vol ${formatCompactUsd(market.volume24hUsd)}` : ""}
          {market.openInterestUsd !== null ? ` · OI ${formatCompactUsd(market.openInterestUsd)}` : ""}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm tabular-nums">{formatUsd(market.markPrice)}</span>
        <span className="block text-xs">
          <Change value={market.change24hPct} />
          {market.fundingRatePct !== null ? (
            <span className="text-muted">
              {" "}
              · {market.fundingLabel} {formatChangePct(market.fundingRatePct)}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function VenueRow({
  rank,
  name,
  logo,
  url,
  primary,
  change,
  caption,
}: {
  rank: number;
  name: string;
  logo: string | null;
  url: string;
  primary: string;
  change: number | null;
  caption?: string;
}) {
  return (
    <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => openListedUrl(url)}>
      <span className="w-6 font-mono text-xs text-muted">{rank}</span>
      <Mark src={logo} label={name} />
      <span className="min-w-0 flex-1">
        <span className="font-medium">{name}</span>
        {caption ? <span className="block text-xs text-muted">{caption}</span> : null}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm tabular-nums">{primary}</span>
        <span className="block text-xs">
          <Change value={change} />
        </span>
      </span>
    </button>
  );
}

function LiveStamp({ snapshot }: { snapshot: ExploreSnapshot }) {
  return (
    <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
      {snapshot.live ? "Live" : "Fallback"} · {formatWhen(snapshot.updatedAt)}
    </p>
  );
}

function Change({ value }: { value: number | null | undefined }): ReactNode {
  if (value === null || value === undefined) return null;
  return <span className={`tabular-nums ${value >= 0 ? "text-accent" : "text-danger"}`}>{formatChangePct(value)}</span>;
}

function Mark({ src, label }: { src?: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span className="relative grid size-10 shrink-0 overflow-hidden rounded-full border border-line bg-surface-2">
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-semibold text-accent">
      {label.slice(0, 1)}
    </span>
  );
}

function openListedUrl(url: string) {
  if (openSafeHttpUrl(url)) return;
  useVela.getState().openExternal(url);
}
