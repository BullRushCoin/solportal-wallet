import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, Search, X } from "lucide-react";
import { formatAmt, formatUsd } from "@/lib/vela/format";
import { useVela } from "@/lib/vela/store";
import {
  buildPickerRows,
  POPULAR_TOKENS,
  shortMint,
  type PickerRow,
  type PickerToken,
} from "@/lib/vela/token-picker";
import { customTokenLookup, tokenLookup, walletTokens } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { useTokenMeta } from "@/lib/vela/use-token-meta";
import { TokenMark } from "@/components/vela/ui";

const SEARCH_DEBOUNCE_MS = 250;
const searchCache = new Map<string, PickerToken[]>();

export function TokenPicker({
  side,
  onSelect,
  onClose,
}: {
  side: "in" | "out";
  onSelect: (row: PickerRow) => void;
  onClose: () => void;
}) {
  const holdings = useVela((state) => state.holdings);
  useVela((state) => state.customTokens);
  const market = useMarket();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerToken[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const allMints = useMemo(
    () => [
      ...Object.keys(holdings).flatMap((symbol) => {
        const mint = tokenLookup(symbol)?.mint;
        return mint ? [mint] : [];
      }),
      ...POPULAR_TOKENS.map((token) => token.mint),
    ],
    [holdings],
  );
  const meta = useTokenMeta(allMints);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const walletRows = useMemo<PickerRow[]>(
    () =>
      walletTokens().map((token) => {
        const quote = market.tokens[token.symbol];
        const custom = customTokenLookup(token.symbol);
        const price = quote?.priceUsd ?? token.priceUsd;
        const held = holdings[token.symbol] ?? 0;
        return {
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          icon: quote?.image ?? custom?.image ?? meta[token.mint]?.icon ?? null,
          verified: custom ? Boolean(custom.verified) : token.symbol !== "DEAD",
          priceUsd: price > 0 ? price : null,
          token2022: token.standard === "token-2022",
          key: token.symbol,
          held,
          heldUsd: held * (price || 0),
          disabled: side === "in" && !(held > 0),
        };
      }),
    [holdings, market, meta, side],
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    const cached = searchCache.get(q.toLowerCase());
    if (cached) {
      setResults(cached);
      setSearching(false);
      setSearchError(false);
      return;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/token-search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as { tokens?: PickerToken[] } | null;
          const tokens = Array.isArray(body?.tokens) ? body.tokens : [];
          if (res.ok) {
            searchCache.set(q.toLowerCase(), tokens);
            if (searchCache.size > 100) searchCache.delete(searchCache.keys().next().value!);
          }
          setResults(tokens);
          setSearchError(!res.ok);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSearchError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const sections = useMemo(
    () =>
      buildPickerRows({
        side,
        query,
        held: walletRows,
        results,
        walletByMint: (mint) => walletRows.find((row) => row.mint === mint) ?? null,
      }),
    [query, results, side, walletRows],
  );

  function chipRow(chip: (typeof POPULAR_TOKENS)[number]): PickerRow {
    const known = walletRows.find((row) => row.mint === chip.mint);
    if (known) return known;
    const info = meta[chip.mint];
    return {
      ...chip,
      icon: info?.icon ?? null,
      verified: info ? info.verified : true,
      priceUsd: info?.priceUsd ?? null,
      token2022: info?.token2022,
      key: null,
      held: 0,
      heldUsd: 0,
      disabled: side === "in",
    };
  }

  const q = query.trim();

  return (
    <div role="dialog" aria-label="Choose token" className="absolute inset-0 z-40 flex flex-col bg-bg">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-xl font-semibold">{side === "in" ? "You pay with" : "You receive"}</h2>
        <button type="button" className="h-11 px-2 text-sm text-muted" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="px-5">
        <label className="mt-2 flex h-12 items-center gap-2 rounded-control border border-line bg-surface px-3 focus-within:border-accent">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, symbol or paste mint"
            aria-label="Search tokens"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {query ? (
            <button type="button" aria-label="Clear search" className="grid size-8 place-items-center text-muted" onClick={() => setQuery("")}>
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {POPULAR_TOKENS.map((chip) => {
            const row = chipRow(chip);
            return (
              <button
                key={chip.mint}
                type="button"
                disabled={row.disabled}
                onClick={() => onSelect(row)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface pr-3 pl-1 text-sm disabled:opacity-35"
              >
                <TokenMark small symbol={row.key ?? chip.symbol} src={row.icon} />
                <span>{chip.symbol}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        {sections.yours.length ? (
          <>
            <p className="mt-3 mb-2 font-mono text-xs tracking-widest text-muted uppercase">Your tokens</p>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {sections.yours.map((row) => (
                <PickerItem key={row.mint} row={row} onSelect={onSelect} />
              ))}
            </ul>
          </>
        ) : null}

        {q ? (
          <>
            <div className="mt-5 mb-2 flex items-center justify-between">
              <p className="font-mono text-xs tracking-widest text-muted uppercase">Search results</p>
              {searching ? <span className="text-xs text-muted">Searching…</span> : null}
            </div>
            {sections.results.length ? (
              <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                {sections.results.map((row) => (
                  <PickerItem key={row.mint} row={row} onSelect={onSelect} />
                ))}
              </ul>
            ) : !searching ? (
              <p className="rounded-card border border-line bg-surface px-4 py-6 text-sm text-muted">
                {searchError ? "Token search is unavailable right now." : `No tokens match “${q}”.`}
              </p>
            ) : null}
          </>
        ) : sections.yours.length === 0 ? (
          <p className="mt-6 text-sm text-muted">This sandbox wallet holds no tokens yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function PickerItem({ row, onSelect }: { row: PickerRow; onSelect: (row: PickerRow) => void }) {
  return (
    <li>
      <button
        type="button"
        disabled={row.disabled}
        onClick={() => onSelect(row)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left disabled:cursor-not-allowed"
      >
        <span className={row.disabled ? "opacity-40" : undefined}>
          <TokenMark symbol={row.key ?? row.symbol} src={row.icon} />
        </span>
        <span className={`min-w-0 flex-1 ${row.disabled ? "opacity-50" : ""}`}>
          <span className="flex items-center gap-1">
            <span className="truncate font-medium">{row.symbol}</span>
            {row.verified ? <BadgeCheck aria-label="Verified" className="size-4 shrink-0 text-accent" /> : null}
          </span>
          <span className="block truncate text-xs text-muted">
            {row.name} · <span className="font-mono">{shortMint(row.mint)}</span>
          </span>
          {row.disabled ? (
            <span className="mt-1 block text-xs text-muted">You don’t hold this</span>
          ) : !row.verified ? (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300">
              <AlertTriangle className="size-3" /> Unverified – check the mint
            </span>
          ) : null}
        </span>
        {row.held > 0 ? (
          <span className="shrink-0 text-right">
            <span className="block text-sm font-medium tabular-nums">{formatAmt(row.held, 4)}</span>
            <span className="block text-xs text-muted tabular-nums">{formatUsd(row.heldUsd)}</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}
