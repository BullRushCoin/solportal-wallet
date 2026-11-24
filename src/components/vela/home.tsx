import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Copy, Landmark } from "lucide-react";
import { formatAmt, formatChangePct, formatUsd, shortAddr } from "@/lib/vela/format";
import type { FungibleHolding, NftHolding, WatchedWallet } from "@/lib/vela/helius-parse";
import { holdingsChange24h } from "@/lib/vela/market";
import { useVela } from "@/lib/vela/store";
import { holdingValueUsd, isDeadCoin } from "@/lib/vela/incinerator";
import { holdingsUsd, TOKENS } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { SectionLabel, TokenMark, Mark } from "@/components/vela/ui";
import { IncineratorCard } from "@/components/vela/incinerator-card";
import { WatchAddressForm } from "@/components/vela/watch-address";

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
  const market = useMarket();
  const prices = Object.fromEntries(Object.entries(market.tokens).map(([symbol, quote]) => [symbol, quote.priceUsd]));
  const total = holdingsUsd(holdings, prices);
  const change = holdingsChange24h(holdings, market.tokens);
  const rows = TOKENS.filter((token) => {
    const amount = holdings[token.symbol] ?? 0;
    if (amount <= 0.0000001) return false;
    const quote = market.tokens[token.symbol];
    const price = quote?.priceUsd ?? token.priceUsd;
    const valueUsd = holdingValueUsd(amount, price);
    return !isDeadCoin({ symbol: token.symbol, mint: token.mint, amount, valueUsd });
  });

  return (
    <div className="px-5 pt-5 pb-6">
      <HomeHeader
        label="Sandbox · nothing broadcasts"
        address={wallet?.address ?? null}
        copyHint="Simulated address copied. Do not send real funds."
        onCopy={() => {
          if (!wallet) return;
          void navigator.clipboard?.writeText(wallet.address);
          setToast("Simulated address copied. Do not send real funds.");
        }}
      />

      <p className="mt-8 font-mono text-xs tracking-widest text-muted uppercase">Portfolio</p>
      <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{formatUsd(total)}</p>
      {total > 0 ? (
        <ChangeLine change={change} live={market.live} />
      ) : (
        <button className="mt-3 text-sm text-accent" onClick={restoreSandbox}>
          Restore sandbox balances
        </button>
      )}

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Quick icon={<ArrowUpRight className="size-4" />} label="Send" onClick={() => setSheet({ kind: "send" })} />
        <Quick icon={<ArrowDownLeft className="size-4" />} label="Receive" onClick={() => setSheet({ kind: "receive" })} />
        <Quick icon={<ArrowLeftRight className="size-4" />} label="Swap" onClick={() => openSwap()} />
        <Quick icon={<Landmark className="size-4" />} label="Stake" onClick={() => setMore("stake")} />
      </div>

      <div className="mt-8">
        <WatchAddressForm compact />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <SectionLabel>Assets</SectionLabel>
        <button className="text-xs text-muted" onClick={() => openSwap()}>
          Swap
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">No tokens left in the sandbox.</li>
        ) : (
          rows.map((token) => {
            const amount = holdings[token.symbol] ?? 0;
            const quote = market.tokens[token.symbol];
            const price = quote?.priceUsd ?? token.priceUsd;
            return (
              <AssetRow
                key={token.symbol}
                symbol={token.symbol}
                name={token.name}
                image={quote?.image}
                amount={amount}
                usd={amount * price}
                change24hPct={quote?.change24hPct ?? null}
                token2022={token.standard === "token-2022"}
                onClick={() => openSwap(token.symbol)}
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
  const rows = allRows.filter((token) => !isDeadCoin({ symbol: token.symbol, mint: token.mint, amount: token.amount, valueUsd: token.valueUsd }));

  return (
    <div className="px-5 pt-5 pb-6">
      <HomeHeader
        label="Watch only · no keys · nothing broadcasts"
        address={address}
        copyHint="Public address copied."
        onCopy={() => {
          void navigator.clipboard?.writeText(address);
          setToast("Public address copied.");
        }}
      />

      <p className="mt-8 font-mono text-xs tracking-widest text-muted uppercase">Portfolio</p>
      {loading ? <p className="mt-3 text-sm text-muted">Loading live holdings…</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {!loading && !error ? (
        <>
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
            {data?.totalUsd !== null && data?.totalUsd !== undefined ? formatUsd(data.totalUsd) : "—"}
          </p>
          <p className="mt-2 text-sm text-muted">Live on-chain balances · USD when price data is available</p>
        </>
      ) : null}

      <div className="mt-6 rounded-card border border-line bg-surface p-4 text-sm text-pretty text-muted">
        View only. Send, swap, and stake stay in the sandbox
        {wallet ? " and still use your simulated wallet." : ". Create a sandbox wallet to try simulated swaps."}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Quick icon={<ArrowUpRight className="size-4" />} label="Send" onClick={() => setSheet({ kind: "send" })} />
        <Quick icon={<ArrowDownLeft className="size-4" />} label="Receive" onClick={() => setSheet({ kind: "receive" })} />
        <Quick icon={<ArrowLeftRight className="size-4" />} label="Swap" onClick={() => openSwap()} />
        <Quick icon={<Landmark className="size-4" />} label="Stake" onClick={() => setMore("stake")} />
      </div>

      <div className="mt-6">
        <WatchAddressForm compact />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <SectionLabel>Assets</SectionLabel>
        <button className="text-xs text-muted" onClick={() => openSwap()}>
          Swap
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {loading ? (
          <li className="px-4 py-6 text-sm text-muted">Fetching tokens…</li>
        ) : rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">No fungible tokens found for this address.</li>
        ) : (
          rows.map((token) => (
            <AssetRow
              key={token.mint}
              symbol={token.symbol}
              name={token.name}
              image={token.image}
              amount={token.amount}
              usd={token.valueUsd ?? (token.priceUsd !== null ? token.amount * token.priceUsd : null)}
              change24hPct={token.change24hPct}
              onClick={() =>
                openSwap({
                  input: token.symbol,
                  output: token.symbol === "USDC" ? "SOL" : "USDC",
                  token: {
                    symbol: token.symbol,
                    name: token.name,
                    mint: token.mint,
                    decimals: token.decimals,
                    priceUsd: token.priceUsd,
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

function HomeHeader({
  label,
  address,
  onCopy,
}: {
  label: string;
  address: string | null;
  copyHint?: string;
  onCopy: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Mark className="size-9" />
        <div>
          <p className="text-sm font-semibold tracking-wide">SolPortal</p>
          <p className="font-mono text-xs text-muted">{label}</p>
        </div>
      </div>
      <button
        className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 font-mono text-xs"
        onClick={onCopy}
        disabled={!address}
      >
        {address ? shortAddr(address) : "—"}
        <Copy className="size-3.5 text-muted" />
      </button>
    </header>
  );
}

function ChangeLine({ change, live }: { change: number | null; live: boolean }) {
  if (change === null) {
    return (
      <p className="mt-2 text-sm text-muted">{live ? "Live prices · 24h change unavailable" : "Demo prices"}</p>
    );
  }
  const up = change >= 0;
  return (
    <p className={`mt-2 text-sm tabular-nums ${up ? "text-accent" : "text-danger"}`}>
      {formatChangePct(change)} · 24h{live ? " · live" : ""}
    </p>
  );
}

function AssetRow({
  symbol,
  name,
  image,
  amount,
  usd,
  change24hPct,
  token2022,
  onClick,
}: {
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
      <div className="text-right">
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
      <span className="text-xs text-muted">{label}</span>
    </button>
  );
}
