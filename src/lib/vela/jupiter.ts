import { feeAccountForToken } from "@/lib/vela/fee-wallet";
import { tokenBySymbol, type Token } from "@/lib/vela/tokens";

/**
 * In-wallet swap fee. 85 bps = 0.85%, in the range consumer Solana wallets charge.
 * Jupiter's Metis API takes `platformFeeBps` as a uint16 on `/quote`.
 * If it is set, `/swap` must include `feeAccount`.
 */
export const PLATFORM_FEE_BPS = 85;
export const DEFAULT_SLIPPAGE_BPS = 50;

/** Production host. Requests need an `x-api-key` from portal.jup.ag — call this from your backend. */
export const JUPITER_API = "https://api.jup.ag/swap/v1";

/**
 * Keyless public host, fine for prototypes. Same query shape.
 * Do not put a production API key in the client bundle.
 */
export const JUPITER_LITE_API = "https://lite-api.jup.ag/swap/v1";

/**
 * Fee accounts are the associated token accounts of `feeWalletAddress()`.
 * The mint of `feeAccount` must be either the input or the output mint of the swap.
 * Jupiter no longer requires the referral program for Metis swaps.
 * Use `instructionVersion=V2` when the fee mint is Token-2022.
 * This sandbox never broadcasts, so nothing is actually collected.
 */

export type QuoteRequest = {
  inputMint: string;
  outputMint: string;
  /** Raw integer amount, before decimals. ExactIn amount of the input mint. */
  amount: string;
  slippageBps?: number;
  platformFeeBps?: number;
  /** Required to collect fees on a Token-2022 mint. */
  token2022?: boolean;
};

export type SwapBuildRequest = {
  quoteResponse: JupiterQuote;
  userPublicKey: string;
  /** Token account that receives the platform fee. Mint must be in the swap pair. */
  feeAccount: string;
  prioritization?: "low" | "fast" | "protect";
};

export type JupiterQuote = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn";
  slippageBps: number;
  priceImpactPct: string;
  platformFee: { amount: string; feeBps: number } | null;
  routePlan: { percent: number; swapInfo: { label: string; feeAmount: string; feeMint: string } }[];
};

export type DemoQuote = {
  jupiter: JupiterQuote;
  feeAccount: string;
  feeMint: Token;
  feeUi: number;
  feeUsd: number;
  outUi: number;
  minOutUi: number;
  impactPct: number;
  swapBody: ReturnType<typeof buildSwapBody>;
};

export function applyBps(amount: bigint, bps: number): bigint {
  if (bps <= 0) return 0n;
  return (amount * BigInt(bps)) / 10_000n;
}

export function toBaseUnits(amountUi: number, decimals: number): bigint {
  const [whole = "0", frac = ""] = amountUi.toFixed(decimals).split(".");
  const digits = `${whole}${frac.padEnd(decimals, "0")}`.replace(/^-/, "");
  const value = BigInt(digits || "0");
  return amountUi < 0 ? -value : value;
}

export function fromBaseUnits(amount: bigint, decimals: number): number {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const text = abs.toString().padStart(decimals + 1, "0");
  const whole = text.slice(0, -decimals) || "0";
  const frac = text.slice(-decimals);
  const value = Number(`${whole}.${frac}`);
  return negative ? -value : value;
}

/**
 * Collect fees in a treasury-friendly mint (stable or SOL), not a long-tail output.
 * Jupiter pulls the fee from whichever side matches `feeAccount`'s mint.
 */
export function selectFeeMint(input: Token, output: Token): Token {
  const preferred = ["USDC", "PYUSD", "SOL"];
  if (preferred.includes(output.symbol)) return output;
  if (preferred.includes(input.symbol)) return input;
  return output;
}

export function buildQuoteUrl(req: QuoteRequest, base = JUPITER_API): string {
  const params = new URLSearchParams({
    inputMint: req.inputMint,
    outputMint: req.outputMint,
    amount: req.amount,
    slippageBps: String(req.slippageBps ?? DEFAULT_SLIPPAGE_BPS),
    platformFeeBps: String(req.platformFeeBps ?? PLATFORM_FEE_BPS),
    restrictIntermediateTokens: "true",
  });
  if (req.token2022) params.set("instructionVersion", "V2");
  return `${base}/quote?${params.toString()}`;
}

export function buildSwapBody(req: SwapBuildRequest) {
  const priority =
    req.prioritization === "protect"
      ? { priorityLevelWithMaxLamports: { priorityLevel: "veryHigh" as const, maxLamports: 1_000_000, global: false } }
      : req.prioritization === "fast"
        ? { priorityLevelWithMaxLamports: { priorityLevel: "high" as const, maxLamports: 400_000, global: false } }
        : { priorityLevelWithMaxLamports: { priorityLevel: "medium" as const, maxLamports: 100_000, global: false } };

  return {
    quoteResponse: req.quoteResponse,
    userPublicKey: req.userPublicKey,
    feeAccount: req.feeAccount,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: priority,
  };
}

function routeFor(input: Token, output: Token, usd: number) {
  if (usd >= 2000) {
    return [
      { percent: 65, swapInfo: { label: "Whirlpool", feeAmount: "0", feeMint: input.mint } },
      { percent: 35, swapInfo: { label: "Meteora DLMM", feeAmount: "0", feeMint: input.mint } },
    ];
  }
  if (input.symbol === "BONK" || output.symbol === "BONK") {
    return [{ percent: 100, swapInfo: { label: "Raydium", feeAmount: "0", feeMint: input.mint } }];
  }
  return [{ percent: 100, swapInfo: { label: "Orca", feeAmount: "0", feeMint: input.mint } }];
}

/** Local quote used by the sandbox. Same fee math the Jupiter request is built from. */
export function quoteDemo(
  input: Token,
  output: Token,
  amountIn: number,
  userPublicKey: string,
  opts?: { platformFeeBps?: number; slippageBps?: number; prioritization?: "low" | "fast" | "protect" },
): DemoQuote | null {
  if (!(amountIn > 0) || input.symbol === output.symbol) return null;
  const platformFeeBps = opts?.platformFeeBps ?? PLATFORM_FEE_BPS;
  const slippageBps = opts?.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  const feeMint = selectFeeMint(input, output);
  const usd = amountIn * input.priceUsd;
  const impact = Math.min(0.012, usd / 500_000);
  const grossOut = (amountIn * input.priceUsd) / output.priceUsd;
  const afterImpact = grossOut * (1 - impact);

  let outUi: number;
  let feeUi: number;
  if (feeMint.symbol === output.symbol) {
    feeUi = afterImpact * (platformFeeBps / 10_000);
    outUi = afterImpact - feeUi;
  } else if (feeMint.symbol === input.symbol) {
    feeUi = amountIn * (platformFeeBps / 10_000);
    const swapped = amountIn - feeUi;
    outUi = ((swapped * input.priceUsd) / output.priceUsd) * (1 - impact);
  } else {
    feeUi = afterImpact * (platformFeeBps / 10_000);
    outUi = afterImpact - feeUi;
  }

  const inBase = toBaseUnits(amountIn, input.decimals);
  const outBase = toBaseUnits(outUi, output.decimals);
  const feeBase = toBaseUnits(feeUi, feeMint.decimals);
  const minBase = outBase - applyBps(outBase, slippageBps);
  const feeAccount = feeAccountForToken(feeMint);

  const jupiter: JupiterQuote = {
    inputMint: input.mint,
    inAmount: inBase.toString(),
    outputMint: output.mint,
    outAmount: outBase.toString(),
    otherAmountThreshold: (minBase < 0n ? 0n : minBase).toString(),
    swapMode: "ExactIn",
    slippageBps,
    priceImpactPct: impact.toFixed(6),
    platformFee: { amount: feeBase.toString(), feeBps: platformFeeBps },
    routePlan: routeFor(input, output, usd),
  };

  return {
    jupiter,
    feeAccount,
    feeMint,
    feeUi,
    feeUsd: feeUi * feeMint.priceUsd,
    outUi,
    minOutUi: fromBaseUnits(minBase < 0n ? 0n : minBase, output.decimals),
    impactPct: impact * 100,
    swapBody: buildSwapBody({
      quoteResponse: jupiter,
      userPublicKey,
      feeAccount,
      prioritization: opts?.prioritization,
    }),
  };
}

export function sampleQuoteUrl(): string {
  const sol = tokenBySymbol("SOL");
  const usdc = tokenBySymbol("USDC");
  return buildQuoteUrl({
    inputMint: sol.mint,
    outputMint: usdc.mint,
    amount: toBaseUnits(1, sol.decimals).toString(),
    slippageBps: DEFAULT_SLIPPAGE_BPS,
    platformFeeBps: PLATFORM_FEE_BPS,
  });
}
