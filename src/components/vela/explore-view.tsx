import { useMemo, useRef, useState } from "react";
import { Globe, Search, X } from "lucide-react";
import { DISCOVER_APPS } from "@/lib/vela/discover";
import { formatCompactUsd } from "@/lib/vela/format";
import { formatTokenPrice, looksLikeUrl, matchApps, matchTokens, type SearchToken } from "@/lib/vela/explore-search";
import { openCoinSheet } from "@/lib/vela/open-coin";
import { useVela } from "@/lib/vela/store";
import { TOKENS, tokenByMint } from "@/lib/vela/tokens";
import { useMemeFeed } from "@/lib/vela/use-live";
import { useNews } from "@/lib/vela/use-news";
import { Mark, TokenMark } from "@/components/vela/ui";
import { AccountAvatar } from "@/components/vela/wallets-sheet";
import { ExploreBanners } from "@/components/vela/explore-banners";
import { ExploreMarkets, HotMarkets } from "@/components/vela/explore-markets";
import { AppRow, Discover, Recents } from "@/components/vela/explore-discover";
import { NewsSection } from "@/components/vela/news-section";
import { LearnCard } from "@/components/vela/explore-learn";
import { CoinImage, SectionHeader } from "@/components/vela/explore-ui";

export function ExploreView() {
  const [query, setQuery] = useState("");
  const { feed, loading } = useMemeFeed(false, 30_000);
  const { news, failed } = useNews();
  const searching = query.trim().length > 0;

  return (
    <div className="pb-8">
      <TopBar query={query} onQuery={setQuery} />
      {searching ? (
        <SearchResults query={query} feedCoins={feed?.coins ?? []} trending={news?.trending ?? []} onDone={() => setQuery("")} />
      ) : (
        <>
          <ExploreBanners />
          <HotMarkets feed={feed} loading={loading} />
          <ExploreMarkets feed={feed} news={news} />
          <Discover />
          <Recents />
          <NewsSection news={news} failed={failed} />
          <LearnCard />
        </>
      )}
    </div>
  );
}

function TopBar({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  const setSheet = useVela((state) => state.setSheet);
  const openExternal = useVela((state) => state.openExternal);
  const activeAccount = useVela((state) => state.accounts.find((account) => account.id === state.activeAccountId) ?? null);
  const input = useRef<HTMLInputElement>(null);
  const isUrl = looksLikeUrl(query);

  return (
    <div className="sticky top-0 z-30 border-b border-line/50 bg-bg/85 px-5 pt-4 pb-3 backdrop-blur-md">
      <form
        className="flex items-center gap-3"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (looksLikeUrl(query)) {
            openExternal(query.trim());
            onQuery("");
            input.current?.blur();
          } else {
            input.current?.blur();
          }
        }}
      >
        <button type="button" onClick={() => setSheet({ kind: "wallets" })} aria-label="My wallets" className="shrink-0 rounded-full">
          {activeAccount ? <AccountAvatar name={activeAccount.name} active size="sm" /> : <Mark className="size-9" />}
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-accent/60">
          {isUrl ? <Globe className="size-4 shrink-0 text-accent" aria-hidden /> : <Search className="size-4 shrink-0 text-muted" aria-hidden />}
          <input
            ref={input}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search or type URL"
            aria-label="Search or type URL"
            enterKeyHint={isUrl ? "go" : "search"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          {query ? (
            <button type="button" aria-label="Clear" onClick={() => onQuery("")} className="-mr-2 grid size-8 shrink-0 place-items-center rounded-full text-muted">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
      </form>
    </div>
  );
}

function SearchResults({
  query,
  feedCoins,
  trending,
  onDone,
}: {
  query: string;
  feedCoins: SearchToken[];
  trending: SearchToken[];
  onDone: () => void;
}) {
  const openExternal = useVela((state) => state.openExternal);
  const isUrl = looksLikeUrl(query);
  const apps = useMemo(() => matchApps(DISCOVER_APPS, query), [query]);
  const tokens = useMemo(() => {
    const known: SearchToken[] = TOKENS.map((token) => ({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      image: null,
      priceUsd: null,
    }));
    return matchTokens([...known, ...trending, ...feedCoins], query);
  }, [feedCoins, query, trending]);

  return (
    <div className="px-5 pt-2">
      {isUrl ? (
        <button
          type="button"
          onClick={() => {
            openExternal(query.trim());
            onDone();
          }}
          className="mt-2 flex w-full items-center gap-3 rounded-card border border-accent/40 bg-surface px-3.5 py-3 text-left"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <Globe className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Open website</span>
            <span className="block truncate font-mono text-xs text-muted">{query.trim()}</span>
          </span>
        </button>
      ) : null}

      {apps.length > 0 ? (
        <div className="mt-5">
          <SectionHeader title="Apps" />
          <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
            {apps.map((app) => (
              <li key={app.id}>
                <AppRow app={app} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <div className="mt-5">
          <SectionHeader title="Tokens" />
          <ul className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
            {tokens.map((token) => (
              <li key={token.mint}>
                <button type="button" onClick={() => openCoinSheet(token)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                  {tokenByMint(token.mint) ? <TokenMark symbol={token.symbol} src={token.image} /> : <CoinImage src={token.image} symbol={token.symbol} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{token.symbol}</span>
                    <span className="block truncate text-xs text-muted">
                      {token.name}
                      {token.marketCapUsd ? ` · ${formatCompactUsd(token.marketCapUsd)} MC` : ""}
                    </span>
                  </span>
                  {token.priceUsd !== null ? <span className="shrink-0 text-sm tabular-nums">{formatTokenPrice(token.priceUsd)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isUrl && apps.length === 0 && tokens.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          No apps or tokens match “{query.trim()}”.
          <br />
          Type a full address like <span className="font-mono text-fg">jup.ag</span> to open a site.
        </p>
      ) : null}
    </div>
  );
}
