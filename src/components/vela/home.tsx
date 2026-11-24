import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Copy, Landmark, Plus } from "lucide-react";
import { formatAmt, formatUsd, shortAddr } from "@/lib/vela/format";
import { useVela } from "@/lib/vela/store";
import { holdingsUsd, TOKENS } from "@/lib/vela/tokens";
import { SectionLabel, TokenMark, Mark } from "@/components/vela/ui";

export function HomeView() {
  const wallet = useVela((state) => state.wallet);
  const holdings = useVela((state) => state.holdings);
  const nfts = useVela((state) => state.nfts);
  const setSheet = useVela((state) => state.setSheet);
  const setTab = useVela((state) => state.setTab);
  const setMore = useVela((state) => state.setMore);
  const setToast = useVela((state) => state.setToast);
  const restoreSandbox = useVela((state) => state.restoreSandbox);
  const total = holdingsUsd(holdings);
  const rows = TOKENS.filter((token) => (holdings[token.symbol] ?? 0) > 0.0000001);

  return (
    <div className="px-5 pt-5 pb-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Mark className="size-9" />
          <div>
            <p className="text-sm font-semibold tracking-wide">SolPortal</p>
            <p className="font-mono text-xs text-muted">Sandbox · nothing broadcasts</p>
          </div>
        </div>
        <button
          className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 font-mono text-xs"
          onClick={() => {
            if (!wallet) return;
            void navigator.clipboard?.writeText(wallet.address);
            setToast("Simulated address copied. Do not send real funds.");
          }}
        >
          {wallet ? shortAddr(wallet.address) : "—"}
          <Copy className="size-3.5 text-muted" />
        </button>
      </header>

      <p className="mt-8 font-mono text-xs tracking-widest text-muted uppercase">Portfolio</p>
      <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">{formatUsd(total)}</p>
      {total > 0 ? (
        <p className="mt-2 text-sm text-accent tabular-nums">+1.8% · illustrative 24h</p>
      ) : (
        <button className="mt-3 text-sm text-accent" onClick={restoreSandbox}>
          Restore sandbox balances
        </button>
      )}

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Quick icon={<ArrowUpRight className="size-4" />} label="Send" onClick={() => setSheet({ kind: "send" })} />
        <Quick icon={<ArrowDownLeft className="size-4" />} label="Receive" onClick={() => setSheet({ kind: "receive" })} />
        <Quick icon={<Plus className="size-4" />} label="Buy" onClick={() => setMore("buy")} />
        <Quick icon={<Landmark className="size-4" />} label="Stake" onClick={() => setMore("stake")} />
      </div>

      <div className="mt-8 flex items-end justify-between">
        <SectionLabel>Assets</SectionLabel>
        <button className="text-xs text-muted" onClick={() => setTab("swap")}>
          Swap
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">No tokens left in the sandbox.</li>
        ) : (
          rows.map((token) => {
            const amount = holdings[token.symbol] ?? 0;
            return (
              <li key={token.symbol} className="flex items-center gap-3 px-3 py-3">
                <TokenMark symbol={token.symbol} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{token.symbol}</p>
                    {token.standard === "token-2022" ? (
                      <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-muted">
                        Token-2022
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">{token.name}</p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{formatAmt(amount, token.symbol === "BONK" ? 0 : 4)}</p>
                  <p className="text-xs text-muted tabular-nums">{formatUsd(amount * token.priceUsd)}</p>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-8">
        <SectionLabel>Collectibles</SectionLabel>
        {nfts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No NFTs in the sandbox.</p>
        ) : (
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
            {nfts.map((nft) => (
              <li key={nft.id} className="w-36 shrink-0">
                <div className={`h-36 rounded-card border border-line ${nft.pattern}`} />
                <p className="mt-2 truncate text-sm font-medium">{nft.name}</p>
                <p className="text-xs text-muted">{nft.collection}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
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
