/** What the coin sheet's Buy button does, kept pure so it can be tested without the store. */

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type BuyFunds = {
  /** SOL held (UI units). */
  sol: number;
  /** USDC held (UI units). */
  usdc: number;
  /** Live SOL price in USD; a non-positive or missing price counts SOL as worth nothing for the comparison. */
  solPriceUsd: number | null;
  /** USDC price in USD (defaults to 1). */
  usdcPriceUsd?: number | null;
};

export type BuyPlan =
  /** Buying SOL itself goes to the card on-ramp. */
  | { kind: "onramp" }
  /** Anything else opens Swap with this input token and the coin as output. */
  | { kind: "swap"; input: "SOL" | "USDC"; noFunds: boolean };

function positive(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Pick how to buy the coin with `mint`.
 * SOL → on-ramp. USDC → swap from SOL. Any other coin → swap from SOL, or from USDC
 * when the wallet holds more USDC value than SOL value.
 */
export function planCoinBuy(mint: string, funds: BuyFunds): BuyPlan {
  if (mint === SOL_MINT) return { kind: "onramp" };
  const sol = positive(funds.sol);
  const usdc = positive(funds.usdc);
  const noFunds = sol === 0 && usdc === 0;
  if (mint === USDC_MINT) return { kind: "swap", input: "SOL", noFunds: sol === 0 };
  const solUsd = sol * positive(funds.solPriceUsd);
  const usdcUsd = usdc * (positive(funds.usdcPriceUsd) || 1);
  return { kind: "swap", input: usdcUsd > solUsd ? "USDC" : "SOL", noFunds };
}
