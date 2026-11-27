import { isSolanaAddress } from "@/lib/vela/address";
import { feeWalletAddress } from "@/lib/vela/fee-wallet";
import { TOKENS, tokenByMint, type Token } from "@/lib/vela/tokens";

/** Rent-exempt minimum for a standard SPL token account. */
export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280;
export const TOKEN_ACCOUNT_RENT_SOL = TOKEN_ACCOUNT_RENT_LAMPORTS / 1e9;

/** Holdings at or below this USD value (or with no price) count as dead / dust. */
export const DEAD_VALUE_USD = 1;

/** Default platform fee on reclaimed SOL (rent + swap proceeds). 500 bps = 5%. */
export const DEFAULT_INCINERATOR_FEE_BPS = 500;

export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export type IncineratorAction = "swap" | "burn";

export type IncineratorItem = {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number | null;
  image: string | null;
  rentSol: number;
  swapSol: number | null;
  action: IncineratorAction;
  quoteSource: "live" | "fallback" | "none";
};

export type IncineratorPlan = {
  items: IncineratorItem[];
  hiddenCount: number;
  count: number;
  dustValueUsd: number | null;
  rentSol: number;
  swapSol: number;
  feeSol: number;
  feeBps: number;
  netSol: number;
  feeWallet: string;
  live: boolean;
  updatedAt: number;
};

export type IncineratorInput = {
  mint: string;
  symbol?: string;
  name?: string;
  amount: number;
  decimals: number;
  priceUsd?: number | null;
  image?: string | null;
};

const NATIVE_MINTS = new Set([WSOL_MINT, "11111111111111111111111111111111"]);

export function incineratorFeeBps(): number {
  const raw = readEnv("VITE_INCINERATOR_FEE_BPS") ?? readEnv("INCINERATOR_FEE_BPS");
  if (raw === undefined) return DEFAULT_INCINERATOR_FEE_BPS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 2_000) return DEFAULT_INCINERATOR_FEE_BPS;
  return Math.round(n);
}

function readEnv(name: string): string | undefined {
  const candidates: Array<string | undefined> = [];
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    candidates.push(env?.[name]);
  } catch {
    // import.meta.env is optional in unit tests.
  }
  if (typeof process !== "undefined") candidates.push(process.env[name]);
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function isNativeSol(symbolOrMint: string): boolean {
  return symbolOrMint === "SOL" || NATIVE_MINTS.has(symbolOrMint);
}

/** True for empty token accounts, unpriced tokens, or holdings worth less than $1. Native SOL is never dead. */
export function isDeadCoin(input: { symbol?: string; mint?: string; amount: number; valueUsd: number | null }): boolean {
  if (input.symbol && isNativeSol(input.symbol)) return false;
  if (input.mint && isNativeSol(input.mint)) return false;
  if (input.amount === 0) return true;
  if (!(input.amount > 0)) return false;
  if (input.valueUsd === null) return true;
  return input.valueUsd < DEAD_VALUE_USD;
}

export function holdingValueUsd(amount: number, priceUsd: number | null | undefined): number | null {
  if (priceUsd === null || priceUsd === undefined || !(priceUsd >= 0) || Number.isNaN(priceUsd)) return null;
  if (!(amount > 0)) return 0;
  return amount * priceUsd;
}

export function feeOnReclaimed(rentSol: number, swapSol: number, feeBps: number): number {
  const gross = Math.max(0, rentSol) + Math.max(0, swapSol);
  if (!(feeBps > 0) || !(gross > 0)) return 0;
  return gross * (feeBps / 10_000);
}

export function summarizePlan(
  items: IncineratorItem[],
  options?: { feeBps?: number; feeWallet?: string; updatedAt?: number; live?: boolean; hiddenCount?: number },
): IncineratorPlan {
  const feeBps = options?.feeBps ?? incineratorFeeBps();
  const rentSol = items.reduce((sum, item) => sum + item.rentSol, 0);
  const swapSol = items.reduce((sum, item) => sum + (item.swapSol ?? 0), 0);
  const feeSol = feeOnReclaimed(rentSol, swapSol, feeBps);
  const values = items.map((item) => item.valueUsd).filter((value): value is number => value !== null);
  const unknown = items.some((item) => item.amount > 0 && item.valueUsd === null);
  return {
    items,
    hiddenCount: options?.hiddenCount ?? 0,
    count: items.length + (options?.hiddenCount ?? 0),
    dustValueUsd: values.length ? values.reduce((sum, value) => sum + value, 0) : unknown ? null : 0,
    rentSol,
    swapSol,
    feeSol,
    feeBps,
    netSol: Math.max(0, rentSol + swapSol - feeSol),
    feeWallet: options?.feeWallet ?? feeWalletAddress(),
    live: options?.live ?? false,
    updatedAt: options?.updatedAt ?? Date.now(),
  };
}

/** Sandbox leftover accounts with a zero balance that still have reclaimable rent. */
export const SANDBOX_EMPTY_ACCOUNT_SYMBOLS = new Set(["SAMO"]);

export function sandboxIncineratorInputs(
  holdings: Record<string, number>,
  customTokens: ReadonlyArray<{ symbol: string; name: string; mint: string; decimals: number; priceUsd: number; image?: string | null }> = [],
): IncineratorInput[] {
  const known = TOKENS.filter((token) => token.symbol !== "SOL").flatMap((token) => {
    const amount = holdings[token.symbol];
    if (amount === undefined) return [];
    if (amount === 0 && !SANDBOX_EMPTY_ACCOUNT_SYMBOLS.has(token.symbol)) return [];
    return [
      {
        mint: token.mint,
        symbol: token.symbol,
        name: token.name,
        amount,
        decimals: token.decimals,
        priceUsd: token.priceUsd,
      },
    ];
  });
  const seen = new Set(known.map((item) => item.mint));
  // Tokens bought through Swap live in customTokens, keyed in holdings by their (possibly suffixed) symbol.
  const custom = customTokens.flatMap((token) => {
    const amount = holdings[token.symbol];
    if (!(amount > 0) || seen.has(token.mint) || isNativeSol(token.mint)) return [];
    seen.add(token.mint);
    return [
      {
        mint: token.mint,
        symbol: token.symbol,
        name: token.name,
        amount,
        decimals: token.decimals,
        priceUsd: token.priceUsd > 0 ? token.priceUsd : null,
        image: token.image ?? null,
      },
    ];
  });
  return [...known, ...custom];
}

export function preferSwapOutput(fromSymbol: string): string {
  return fromSymbol === "USDC" ? "SOL" : "USDC";
}

export function asSwapToken(input: {
  symbol: string;
  name?: string;
  mint?: string;
  decimals?: number;
  priceUsd?: number | null;
}): Token {
  const known = tokenByMint(input.mint ?? "") ?? TOKENS.find((token) => token.symbol === input.symbol);
  if (known) return known;
  const mint = input.mint && isSolanaAddress(input.mint) ? input.mint : WSOL_MINT;
  return {
    symbol: input.symbol || "UNK",
    name: input.name ?? input.symbol,
    mint,
    decimals: input.decimals ?? 9,
    priceUsd: input.priceUsd && input.priceUsd > 0 ? input.priceUsd : 0,
    standard: "spl",
  };
}
