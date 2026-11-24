import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { feeWalletAddress } from "@/lib/vela/fee-wallet";
import { PLATFORM_FEE_BPS, quoteDemo } from "@/lib/vela/jupiter";
import { formatAmt, formatUsd } from "@/lib/vela/format";
import { withLivePrice } from "@/lib/vela/market";
import { intentBlocked, type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela } from "@/lib/vela/store";
import { TOKENS, tokenBySymbol } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { PrimaryButton, SectionLabel, TokenMark } from "@/components/vela/ui";

export function SwapView() {
  const holdings = useVela((state) => state.holdings);
  const wallet = useVela((state) => state.wallet);
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const [input, setInput] = useState("SOL");
  const [output, setOutput] = useState("USDC");
  const [amount, setAmount] = useState("1");
  const [picking, setPicking] = useState<null | "in" | "out">(null);
  const market = useMarket();

  const amountIn = Number(amount);
  const quote = useMemo(() => {
    if (!wallet || !(amountIn > 0)) return null;
    return quoteDemo(
      withLivePrice(tokenBySymbol(input), market.tokens[input]),
      withLivePrice(tokenBySymbol(output), market.tokens[output]),
      amountIn,
      wallet.address,
      { prioritization: priority },
    );
  }, [amountIn, input, market, output, priority, wallet]);

  const balance = holdings[input] ?? 0;
  const blocked = !quote || amountIn > balance + 1e-8;

  function review() {
    if (!quote || !wallet) return;
    const inputToken = tokenBySymbol(input);
    const outputToken = tokenBySymbol(output);
    const intent: TxIntent = {
      kind: "swap",
      origin: "https://solportal.wallet",
      site: "SolPortal Swap",
      verified: true,
      title: `Swap ${input} for ${output}`,
      input,
      output,
      amountIn,
      amountOut: quote.outUi,
      feeUsd: quote.feeUsd,
      networkFeeSol: priorityFeeSol(priority),
      effects: [
        { symbol: input, delta: -amountIn, usd: -amountIn * inputToken.priceUsd },
        { symbol: output, delta: quote.outUi, usd: quote.outUi * outputToken.priceUsd },
      ],
      authorities: [],
      warnings: [
        {
          level: "info",
          title: `${PLATFORM_FEE_BPS} bps platform fee`,
          detail: `${formatAmt(quote.feeUi, 6)} ${quote.feeMint.symbol} would go to the ${quote.feeMint.symbol} ATA of fee wallet ${feeWalletAddress()} (${quote.feeAccount}). This sandbox does not collect it.`,
        },
      ],
    };
    const reason = intentBlocked(intent, holdings);
    if (reason) {
      intent.warnings = [
        { level: "critical", title: reason, detail: "Reduce the amount or pick another token." },
        ...intent.warnings,
      ];
    }
    setSheet({ kind: "sign", intent });
  }

  function pick(symbol: string) {
    if (picking === "in") {
      if (symbol === output) setOutput(input);
      setInput(symbol);
    } else if (picking === "out") {
      if (symbol === input) setInput(output);
      setOutput(symbol);
    }
    setPicking(null);
  }

  if (picking) {
    return (
      <div className="px-5 pt-5 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Choose token</h2>
          <button className="h-11 px-2 text-sm text-muted" onClick={() => setPicking(null)}>
            Close
          </button>
        </div>
        <ul className="divide-y divide-line rounded-card border border-line">
          {TOKENS.map((token) => (
            <li key={token.symbol}>
              <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => pick(token.symbol)}>
                <TokenMark symbol={token.symbol} />
                <span className="flex-1">
                  <span className="block font-medium">{token.symbol}</span>
                  <span className="block text-xs text-muted">
                    {token.standard === "token-2022" ? "Token-2022" : token.name}
                  </span>
                </span>
                <span className="text-sm text-muted tabular-nums">{formatAmt(holdings[token.symbol] ?? 0, 4)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-6">
      <SectionLabel>Jupiter</SectionLabel>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Swap</h1>
      <p className="mt-2 text-sm text-pretty text-muted">
        Quotes include an {PLATFORM_FEE_BPS} bps platform fee. Jupiter needs that fee on the quote and a fee account on the swap.
        {market.live ? " Amounts use live USD prices; the swap itself stays in this sandbox and is never broadcast." : " Live prices are unavailable, so quotes use the demo price table."}
      </p>
      {!wallet ? (
        <p className="mt-4 rounded-card border border-line bg-surface p-4 text-sm text-pretty text-muted">
          Create a sandbox wallet to try a simulated swap. Watching a public address is read-only.
        </p>
      ) : null}

      <div className="relative mt-5">
        <TokenField
          label="You pay"
          symbol={input}
          amount={amount}
          onAmount={setAmount}
          hint={`Balance ${formatAmt(balance, 4)}`}
          onPick={() => setPicking("in")}
          onMax={() => setAmount(String(balance))}
        />
        <button
          aria-label="Flip pair"
          className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg text-fg"
          onClick={() => {
            setInput(output);
            setOutput(input);
          }}
        >
          <ArrowDown className="size-4" />
        </button>
        <div className="h-3" />
        <TokenField
          label="You receive"
          symbol={output}
          amount={quote ? formatAmt(quote.outUi, 6) : "0"}
          readOnly
          hint={quote ? `Min ${formatAmt(quote.minOutUi, 6)} after slippage` : "Enter an amount"}
          onPick={() => setPicking("out")}
        />
      </div>

      {quote ? (
        <dl className="mt-4 space-y-2 rounded-card border border-line bg-surface p-4 text-sm">
          <Row k="Route" v={quote.jupiter.routePlan.map((hop) => `${hop.swapInfo.label} ${hop.percent}%`).join(" · ")} />
          <Row k="Platform fee" v={`${PLATFORM_FEE_BPS} bps · ${formatUsd(quote.feeUsd)}`} />
          <Row k="Fee mint" v={quote.feeMint.symbol} />
          <Row k="Fee wallet" v={feeWalletAddress()} mono />
          <Row k="Price impact" v={`${quote.impactPct.toFixed(2)}%`} />
          <Row k="Fee account (ATA)" v={quote.feeAccount} mono />
        </dl>
      ) : null}

      <div className="mt-4">
        <PrimaryButton disabled={blocked} onClick={review}>
          {amountIn > balance ? "Not enough balance" : "Review swap"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function TokenField({
  label,
  symbol,
  amount,
  onAmount,
  hint,
  onPick,
  onMax,
  readOnly,
}: {
  label: string;
  symbol: string;
  amount: string;
  onAmount?: (value: string) => void;
  hint: string;
  onPick: () => void;
  onMax?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">{label}</p>
        {onMax ? (
          <button className="text-xs text-accent" onClick={onMax}>
            Max
          </button>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button className="inline-flex items-center gap-2" onClick={onPick}>
          <TokenMark symbol={symbol} />
          <span className="text-lg font-semibold">{symbol}</span>
        </button>
        <input
          inputMode="decimal"
          readOnly={readOnly}
          value={amount}
          onChange={(event) => onAmount?.(event.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-transparent text-right text-2xl font-semibold tabular-nums outline-none"
        />
      </div>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  if (mono) {
    return (
      <div className="space-y-1">
        <dt className="text-muted">{k}</dt>
        <dd className="font-mono text-xs break-all">{v}</dd>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="w-1/2 text-right">{v}</dd>
    </div>
  );
}
