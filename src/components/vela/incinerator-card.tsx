import { formatAmt, formatUsd } from "@/lib/vela/format";
import { incineratorFeeBps, type IncineratorPlan } from "@/lib/vela/incinerator";
import { type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela } from "@/lib/vela/store";
import { useMarket } from "@/lib/vela/use-market";
import { useIncinerator } from "@/lib/vela/use-incinerator";
import { PrimaryButton, SectionLabel, TokenMark } from "@/components/vela/ui";

export function IncineratorCard({
  address,
  holdings,
  viewOnly,
}: {
  address?: string | null;
  holdings?: Record<string, number> | null;
  viewOnly?: boolean;
}) {
  const { data, error, loading } = useIncinerator({ address, holdings });
  const setSheet = useVela((state) => state.setSheet);
  const wallet = useVela((state) => state.wallet);
  const priority = useVela((state) => state.priority);
  const market = useMarket();
  const solPrice = market.tokens.SOL?.priceUsd ?? null;
  const plan = data;
  const count = plan?.count ?? 0;
  const feeBps = plan?.feeBps ?? incineratorFeeBps();

  function review() {
    if (!plan || !wallet || viewOnly || count === 0) return;
    const intent: TxIntent = {
      kind: "incinerate",
      origin: "https://solportal.wallet",
      site: "SolPortal Incinerator",
      verified: true,
      title: `Incinerate ${count} token${count === 1 ? "" : "s"}`,
      items: plan.items.map((item) => ({
        mint: item.mint,
        symbol: item.symbol,
        name: item.name,
        amount: item.amount,
        valueUsd: item.valueUsd,
        image: item.image,
        action: item.action,
        rentSol: item.rentSol,
        swapSol: item.swapSol,
      })),
      rentSol: plan.rentSol,
      swapSol: plan.swapSol,
      feeSol: plan.feeSol,
      feeBps: plan.feeBps,
      netSol: plan.netSol,
      feeWallet: plan.feeWallet,
      networkFeeSol: priorityFeeSol(priority),
      effects: [
        { symbol: "SOL", delta: plan.netSol, usd: plan.netSol * (solPrice ?? 0) },
        ...plan.items
          .filter((item) => item.amount > 0)
          .map((item) => ({
            symbol: item.symbol,
            delta: -item.amount,
            usd: -(item.valueUsd ?? 0),
          })),
      ],
      authorities: [],
      warnings: [
        {
          level: "info",
          title: "Simulated — nothing broadcasts",
          detail: "This sandbox never burns, swaps, or closes real token accounts. No fees are collected.",
        },
        {
          level: "info",
          title: `${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 1)}% fee on reclaimed SOL`,
          detail: `${formatAmt(plan.feeSol, 6)} SOL of the rent plus swap proceeds would go to the SolPortal cold wallet. This sandbox does not collect it.`,
        },
      ],
    };
    setSheet({ kind: "sign", intent });
  }

  return (
    <div className="mt-8">
      <SectionLabel>Incinerator</SectionLabel>
      <div className="mt-3 rounded-card border border-line bg-surface p-4">
        <p className="font-medium">One-click dead coins</p>
        <p className="mt-1 text-sm text-pretty text-muted">
          Dust under $1, unpriced tokens, and empty accounts. Swap to SOL when Jupiter has a route; otherwise burn and close the account for rent.
        </p>
        {loading ? <p className="mt-3 text-sm text-muted">Scanning for dead coins…</p> : null}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {!loading && !error && plan ? <PlanSummary plan={plan} /> : null}
        <div className="mt-4">
          <PrimaryButton disabled={viewOnly || !wallet || loading || !plan || count === 0} onClick={review}>
            {viewOnly
              ? "View only"
              : !wallet
                ? "Create a sandbox wallet"
                : !plan || loading
                  ? "Scanning…"
                  : count === 0
                    ? "No dead coins"
                    : `Incinerate ${count} token${count === 1 ? "" : "s"}`}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function PlanSummary({ plan }: { plan: IncineratorPlan }) {
  const preview = plan.items.slice(0, 4);
  return (
    <div className="mt-3">
      <p className="text-sm">
        {plan.count} token account{plan.count === 1 ? "" : "s"}
        {plan.dustValueUsd !== null ? ` · ${formatUsd(plan.dustValueUsd)} dust` : " · dust value unknown"}
      </p>
      <p className="mt-1 text-xs text-muted">
        {formatAmt(plan.rentSol, 6)} SOL rent
        {plan.swapSol > 0 ? ` · ${formatAmt(plan.swapSol, 6)} SOL from swaps` : ""}
        {` · ${(plan.feeBps / 100).toFixed(plan.feeBps % 100 === 0 ? 0 : 1)}% fee ${formatAmt(plan.feeSol, 6)} SOL`}
        {` · net ${formatAmt(plan.netSol, 6)} SOL`}
        {plan.live ? " · live quotes" : " · fallback"}
      </p>
      {preview.length > 0 ? (
        <ul className="mt-3 divide-y divide-line rounded-control border border-line">
          {preview.map((item) => (
            <li key={item.mint} className="flex items-center gap-3 px-3 py-2">
              <TokenMark symbol={item.symbol} src={item.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.symbol}</p>
                <p className="truncate text-xs text-muted">
                  {item.amount === 0 ? "Empty account" : formatAmt(item.amount, item.amount >= 1_000 ? 0 : 4)}
                  {item.valueUsd !== null ? ` · ${formatUsd(item.valueUsd)}` : " · no price"}
                  {item.action === "swap" ? " · swap to SOL" : " · burn + close"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {plan.items.length > preview.length ? (
        <p className="mt-2 text-xs text-muted">{plan.items.length - preview.length} more in the review sheet.</p>
      ) : null}
    </div>
  );
}
