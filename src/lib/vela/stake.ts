import { TOKEN_MAP, type Token } from "@/lib/vela/tokens";

export const STAKE_PROGRAM_ID = "Stake11111111111111111111111111111111111111";
export const U64_MAX = 18_446_744_073_709_551_615n;

export const STAKE_LSTS = [
  { symbol: "JitoSOL", protocol: "Jito", note: "Includes MEV tips" },
  { symbol: "mSOL", protocol: "Marinade", note: "Marinade liquid staking" },
  { symbol: "bSOL", protocol: "BlazeStake", note: "BlazeStake" },
  { symbol: "INF", protocol: "Sanctum", note: "Infinity" },
] as const;

export type StakeLstSymbol = (typeof STAKE_LSTS)[number]["symbol"];

export type StakeSource = "live" | "fallback";

export type LstStakeOption = {
  symbol: StakeLstSymbol;
  name: string;
  mint: string;
  protocol: string;
  note: string;
  apyPct: number | null;
  tvlSol: number | null;
  solPerToken: number | null;
  priceUsd: number | null;
  image: string | null;
  source: StakeSource;
};

export type ValidatorOption = {
  vote: string;
  identity: string | null;
  name: string;
  commissionPct: number | null;
  apyPct: number | null;
  activatedStakeSol: number | null;
  image: string | null;
  delinquent: boolean;
  source: StakeSource;
};

export type EpochSnapshot = {
  epoch: number;
  slotIndex: number | null;
  slotsInEpoch: number | null;
  progressPct: number | null;
  remainingSeconds: number | null;
  source: StakeSource;
};

export type StakeMarketSnapshot = {
  lsts: LstStakeOption[];
  validators: ValidatorOption[];
  epoch: EpochSnapshot | null;
  updatedAt: number;
  live: boolean;
};

export type NativeStakeStatus = "activating" | "active" | "deactivating" | "inactive";

export type NativeStakePosition = {
  id: string;
  vote: string;
  name: string;
  image: string | null;
  amountSol: number;
  activationEpoch: number;
  deactivationEpoch: number | null;
};

export type WatchedStakePosition = {
  pubkey: string;
  vote: string | null;
  validatorName: string | null;
  validatorImage: string | null;
  amountSol: number;
  status: NativeStakeStatus;
  activationEpoch: number | null;
  deactivationEpoch: number | null;
  staker: string | null;
  withdrawer: string | null;
};

export type WatchedStakeWallet = {
  address: string;
  lsts: Array<{
    symbol: string;
    name: string;
    amount: number;
    priceUsd: number | null;
    valueUsd: number | null;
    image: string | null;
    solValue: number | null;
  }>;
  native: WatchedStakePosition[];
  totalStakeSol: number | null;
  totalStakeUsd: number | null;
};

/** Conservative demo APYs used only when live sources fail. */
export const FALLBACK_LST_APY_PCT: Record<StakeLstSymbol, number> = {
  JitoSOL: 4.9,
  mSOL: 5.2,
  bSOL: 4.9,
  INF: 5.4,
};

export const FALLBACK_SOL_PER_TOKEN: Record<StakeLstSymbol, number> = {
  JitoSOL: 1.276,
  mSOL: 1.377,
  bSOL: 1.291,
  INF: 1.408,
};

export function lstToken(symbol: string): Token {
  const token = TOKEN_MAP[symbol];
  if (!token) throw new Error(`Unknown LST ${symbol}`);
  return token;
}

export function solPerLst(lstPriceUsd: number, solPriceUsd: number): number | null {
  if (!(lstPriceUsd > 0) || !(solPriceUsd > 0)) return null;
  return lstPriceUsd / solPriceUsd;
}

export function lstOutForSol(solAmount: number, solPerToken: number): number {
  if (!(solAmount > 0) || !(solPerToken > 0)) return 0;
  return solAmount / solPerToken;
}

export function solOutForLst(lstAmount: number, solPerToken: number): number {
  if (!(lstAmount > 0) || !(solPerToken > 0)) return 0;
  return lstAmount * solPerToken;
}

export function yearlyRewards(
  solAmount: number,
  apyPct: number | null,
  solPriceUsd: number | null,
): { sol: number; usd: number | null } | null {
  if (apyPct === null || !(solAmount > 0)) return null;
  const sol = solAmount * (apyPct / 100);
  const usd = solPriceUsd !== null && solPriceUsd > 0 ? sol * solPriceUsd : null;
  return { sol, usd };
}

export function epochToBigInt(value: number | bigint | string | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value >= 0n ? value : null;
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\d+$/.test(text)) return null;
    return BigInt(text);
  }
  if (!Number.isFinite(value) || value < 0) return null;
  // JSON cannot represent u64 max exactly; the rounded number still means "not deactivating".
  if (!Number.isSafeInteger(value)) return value > Number.MAX_SAFE_INTEGER ? U64_MAX : null;
  return BigInt(value);
}

export function isDeactivatingEpoch(value: number | bigint | string | null | undefined): boolean {
  const n = epochToBigInt(value);
  return n !== null && n !== U64_MAX;
}

export function nativeStakeStatus(
  activationEpoch: number | null,
  deactivationEpoch: number | null,
  currentEpoch: number | null,
): NativeStakeStatus {
  if (isDeactivatingEpoch(deactivationEpoch)) {
    if (currentEpoch === null) return "deactivating";
    return currentEpoch >= (deactivationEpoch as number) ? "inactive" : "deactivating";
  }
  if (activationEpoch === null || currentEpoch === null) return "active";
  return currentEpoch > activationEpoch ? "active" : "activating";
}

export function fallbackStakeMarket(at = Date.now()): StakeMarketSnapshot {
  const lsts: LstStakeOption[] = STAKE_LSTS.map((item) => {
    const token = lstToken(item.symbol);
    return {
      symbol: item.symbol,
      name: token.name,
      mint: token.mint,
      protocol: item.protocol,
      note: item.note,
      apyPct: FALLBACK_LST_APY_PCT[item.symbol],
      tvlSol: null,
      solPerToken: FALLBACK_SOL_PER_TOKEN[item.symbol],
      priceUsd: token.priceUsd,
      image: null,
      source: "fallback",
    };
  });
  return { lsts, validators: [], epoch: null, updatedAt: at, live: false };
}
