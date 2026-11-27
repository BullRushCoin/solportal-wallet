import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ChevronDown, CreditCard, RefreshCw, SlidersHorizontal } from "lucide-react";
import { PLATFORM_FEE_BPS, DEFAULT_SLIPPAGE_BPS, quoteDemo } from "@/lib/vela/jupiter";
import { formatAmt, formatUsd } from "@/lib/vela/format";
import { withLivePrice } from "@/lib/vela/market";
import { intentBlocked, type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela } from "@/lib/vela/store";
import {
  fromDemoQuote,
  impactLevel,
  parseSlippagePct,
  QUOTE_REFRESH_MS,
  rateLine,
  SLIPPAGE_PRESETS_BPS,
  slippageLabel,
  type SwapSide,
} from "@/lib/vela/swap-quote";
import { pickerRowToToken, shortMint, type PickerRow } from "@/lib/vela/token-picker";
import { customTokenLookup, holdingKeyFor, tokenLookup, type CustomToken, type Token } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { useSwapQuote } from "@/lib/vela/use-swap-quote";
import { useTokenMeta } from "@/lib/vela/use-token-meta";
import { PrimaryButton, SectionLabel, TokenMark } from "@/components/vela/ui";
import { TokenPicker } from "@/components/vela/token-picker";

function asSwapSideToken(token: Token): CustomToken {
  const custom = customTokenLookup(token.symbol);
  return { ...token, image: custom?.image ?? null, verified: custom ? custom.verified : true };
}

function defaultToken(symbol: string): CustomToken {
  return asSwapSideToken(tokenLookup(symbol) ?? tokenLookup("USDC")!);
}

export function SwapView() {
  const holdings = useVela((state) => state.holdings);
  const wallet = useVela((state) => state.wallet);
  const watchAddress = useVela((state) => state.watchAddress);
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const prefill = useVela((state) => state.swapPrefill);
  const clearSwapPrefill = useVela((state) => state.clearSwapPrefill);
  const setMore = useVela((state) => state.setMore);
  const amountRef = useRef<HTMLInputElement>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [inTok, setInTok] = useState<CustomToken>(() => defaultToken("SOL"));
  const [outTok, setOutTok] = useState<CustomToken>(() => defaultToken("USDC"));
  const [amount, setAmount] = useState("1");
  const [picking, setPicking] = useState<null | "in" | "out">(null);
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [showSettings, setShowSettings] = useState(false);
  const market = useMarket();

  useEffect(() => {
    if (!prefill) return;
    const resolve = (symbol: string): CustomToken | null => {
      const meta = prefill.token;
      const known = tokenLookup(symbol);
      // A coin that only shares a symbol with a known token (another "TSLA") keeps its own mint.
      if (known && (!meta || meta.symbol !== symbol || meta.mint === known.mint)) return asSwapSideToken(known);
      if (!meta || meta.symbol !== symbol) return null;
      return {
        symbol: holdingKeyFor(meta.symbol, meta.mint),
        name: meta.name,
        mint: meta.mint,
        decimals: meta.decimals,
        priceUsd: meta.priceUsd ?? 0,
        standard: "spl",
        image: meta.image ?? null,
        verified: false,
      };
    };
    if (prefill.buy) {
      // Buy from a coin sheet: pay with the chosen SOL/USDC, receive the coin, type an amount.
      const coin = resolve(prefill.output);
      if (coin) {
        setOutTok(coin);
        setInTok(defaultToken(prefill.input));
        setAmount("");
        setFocusTick((tick) => tick + 1);
      }
      clearSwapPrefill();
      return;
    }
    const first = resolve(prefill.input);
    const second = resolve(prefill.output) ?? defaultToken("USDC");
    if (first && (useVela.getState().holdings[first.symbol] ?? 0) > 0) {
      setInTok(first);
      setOutTok(second.mint === first.mint ? defaultToken(first.symbol === "USDC" ? "SOL" : "USDC") : second);
    } else if (first) {
      // Not held: buy it instead, paying with USDC (or SOL when buying USDC).
      setOutTok(first);
      setInTok(defaultToken(first.symbol === "USDC" ? "SOL" : "USDC"));
    }
    clearSwapPrefill();
  }, [prefill, clearSwapPrefill]);

  useEffect(() => {
    if (focusTick) amountRef.current?.focus();
  }, [focusTick]);

  const meta = useTokenMeta([inTok.mint, outTok.mint]);
  // A coin opened from a sheet starts unverified; Jupiter's metadata settles it, as in the token picker.
  const outUnverified = outTok.verified === false && meta[outTok.mint]?.verified !== true;
  const inLive = withLivePrice(inTok, market.tokens[inTok.symbol]);
  const outLive = withLivePrice(outTok, market.tokens[outTok.symbol]);
  const inSide: SwapSide = { symbol: inTok.symbol, mint: inTok.mint, decimals: inTok.decimals, priceUsd: inLive.priceUsd };
  const outSide: SwapSide = { symbol: outTok.symbol, mint: outTok.mint, decimals: outTok.decimals, priceUsd: outLive.priceUsd };
  const amountIn = Number(amount);

  const { quote, status, error, secondsLeft, refresh, pending } = useSwapQuote({
    input: inSide,
    output: outSide,
    amountText: amount,
    slippageBps,
    fallback: () => {
      if (!(amountIn > 0) || !(inLive.priceUsd > 0) || !(outLive.priceUsd > 0)) return null;
      const demo = quoteDemo(inLive, outLive, amountIn, wallet?.address ?? "Sandbox", { prioritization: priority, slippageBps });
      return demo ? fromDemoQuote(demo, amountIn, slippageBps) : null;
    },
  });

  const balance = holdings[inTok.symbol] ?? 0;
  const noFunds = Boolean(wallet) && !watchAddress && !((holdings.SOL ?? 0) > 0) && !((holdings.USDC ?? 0) > 0) && (inTok.symbol === "SOL" || inTok.symbol === "USDC");
  const outBalance = holdings[outTok.symbol] ?? 0;
  const viewOnly = Boolean(watchAddress);
  const shown = quote && !pending ? quote : null;
  const tooMuch = amountIn > balance + 1e-8;
  const blocked = viewOnly || !wallet || !shown || tooMuch;
  const impact = shown ? impactLevel(shown.impactPct) : "ok";
  const outPrice = outLive.priceUsd > 0 ? outLive.priceUsd : shown && shown.outUi > 0 ? (shown.inUi * inLive.priceUsd) / (shown.outUi + shown.feeUi) : 0;
  const inUsd = amountIn > 0 ? amountIn * inLive.priceUsd : 0;
  const outUsd = shown ? shown.outUi * outPrice : 0;

  function review() {
    if (!shown || !wallet) return;
    const isNew = !tokenLookup(outTok.symbol);
    const intent: TxIntent = {
      kind: "swap",
      origin: "https://solportal.wallet",
      site: "SolPortal Swap",
      verified: true,
      title: `Swap ${inTok.symbol} for ${outTok.symbol}`,
      input: inTok.symbol,
      output: outTok.symbol,
      amountIn,
      amountOut: shown.outUi,
      feeUsd: shown.feeUsd,
      networkFeeSol: priorityFeeSol(priority),
      outputToken: isNew ? { ...outTok, priceUsd: outPrice, verified: !outUnverified } : undefined,
      effects: [
        { symbol: inTok.symbol, delta: -amountIn, usd: -inUsd },
        { symbol: outTok.symbol, delta: shown.outUi, usd: outUsd },
      ],
      authorities: [],
      warnings: [
        {
          level: "info",
          title: `${PLATFORM_FEE_BPS} bps platform fee`,
          detail: `${formatAmt(shown.feeUi, 6)} ${shown.feeSymbol} would go to the SolPortal cold wallet. This sandbox does not collect it.`,
        },
      ],
    };
    if (shown.source === "estimated") {
      intent.warnings.unshift({ level: "warn", title: "Estimated quote", detail: "Jupiter's live quote was unavailable, so amounts come from the local price table." });
    }
    if (impact !== "ok") {
      intent.warnings.unshift({
        level: impact === "danger" ? "critical" : "warn",
        title: `Price impact ${shown.impactPct.toFixed(2)}%`,
        detail: "This trade moves the pool price. Try a smaller amount.",
      });
    }
    if (outUnverified) {
      intent.warnings.unshift({ level: "warn", title: "Unverified token", detail: `Jupiter does not mark ${outTok.symbol} as verified. Check the mint ${shortMint(outTok.mint)}.` });
    }
    const reason = intentBlocked(intent, holdings);
    if (reason) {
      intent.warnings = [{ level: "critical", title: reason, detail: "Reduce the amount or pick another token." }, ...intent.warnings];
    }
    setSheet({ kind: "sign", intent });
  }

  function pick(row: PickerRow) {
    const token = pickerRowToToken(row, tokenLookup);
    if (picking === "in") {
      if (token.mint === outTok.mint) setOutTok(inTok);
      setInTok(token);
    } else if (picking === "out") {
      if (token.mint === inTok.mint) {
        if ((holdings[outTok.symbol] ?? 0) > 0) setInTok(outTok);
        else setInTok(defaultToken(token.symbol === "USDC" ? "SOL" : "USDC"));
      }
      setOutTok(token);
    }
    setPicking(null);
  }

  function flip() {
    const nextIn = outTok;
    setOutTok(inTok);
    setInTok(nextIn);
    if (shown && (holdings[nextIn.symbol] ?? 0) > 0) setAmount(String(Number(shown.outUi.toFixed(Math.min(6, nextIn.decimals)))));
  }

  const statusLabel =
    status === "live" ? "Live" : status === "estimated" ? "Estimated" : status === "loading" || pending ? "Fetching quote…" : "Enter an amount";

  return (
    <div className="px-5 pt-5 pb-6">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Jupiter</SectionLabel>
        <button
          type="button"
          aria-expanded={showSettings}
          aria-label="Slippage settings"
          onClick={() => setShowSettings((open) => !open)}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs ${showSettings ? "border-accent text-accent" : "border-line text-fg"}`}
        >
          <SlidersHorizontal className="size-3.5" />
          Slippage {slippageLabel(slippageBps)}
        </button>
      </div>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Swap</h1>
      <p className="mt-1 text-sm text-muted">Live Jupiter quotes · 0.85% platform fee</p>

      {showSettings ? <SlippagePanel bps={slippageBps} onChange={setSlippageBps} /> : null}

      {watchAddress ? (
        <p className="mt-4 rounded-card border border-line bg-surface p-4 text-sm text-pretty text-muted">
          View only. Approvals stay in the sandbox wallet and do not touch the watched account.
        </p>
      ) : !wallet ? (
        <p className="mt-4 rounded-card border border-line bg-surface p-4 text-sm text-pretty text-muted">
          Create a sandbox wallet to try a simulated swap.
        </p>
      ) : null}

      <div className="relative mt-4">
        <TokenField
          label="You pay"
          inputRef={amountRef}
          token={inTok}
          icon={inTok.image ?? meta[inTok.mint]?.icon}
          amount={amount}
          onAmount={setAmount}
          hint={`Balance ${formatAmt(balance, 4)} ${inTok.symbol}`}
          usd={inUsd}
          onPick={() => setPicking("in")}
          onMax={() => setAmount(String(Math.max(0, inTok.symbol === "SOL" ? balance - 0.01 : balance)))}
        />
        <button
          type="button"
          aria-label="Flip pair"
          className="absolute top-1/2 left-1/2 z-10 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg text-accent"
          onClick={flip}
        >
          <ArrowDown className="size-4" />
        </button>
        <div className="h-2" />
        <TokenField
          label="You receive"
          token={outTok}
          icon={outTok.image ?? meta[outTok.mint]?.icon}
          amount={shown ? formatAmt(shown.outUi, 6) : pending || status === "loading" ? "…" : "0"}
          readOnly
          hint={shown ? `Min ${formatAmt(shown.minOutUi, 6)} after slippage` : `Balance ${formatAmt(outBalance, 4)} ${outTok.symbol}`}
          usd={outUsd}
          onPick={() => setPicking("out")}
        />
      </div>

      {noFunds ? (
        <button
          type="button"
          onClick={() => setMore("buy")}
          className="mt-3 flex w-full items-center gap-3 rounded-card border border-accent/40 bg-accent/10 px-3 py-2.5 text-left text-sm"
        >
          <CreditCard className="size-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-pretty">No SOL to swap.</span>
          <span className="shrink-0 font-medium text-accent">Add funds with card</span>
        </button>
      ) : null}

      {outUnverified ? (
        <p className="mt-3 flex items-center gap-2 rounded-card border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="min-w-0">
            Unverified – check the mint <span className="font-mono">{shortMint(outTok.mint)}</span>
          </span>
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${status === "live" ? "animate-pulse bg-emerald-400" : status === "estimated" ? "bg-amber-400" : "bg-muted"}`}
          />
          <span className={status === "estimated" ? "text-amber-300" : "text-muted"}>{statusLabel}</span>
          {shown ? <span className="truncate text-fg">{rateLine(inTok.symbol, outTok.symbol, shown.rate)}</span> : null}
        </span>
        {secondsLeft !== null && amountIn > 0 ? (
          <button type="button" onClick={() => void refresh()} aria-label={`Refresh quote, refreshing in ${secondsLeft}s`} className="inline-flex shrink-0 items-center gap-1.5 text-muted">
            <CountdownRing seconds={secondsLeft} />
            <RefreshCw className="size-3.5" />
          </button>
        ) : null}
      </div>
      {status === "estimated" && error ? <p className="mt-1 px-1 text-xs text-amber-300/80">Live quote unavailable ({error}). Showing an estimate.</p> : null}

      {shown ? (
        <dl className="mt-3 space-y-2 rounded-card border border-line bg-surface p-4 text-sm">
          <Row k="Route" v={shown.route} />
          <Row
            k="Price impact"
            v={`${shown.impactPct < 0.01 ? "<0.01" : shown.impactPct.toFixed(2)}%`}
            tone={impact === "danger" ? "text-danger" : impact === "warn" ? "text-amber-300" : undefined}
          />
          <Row k="Min after slippage" v={`${formatAmt(shown.minOutUi, 6)} ${outTok.symbol}`} />
          <Row k="Slippage" v={slippageLabel(slippageBps)} />
          <Row k="Platform fee" v={`${PLATFORM_FEE_BPS} bps · ${formatUsd(shown.feeUsd)}`} />
          <Row k="Fee mint" v={shown.feeSymbol} />
          <Row k="Fee recipient" v="SolPortal cold wallet" />
        </dl>
      ) : null}

      {shown && impact !== "ok" ? (
        <p className={`mt-3 flex items-start gap-2 rounded-card border p-3 text-xs ${impact === "danger" ? "border-danger/40 text-danger" : "border-amber-400/40 text-amber-300"}`}>
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          High price impact. You get noticeably less than the market rate; try a smaller amount.
        </p>
      ) : null}

      <div className="mt-4">
        <PrimaryButton disabled={blocked} onClick={review}>
          {viewOnly ? "View only" : tooMuch ? "Not enough balance" : !(amountIn > 0) ? "Enter an amount" : !shown ? "Fetching quote…" : "Review swap"}
        </PrimaryButton>
      </div>

      {picking ? <TokenPicker side={picking} onSelect={pick} onClose={() => setPicking(null)} /> : null}
    </div>
  );
}

function SlippagePanel({ bps, onChange }: { bps: number; onChange: (bps: number) => void }) {
  const preset = (SLIPPAGE_PRESETS_BPS as readonly number[]).includes(bps);
  const [custom, setCustom] = useState(preset ? "" : String(bps / 100));
  const [editing, setEditing] = useState(!preset);
  const parsed = useMemo(() => (custom ? parseSlippagePct(custom) : null), [custom]);
  return (
    <div className="mt-3 rounded-card border border-line bg-surface p-3">
      <p className="text-xs text-muted">Max slippage</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {SLIPPAGE_PRESETS_BPS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setEditing(false);
              onChange(value);
            }}
            className={`h-9 rounded-full border text-sm ${!editing && bps === value ? "border-accent bg-accent text-on-accent" : "border-line"}`}
          >
            {slippageLabel(value)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`h-9 rounded-full border text-sm ${editing ? "border-accent text-accent" : "border-line"}`}
        >
          Custom
        </button>
      </div>
      {editing ? (
        <label className="mt-2 flex h-10 items-center gap-2 rounded-control border border-line bg-bg px-3">
          <input
            autoFocus
            inputMode="decimal"
            value={custom}
            placeholder="e.g. 2"
            aria-label="Custom slippage percent"
            onChange={(event) => {
              const text = event.target.value.replace(/[^0-9.]/g, "");
              setCustom(text);
              const next = parseSlippagePct(text);
              if (next) onChange(next);
            }}
            className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
          />
          <span className="text-sm text-muted">%</span>
        </label>
      ) : null}
      {editing && custom && !parsed ? <p className="mt-1 text-xs text-danger">Enter 0.01–50%.</p> : null}
      {bps > 300 ? <p className="mt-1 text-xs text-amber-300">High slippage can get you a much worse price.</p> : null}
    </div>
  );
}

function CountdownRing({ seconds }: { seconds: number }) {
  const total = QUOTE_REFRESH_MS / 1000;
  const r = 7;
  const c = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, seconds / total));
  return (
    <span className="relative grid size-5 place-items-center">
      <svg viewBox="0 0 18 18" className="absolute inset-0 size-5 -rotate-90">
        <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <circle
          cx="9"
          cy="9"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="relative text-[9px] tabular-nums">{seconds}</span>
    </span>
  );
}

function TokenField({
  label,
  token,
  icon,
  amount,
  onAmount,
  hint,
  usd,
  onPick,
  onMax,
  readOnly,
  inputRef,
}: {
  inputRef?: React.Ref<HTMLInputElement>;
  label: string;
  token: CustomToken;
  icon?: string | null;
  amount: string;
  onAmount?: (value: string) => void;
  hint: string;
  usd: number;
  onPick: () => void;
  onMax?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        {onMax ? (
          <button type="button" className="text-xs text-accent" onClick={onMax}>
            Max
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label={`${label}: ${token.symbol}. Change token`}
          className="inline-flex h-11 max-w-[55%] shrink-0 items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-2.5 pl-1"
          onClick={onPick}
        >
          <TokenMark small symbol={token.symbol} src={icon} />
          <span className="truncate text-base font-semibold">{token.symbol}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
        <input
          ref={inputRef}
          inputMode="decimal"
          readOnly={readOnly}
          aria-label={`${label} amount`}
          value={amount}
          placeholder="0"
          onChange={(event) => onAmount?.(event.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full min-w-0 bg-transparent text-right text-2xl font-semibold tabular-nums outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="truncate">{hint}</span>
        <span className="shrink-0 tabular-nums">{usd > 0 ? `≈ ${formatUsd(usd)}` : ""}</span>
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={`text-right break-words ${tone ?? ""}`}>{v}</dd>
    </div>
  );
}
