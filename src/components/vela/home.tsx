import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, Search, X } from "lucide-react";
import { isSolanaAddress } from "@/lib/vela/address";
import { formatAmt, formatChangePct, formatUsd, shortAddr } from "@/lib/vela/format";
import type { FungibleHolding, NftHolding, WatchedWallet } from "@/lib/vela/helius-parse";
import { useVela } from "@/lib/vela/store";
import { holdingValueUsd, isDeadCoin } from "@/lib/vela/incinerator";
import { customTokenLookup, holdingsUsd, tokenLookup, walletTokens } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { SectionLabel, TokenMark } from "@/components/vela/ui";
import { Sparkline } from "@/components/vela/sparkline";
import { PortfolioChart } from "@/components/vela/portfolio-chart";
import { BalanceCard } from "@/components/vela/balance-card";
import type { PortfolioRange } from "@/lib/vela/portfolio-history";
import { describeChange, usePortfolioHistory } from "@/lib/vela/use-portfolio-history";
import { IncineratorCard } from "@/components/vela/incinerator-card";

export function HomeView() {
  const watchAddress = useVela((state) => state.watchAddress);
  if (watchAddress) return <WatchedHome address={watchAddress} />;
  return <SandboxHome />;
}

function SandboxHome() {
  const wallet = useVela((state) => state.wallet);
  const holdings = useVela((state) => state.holdings);
  const setSheet = useVela((state) => state.setSheet);
  const setMore = useVela((state) => state.setMore);
  const openSwap = useVela((state) => state.openSwap);
  const setToast = useVela((state) => state.setToast);
  const restoreSandbox = useVela((state) => state.restoreSandbox);
  const customTokens = useVela((state) => state.customTokens);
  const refreshCustomPrices = useVela((state) => state.refreshCustomPrices);
  const market = useMarket();
  useEffect(() => {
    void refreshCustomPrices();
    const timer = window.setInterval(() => void refreshCustomPrices(), 60_000);
    return () => window.clearInterval(timer);
  }, [refreshCustomPrices, customTokens.length]);
  const prices = Object.fromEntries(Object.entries(market.tokens).map(([symbol, quote]) => [symbol, quote.priceUsd]));
  const total = holdingsUsd(holdings, prices);
  const chartHoldings = useMemo(
    () =>
      Object.entries(holdings)
        .filter(([, amount]) => amount > 0)
        .flatMap(([symbol, amount]) => {
          const token = tokenLookup(symbol);
          return token ? [{ mint: token.mint, amount, price: prices[symbol] ?? token.priceUsd }] : [];
        }),
    [holdings, prices],
  );
  const [range, setRange] = useState<PortfolioRange>("1D");
  const history = usePortfolioHistory(chartHoldings, total, range);
  const [query, setQuery] = useState("");
  const heldRows = walletTokens().filter((token) => {
    const amount = holdings[token.symbol] ?? 0;
    if (amount <= 0.0000001) return false;
    const quote = market.tokens[token.symbol];
    const price = quote?.priceUsd ?? token.priceUsd;
    const valueUsd = holdingValueUsd(amount, price);
    return !isDeadCoin({ symbol: token.symbol, mint: token.mint, amount, valueUsd });
  });
  const rows = heldRows.filter((token) => matchesQuery(query, token));

  return (
    <div className="px-5 pt-5 pb-6">
      <BalanceCard
        label="Sandbox · nothing broadcasts"
        address={wallet?.address ?? null}
        onCopy={() => {
          if (!wallet) return;
          void navigator.clipboard?.writeText(wallet.address);
          setToast("Simulated address copied. Do not send real funds.");
        }}
        amount={formatUsd(total)}
        change={total > 0 ? describeChange(history, range) : null}
      />

      {total > 0 ? (
        <PortfolioChart history={history} range={range} onRange={setRange} />
      ) : (
        <button className="mt-3 text-sm text-accent" onClick={restoreSandbox}>
          Restore sandbox balances
        </button>
      )}

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Quick icon={<ArrowUpRight className="size-4" />} label="Send" onClick={() => setSheet({ kind: "send" })} />
        <Quick icon={<ArrowDownLeft className="size-4" />} label="Receive" onClick={() => setSheet({ kind: "receive" })} />
        <Quick icon={<ArrowLeftRight className="size-4" />} label="Swap" onClick={() => openSwap()} />
        <Quick icon={<CreditCard className="size-4" />} label="Buy Crypto" onClick={() => setMore("buy")} />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <SectionLabel>Assets</SectionLabel>
        <button className="text-xs text-muted" onClick={() => openSwap()}>
          Swap
        </button>
      </div>
      <AssetSearch value={query} onChange={setQuery} />
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        <TokenAddressResult query={query} knownMints={heldRows.map((token) => token.mint)} />
        {rows.length === 0 ? (
          query.trim() ? (
            isSolanaAddress(query) ? null : <li className="px-4 py-6 text-sm text-muted">No assets match “{query.trim()}”.</li>
          ) : (
            <li className="px-4 py-6 text-sm text-muted">No tokens left in the sandbox.</li>
          )
        ) : (
          rows.map((token) => {
            const amount = holdings[token.symbol] ?? 0;
            const quote = market.tokens[token.symbol];
            const price = quote?.priceUsd ?? token.priceUsd;
            return (
              <AssetRow
                key={token.symbol}
                mint={token.mint}
                symbol={token.symbol}
                name={token.name}
                image={quote?.image ?? customTokenLookup(token.symbol)?.image}
                amount={amount}
                usd={amount * price}
                change24hPct={quote?.change24hPct ?? null}
                token2022={token.standard === "token-2022"}
                onClick={() =>
                  setSheet({
                    kind: "asset",
                    amount,
                    token: {
                      symbol: token.symbol,
                      name: token.name,
                      mint: token.mint,
                      decimals: token.decimals,
                      priceUsd: price,
                      change24hPct: quote?.change24hPct ?? null,
                      image: quote?.image ?? customTokenLookup(token.symbol)?.image ?? null,
                    },
                  })
                }
              />
            );
          })
        )}
      </ul>

      <IncineratorCard holdings={holdings} />
    </div>
  );
}

function WatchedHome({ address }: { address: string }) {
  const wallet = useVela((state) => state.wallet);
  const setToast = useVela((state) => state.setToast);
  const setSheet = useVela((state) => state.setSheet);
  const setMore = useVela((state) => state.setMore);
  const openSwap = useVela((state) => state.openSwap);
  const [data, setData] = useState<WatchedWallet | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/wallet?address=${encodeURIComponent(address)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as WatchedWallet & { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load this address.");
        return body;
      })
      .then((walletData) => {
        setData(walletData);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to load this address.";
        setError(message === "Failed to fetch" ? "Could not reach the live-data server. Try again." : message);
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [address]);

  const sol: FungibleHolding | null = data
    ? {
        mint: "So11111111111111111111111111111111111111112",
        symbol: "SOL",
        name: "Solana",
        amount: data.sol.amount,
        decimals: 9,
        priceUsd: data.sol.priceUsd,
        valueUsd: data.sol.valueUsd,
        image: null,
        change24hPct: null,
      }
    : null;
  const allRows: FungibleHolding[] = data ? [...(sol && sol.amount > 0 ? [sol] : []), ...data.tokens] : [];
  const [query, setQuery] = useState("");
  const heldRows = allRows.filter((token) => !isDeadCoin({ symbol: token.symbol, mint: token.mint, amount: token.amount, valueUsd: token.valueUsd }));
  const rows = heldRows.filter((token) => matchesQuery(query, token));
  const totalUsd = data?.totalUsd ?? null;
  const chartHoldings = useMemo(
    () => (data ? allRows.map((row) => ({ mint: row.mint, amount: row.amount, price: row.priceUsd ?? 0 })) : []),
    // allRows is derived from data only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const [range, setRange] = useState<PortfolioRange>("1D");
  const history = usePortfolioHistory(totalUsd ? chartHoldings : [], totalUsd ?? 0, range);
  const showChart = !loading && !error && Boolean(totalUsd);

  return (
    <div className="px-5 pt-5 pb-6">
      <BalanceCard
        label="Watch only · no keys · nothing broadcasts"
        address={address}
        onCopy={() => {
          void navigator.clipboard?.writeText(address);
          setToast("Public address copied.");
        }}
        amount={loading ? "…" : error ? "—" : totalUsd !== null ? formatUsd(totalUsd) : "—"}
        change={
          loading
            ? { text: "Loading live holdings…", up: null }
            : error
              ? null
              : showChart
                ? describeChange(history, range)
                : { text: "USD when price data is available", up: null }
        }
      />
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <WatchBanner address={address} />

      {showChart ? <PortfolioChart history={history} range={range} onRange={setRange} /> : null}

      <div className="mt-6 rounded-card border border-line bg-surface p-4 text-sm text-pretty text-muted">
        View only. Send, swap, and stake stay in the sandbox
        {wallet ? " and still use your simulated wallet." : ". Create a sandbox wallet to try simulated swaps."}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Quick icon={<ArrowUpRight className="size-4" />} label="Send" onClick={() => setSheet({ kind: "send" })} />
        <Quick icon={<ArrowDownLeft className="size-4" />} label="Receive" onClick={() => setSheet({ kind: "receive" })} />
        <Quick icon={<ArrowLeftRight className="size-4" />} label="Swap" onClick={() => openSwap()} />
        <Quick icon={<CreditCard className="size-4" />} label="Buy Crypto" onClick={() => setMore("buy")} />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <SectionLabel>Assets</SectionLabel>
        <button className="text-xs text-muted" onClick={() => openSwap()}>
          Swap
        </button>
      </div>
      <AssetSearch value={query} onChange={setQuery} />
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {!loading ? <TokenAddressResult query={query} knownMints={heldRows.map((token) => token.mint)} /> : null}
        {loading ? (
          <li className="px-4 py-6 text-sm text-muted">Fetching tokens…</li>
        ) : rows.length === 0 ? (
          query.trim() ? (
            isSolanaAddress(query) ? null : <li className="px-4 py-6 text-sm text-muted">No assets match “{query.trim()}”.</li>
          ) : (
            <li className="px-4 py-6 text-sm text-muted">No fungible tokens found for this address.</li>
          )
        ) : (
          rows.map((token) => (
            <AssetRow
              key={token.mint}
              mint={token.mint}
              symbol={token.symbol}
              name={token.name}
              image={token.image}
              amount={token.amount}
              usd={token.valueUsd ?? (token.priceUsd !== null ? token.amount * token.priceUsd : null)}
              change24hPct={token.change24hPct}
              onClick={() =>
                setSheet({
                  kind: "asset",
                  amount: token.amount,
                  viewOnly: true,
                  token: {
                    symbol: token.symbol,
                    name: token.name,
                    mint: token.mint,
                    decimals: token.decimals,
                    priceUsd: token.priceUsd,
                    change24hPct: token.change24hPct,
                    image: token.image,
                  },
                })
              }
            />
          ))
        )}
      </ul>

      <IncineratorCard address={address} viewOnly />
    </div>
  );
}

type TokenLookup = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  priceUsd: number | null;
  change24hPct: number | null;
  image: string | null;
};

/** Match a holding by symbol, name, or (full or partial) mint address. */
function matchesQuery(query: string, token: { symbol: string; name: string; mint: string }): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return token.symbol.toLowerCase().includes(q) || token.name.toLowerCase().includes(q) || token.mint.toLowerCase() === q || token.mint.toLowerCase().startsWith(q);
}

function AssetSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="mt-3 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
      <Search className="size-4 shrink-0 text-muted" />
      <input
        type="text"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search name, symbol, or paste token address"
        aria-label="Search assets by name, symbol, or token address"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
      />
      {value ? (
        <button type="button" aria-label="Clear search" className="shrink-0 text-muted" onClick={() => onChange("")}>
          <X className="size-4" />
        </button>
      ) : null}
    </label>
  );
}

/** When the search box holds a mint address the wallet doesn't hold, look the coin up live. */
function TokenAddressResult({ query, knownMints }: { query: string; knownMints: string[] }) {
  const setSheet = useVela((state) => state.setSheet);
  const mint = query.trim();
  const shouldLookup = isSolanaAddress(mint) && !knownMints.includes(mint);
  const [state, setState] = useState<{ mint: string; token: TokenLookup | null; error: string; loading: boolean }>({
    mint: "",
    token: null,
    error: "",
    loading: false,
  });

  useEffect(() => {
    if (!shouldLookup) return;
    const controller = new AbortController();
    setState({ mint, token: null, error: "", loading: true });
    void fetch(`/api/token?mint=${encodeURIComponent(mint)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as TokenLookup & { error?: string };
        if (!res.ok) throw new Error(body.error || "No token found at that address.");
        return body;
      })
      .then((token) => setState({ mint, token, error: "", loading: false }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "No token found at that address.";
        setState({ mint, token: null, error: message === "Failed to fetch" ? "Couldn't reach token data. Try again." : message, loading: false });
      });
    return () => controller.abort();
  }, [mint, shouldLookup]);

  if (!shouldLookup) return null;
  if (state.mint !== mint || state.loading) {
    return <li className="px-4 py-4 text-sm text-muted">Looking up {shortAddr(mint)}…</li>;
  }
  if (!state.token) {
    return <li className="px-4 py-4 text-sm text-danger">{state.error}</li>;
  }
  const token = state.token;
  return (
    <AssetRow
      mint={token.mint}
      symbol={token.symbol}
      name={`${token.name} · ${shortAddr(token.mint)}`}
      image={token.image}
      amount={0}
      usd={token.priceUsd}
      change24hPct={token.change24hPct}
      onClick={() => setSheet({ kind: "asset", amount: 0, token })}
    />
  );
}

function WatchBanner({ address }: { address: string }) {
  const setWatchAddress = useVela((state) => state.setWatchAddress);
  const setToast = useVela((state) => state.setToast);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-full border border-line bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Watching</p>
        <p className="truncate font-mono text-xs">{shortAddr(address)}</p>
      </div>
      <button
        type="button"
        className="shrink-0 px-2 text-xs text-accent"
        onClick={() => {
          setWatchAddress(null);
          setToast("Back to the sandbox wallet.");
        }}
      >
        Back to sandbox
      </button>
    </div>
  );
}

function AssetRow({
  mint,
  symbol,
  name,
  image,
  amount,
  usd,
  change24hPct,
  token2022,
  onClick,
}: {
  mint?: string;
  symbol: string;
  name: string;
  image?: string | null;
  amount: number;
  usd: number | null;
  change24hPct: number | null;
  token2022?: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-3 text-left">
      <TokenMark symbol={symbol} src={image} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{symbol}</p>
          {token2022 ? (
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted">Token-2022</span>
          ) : null}
        </div>
        <p className="truncate text-xs text-muted">{name}</p>
      </div>
      {mint ? <Sparkline mint={mint} /> : null}
      <div className="min-w-[5.5rem] text-right">
        <p className="tabular-nums">{formatAmt(amount, symbol === "BONK" ? 0 : 4)}</p>
        <p className="text-xs text-muted tabular-nums">{usd === null ? "—" : formatUsd(usd)}</p>
        {change24hPct !== null ? (
          <p className={`text-xs tabular-nums ${change24hPct >= 0 ? "text-accent" : "text-danger"}`}>
            {formatChangePct(change24hPct)}
          </p>
        ) : null}
      </div>
    </button>
    </li>
  );
}

export function Collectibles({
  items,
  empty,
}: {
  items: Array<NftHolding & { pattern?: string }>;
  empty: string;
}) {
  return (
    <div className="mt-8">
      <SectionLabel>Collectibles</SectionLabel>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
          {items.map((nft) => (
            <li key={nft.id} className="w-36 shrink-0">
              {nft.image ? (
                <img
                  src={nft.image}
                  alt=""
                  className="h-36 w-36 rounded-card border border-line object-cover"
                />
              ) : (
                <div className={`h-36 rounded-card border border-line ${nft.pattern ?? "bg-surface-2"}`} />
              )}
              <p className="mt-2 truncate text-sm font-medium">{nft.name}</p>
              <p className="text-xs text-muted">{nft.collection}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Quick({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2">
      <span className="grid size-11 place-items-center rounded-full border border-line bg-surface text-fg">{icon}</span>
      <span className="text-xs whitespace-nowrap text-muted">{label}</span>
    </button>
  );
}
