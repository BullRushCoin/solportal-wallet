import { useState } from "react";
import { formatUsd, formatWhen } from "@/lib/vela/format";
import { useVela, type ActivityKind } from "@/lib/vela/store";
import { SectionLabel } from "@/components/vela/ui";

const FILTERS: Array<{ id: "all" | ActivityKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "swap", label: "Swaps" },
  { id: "dapp", label: "dApps" },
  { id: "buy", label: "Fiat" },
  { id: "stake", label: "Stake" },
];

export function ActivityView() {
  const activity = useVela((state) => state.activity);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const rows = activity.filter((item) => {
    if (filter === "all") return true;
    if (filter === "dapp") return item.kind === "dapp" || item.kind === "nft" || item.kind === "message";
    return item.kind === filter;
  });

  return (
    <div className="px-5 pt-5 pb-6">
      <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-2 text-sm text-muted">Simulated history. Nothing here is a mainnet signature.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm ${
              filter === item.id ? "border-accent bg-accent text-on-accent" : "border-line text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line rounded-card border border-line bg-surface">
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">No activity yet.</li>
        ) : (
          rows.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted">{item.detail}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm tabular-nums ${item.usd < 0 ? "text-danger" : "text-fg"}`}>
                  {item.usd === 0 ? "—" : formatUsd(item.usd)}
                </p>
                <p className="text-xs text-muted">{formatWhen(item.ts)}</p>
              </div>
            </li>
          ))
        )}
      </ul>
      <div className="mt-6">
        <SectionLabel>Indexing</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
          Production history comes from a Helius DAS webhook plus enhanced transactions, not from scanning the wallet on every open.
        </p>
      </div>
    </div>
  );
}
