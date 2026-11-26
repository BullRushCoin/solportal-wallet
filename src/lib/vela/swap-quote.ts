/** Pure helpers behind the live Swap tab: amount conversion, quote mapping, slippage. */
import { isSolanaAddress } from "@/lib/vela/address";
import { DEFAULT_SLIPPAGE_BPS, PLATFORM_FEE_BPS, type DemoQuote, type JupiterQuote } from "@/lib/vela/jupiter";

export type SwapSide = {
  symbol: string;
  mint: string;
  decimals: number;
  /** Best known USD price; 0 when unknown. */
  priceUsd: number;
};

export type SwapQuoteView = {
  source: "live" | "estimated";
  inUi: number;
  outUi: number;
  minOutUi: number;
  /** Percent, e.g. 0.42 for 0.42%. */
  impactPct: number;
  route: string;
  /** Output units per 1 input unit, after fees. */
  rate: number;
  feeUi: number;
  feeSymbol: string;
  feeUsd: number;
  slippageBps: number;
  raw: JupiterQuote;
};

export const SLIPPAGE_PRESETS_BPS = [50, 100, 300] as const;
export const MAX_SLIPPAGE_BPS = 5000;
export const QUOTE_REFRESH_MS = 10_000;

/** "1.5" with 9 decimals → "1500000000". Exact string math; null when not a positive amount. */
export function uiToRaw(text: string, decimals: number): string | null {
  const clean = text.trim();
  if (!/^\d*\.?\d*$/.test(clean) || clean === "" || clean === ".") return null;
  const [whole = "", frac = ""] = clean.split(".");
  const digits = `${whole}${frac.slice(0, decimals).padEnd(decimals, "0")}`.replace(/^0+/, "");
  return digits === "" ? null : digits;
}

/** "1500000000" with 9 decimals → 1.5. */
export function rawToUi(raw: string | bigint, decimals: number): number {
  const text = typeof raw === "bigint" ? raw.toString() : raw.trim();
  if (!/^\d+$/.test(text)) return 0;
  if (decimals <= 0) return Number(text);
  const padded = text.padStart(decimals + 1, "0");
  return Number(`${padded.slice(0, -decimals)}.${padded.slice(-decimals)}`);
}

export function impactLevel(pct: number): "ok" | "warn" | "danger" {
  if (pct > 5) return "danger";
  if (pct > 1) return "warn";
  return "ok";
}

/** Route labels from Jupiter's routePlan: "PancakeSwap" or "Perps 68% · Whirlpool 13%". */
export function routeText(plan: JupiterQuote["routePlan"]): string {
  if (!plan.length) return "—";
  const parts = plan.map((hop) => (hop.percent >= 100 ? hop.swapInfo.label : `${hop.swapInfo.label} ${hop.percent}%`));
  return [...new Set(parts)].join(" · ");
}

/** Smart precision so both 71.33 and 0.000004521 read well. */
export function formatRateNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const zeros = Math.max(0, Math.floor(-Math.log10(value)));
  return value.toFixed(Math.min(12, zeros + 4));
}

export function rateLine(inSymbol: string, outSymbol: string, rate: number): string {
  return `1 ${inSymbol} ≈ ${formatRateNumber(rate)} ${outSymbol}`;
}

/**
 * Map a Jupiter ExactIn quote to what the Swap view shows.
 * `outAmount` is already net of the platform fee, which Jupiter takes in the output mint.
 */
export function mapJupiterQuote(quote: JupiterQuote, input: SwapSide, output: SwapSide): SwapQuoteView {
  const inUi = rawToUi(quote.inAmount, input.decimals);
  const outUi = rawToUi(quote.outAmount, output.decimals);
  const minOutUi = rawToUi(quote.otherAmountThreshold, output.decimals);
  const feeUi = quote.platformFee ? rawToUi(quote.platformFee.amount, output.decimals) : 0;
  const impact = Number(quote.priceImpactPct);
  const grossOut = outUi + feeUi;
  const impliedOutPrice = grossOut > 0 && input.priceUsd > 0 ? (inUi * input.priceUsd) / grossOut : 0;
  const outPrice = output.priceUsd > 0 ? output.priceUsd : impliedOutPrice;
  return {
    source: "live",
    inUi,
    outUi,
    minOutUi,
    impactPct: Number.isFinite(impact) ? Math.abs(impact) * 100 : 0,
    route: routeText(quote.routePlan ?? []),
    rate: inUi > 0 ? outUi / inUi : 0,
    feeUi,
    feeSymbol: output.symbol,
    feeUsd: feeUi * outPrice,
    slippageBps: quote.slippageBps,
    raw: quote,
  };
}

/** Same shape from the local price-table quote, used only when the live quote fails. */
export function fromDemoQuote(demo: DemoQuote, amountIn: number, slippageBps: number): SwapQuoteView {
  return {
    source: "estimated",
    inUi: amountIn,
    outUi: demo.outUi,
    minOutUi: demo.minOutUi,
    impactPct: demo.impactPct,
    route: routeText(demo.jupiter.routePlan),
    rate: amountIn > 0 ? demo.outUi / amountIn : 0,
    feeUi: demo.feeUi,
    feeSymbol: demo.feeMint.symbol,
    feeUsd: demo.feeUsd,
    slippageBps,
    raw: demo.jupiter,
  };
}

/** "0.5" → 50 bps. Null outside 0.01%–50%. */
export function parseSlippagePct(text: string): number | null {
  const value = Number(text.trim().replace(/%$/, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  const bps = Math.round(value * 100);
  if (bps < 1 || bps > MAX_SLIPPAGE_BPS) return null;
  return bps;
}

export function slippageLabel(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export type QuoteParams = { inputMint: string; outputMint: string; amount: string; slippageBps: number; platformFeeBps: number };

/** Validate `/api/quote` query params. The platform fee is fixed server-side and never taken from the client. */
export function parseQuoteParams(params: URLSearchParams): { ok: true; value: QuoteParams } | { ok: false; error: string } {
  const inputMint = params.get("inputMint")?.trim() ?? "";
  const outputMint = params.get("outputMint")?.trim() ?? "";
  const amount = params.get("amount")?.trim() ?? "";
  const slippageText = params.get("slippageBps")?.trim();
  if (!isSolanaAddress(inputMint)) return { ok: false, error: "invalid inputMint" };
  if (!isSolanaAddress(outputMint)) return { ok: false, error: "invalid outputMint" };
  if (inputMint === outputMint) return { ok: false, error: "inputMint and outputMint must differ" };
  if (!/^[1-9]\d{0,29}$/.test(amount)) return { ok: false, error: "amount must be a positive integer in base units" };
  const slippageBps = slippageText ? Number(slippageText) : DEFAULT_SLIPPAGE_BPS;
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > MAX_SLIPPAGE_BPS) {
    return { ok: false, error: `slippageBps must be 1–${MAX_SLIPPAGE_BPS}` };
  }
  return { ok: true, value: { inputMint, outputMint, amount, slippageBps, platformFeeBps: PLATFORM_FEE_BPS } };
}

export function quoteCacheKey(params: QuoteParams): string {
  return `${params.inputMint}:${params.outputMint}:${params.amount}:${params.slippageBps}:${params.platformFeeBps}`;
}

/** Keep only the quote fields the client needs (drops Jupiter's diagnostic reports). */
export function trimJupiterQuote(body: unknown): JupiterQuote | null {
  if (!body || typeof body !== "object") return null;
  const q = body as Record<string, unknown>;
  if (typeof q.outAmount !== "string" || typeof q.inAmount !== "string" || !Array.isArray(q.routePlan)) return null;
  const fee = q.platformFee as { amount?: unknown; feeBps?: unknown } | null | undefined;
  return {
    inputMint: String(q.inputMint),
    inAmount: q.inAmount,
    outputMint: String(q.outputMint),
    outAmount: q.outAmount,
    otherAmountThreshold: String(q.otherAmountThreshold ?? q.outAmount),
    swapMode: "ExactIn",
    slippageBps: Number(q.slippageBps ?? DEFAULT_SLIPPAGE_BPS),
    priceImpactPct: String(q.priceImpactPct ?? "0"),
    platformFee: fee && typeof fee.amount === "string" ? { amount: fee.amount, feeBps: Number(fee.feeBps ?? PLATFORM_FEE_BPS) } : null,
    routePlan: (q.routePlan as Array<{ percent?: unknown; swapInfo?: { label?: unknown; feeAmount?: unknown; feeMint?: unknown } }>).map((hop) => ({
      percent: Number(hop.percent ?? 100),
      swapInfo: {
        label: String(hop.swapInfo?.label ?? "Unknown"),
        feeAmount: String(hop.swapInfo?.feeAmount ?? "0"),
        feeMint: String(hop.swapInfo?.feeMint ?? ""),
      },
    })),
  };
}
