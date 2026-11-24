import { heliusApiKey, heliusRpc, loadMarketSnapshot } from "@/lib/vela/helius.server";
import { httpImageUrl } from "@/lib/vela/helius-parse";
import {
  FALLBACK_LST_APY_PCT,
  FALLBACK_SOL_PER_TOKEN,
  STAKE_LSTS,
  STAKE_PROGRAM_ID,
  lstToken,
  solPerLst,
  type EpochSnapshot,
  type LstStakeOption,
  type StakeMarketSnapshot,
  type WatchedStakePosition,
  type ValidatorOption,
  type WatchedStakeWallet,
} from "@/lib/vela/stake";
import {
  lookupLstAmount,
  lookupLstApy,
  parseBlazeApy,
  parseEpochInfo,
  parseJsonParsedStakeAccounts,
  parseMarinadeTvlSol,
  parseSanctumApys,
  parseSanctumSolValues,
  parseSanctumTvl,
  parseStakewizEpoch,
  parseStakewizValidators,
  parseVoteAccounts,
} from "@/lib/vela/stake-parse";

const MARKET_TTL_MS = 60_000;
const POSITION_TTL_MS = 30_000;
const SANCTUM_TVL = "https://extra-api.sanctum.so/v1/tvl/current";
const SANCTUM_SOL_VALUE = "https://extra-api.sanctum.so/v1/sol-value/current";
const SANCTUM_APY = "https://extra-api.sanctum.so/v1/apy/latest";
const BLAZE_APY = "https://stake.solblaze.org/api/v1/apy";
const MARINADE_TVL = "https://api.marinade.finance/tlv";
const STAKEWIZ_VALIDATORS = "https://api.stakewiz.com/validators";
const STAKEWIZ_EPOCH = "https://api.stakewiz.com/epoch_info";
const LST_QUERY = "lst=JitoSOL&lst=mSOL&lst=bSOL&lst=INF";

type CacheEntry<T> = { at: number; value: T };

let marketCache: CacheEntry<StakeMarketSnapshot> | null = null;
const positionCache = new Map<string, CacheEntry<WatchedStakeWallet>>();

async function getJson(url: string, timeoutMs = 8_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export async function loadStakeMarket(): Promise<StakeMarketSnapshot> {
  const now = Date.now();
  if (marketCache && now - marketCache.at < MARKET_TTL_MS) return marketCache.value;

  const [
    sanctumTvl,
    sanctumValue,
    sanctumApy,
    blazeApy,
    marinadeTvl,
    stakewizValidators,
    stakewizEpoch,
    tokenMarket,
  ] = await Promise.all([
    settled(getJson(`${SANCTUM_TVL}?${LST_QUERY}`).then(parseSanctumTvl)),
    settled(getJson(`${SANCTUM_SOL_VALUE}?${LST_QUERY}`).then(parseSanctumSolValues)),
    settled(getJson(`${SANCTUM_APY}?${LST_QUERY}`).then(parseSanctumApys)),
    settled(getJson(BLAZE_APY).then(parseBlazeApy)),
    settled(getJson(MARINADE_TVL).then(parseMarinadeTvlSol)),
    settled(getJson(STAKEWIZ_VALIDATORS, 12_000).then((body) => parseStakewizValidators(body, 12))),
    settled(getJson(STAKEWIZ_EPOCH).then(parseStakewizEpoch)),
    settled(loadMarketSnapshot()),
  ]);

  const lsts: LstStakeOption[] = STAKE_LSTS.map((item) => {
    const token = lstToken(item.symbol);
    const quote = tokenMarket?.tokens[item.symbol];
    const apy =
      lookupLstApy(sanctumApy ?? {}, item.symbol, token.mint) ??
      (item.symbol === "bSOL" ? blazeApy : null);
    const tvl =
      lookupLstAmount(sanctumTvl ?? {}, item.symbol, token.mint) ??
      (item.symbol === "mSOL" ? marinadeTvl : null);
    const solPerToken =
      lookupLstAmount(sanctumValue ?? {}, item.symbol, token.mint) ??
      (quote && tokenMarket ? solPerLst(quote.priceUsd, tokenMarket.tokens.SOL?.priceUsd ?? token.priceUsd) : null) ??
      FALLBACK_SOL_PER_TOKEN[item.symbol];
    const priceUsd = quote?.priceUsd ?? token.priceUsd;
    const liveBits = apy !== null || tvl !== null || lookupLstAmount(sanctumValue ?? {}, item.symbol, token.mint) !== null;
    return {
      symbol: item.symbol,
      name: token.name,
      mint: token.mint,
      protocol: item.protocol,
      note: item.note,
      apyPct: apy ?? FALLBACK_LST_APY_PCT[item.symbol],
      tvlSol: tvl,
      solPerToken,
      priceUsd,
      image: quote?.image ? httpImageUrl(quote.image) : null,
      source: liveBits || quote?.source === "live" ? "live" : "fallback",
    };
  });

  let validators: ValidatorOption[] = stakewizValidators ?? [];
  let epoch: EpochSnapshot | null = stakewizEpoch;

  if ((!validators.length || !epoch) && heliusApiKey()) {
    if (!epoch) {
      epoch = await settled(heliusRpc("getEpochInfo", []).then(parseEpochInfo));
    }
    if (!validators.length) {
      validators = (await settled(heliusRpc("getVoteAccounts", [{ commitment: "processed" }]).then((rpc) => parseVoteAccounts(rpc, null, 12)))) ?? [];
    }
  }

  const snapshot: StakeMarketSnapshot = {
    lsts,
    validators,
    epoch,
    updatedAt: now,
    live: lsts.some((item) => item.source === "live") || validators.some((item) => item.source === "live") || epoch?.source === "live",
  };
  marketCache = { at: now, value: snapshot };
  return snapshot;
}

async function stakeAccountsFor(address: string, offset: number): Promise<unknown> {
  return heliusRpc("getProgramAccounts", [
    STAKE_PROGRAM_ID,
    {
      encoding: "jsonParsed",
      filters: [{ memcmp: { offset, bytes: address } }],
    },
  ]);
}

export async function loadWatchedStake(address: string): Promise<WatchedStakeWallet> {
  const now = Date.now();
  const cached = positionCache.get(address);
  if (cached && now - cached.at < POSITION_TTL_MS) return cached.value;

  const market = await loadStakeMarket();
  const tokenMarket = await settled(loadMarketSnapshot());

  const lsts = market.lsts.map((lst) => ({
    symbol: lst.symbol,
    name: lst.name,
    amount: 0,
    priceUsd: lst.priceUsd,
    valueUsd: null,
    image: lst.image,
    solValue: null as number | null,
  }));

  let native: WatchedStakePosition[] = [];
  if (heliusApiKey()) {
    const currentEpoch = market.epoch?.epoch ?? null;
    const [asWithdrawer, asStaker] = await Promise.all([
      settled(stakeAccountsFor(address, 44)),
      settled(stakeAccountsFor(address, 12)),
    ]);
    const parsed = [
      ...parseJsonParsedStakeAccounts(asWithdrawer, currentEpoch),
      ...parseJsonParsedStakeAccounts(asStaker, currentEpoch),
    ];
    const unique = new Map(parsed.map((item) => [item.pubkey, item]));
    native = [...unique.values()];
    const byVote = new Map(market.validators.map((item) => [item.vote, item]));
    for (const position of native) {
      if (!position.vote) continue;
      const validator = byVote.get(position.vote);
      if (validator) {
        position.validatorName = validator.name;
        position.validatorImage = validator.image;
      } else {
        position.validatorName = `Validator ${position.vote.slice(0, 4)}…${position.vote.slice(-4)}`;
      }
    }
  }

  // Fill LST amounts from getAssets-style wallet is done in the API route (needs /api/wallet data).
  // Here we only return native positions plus LST metadata; the route merges if possible.

  const solPrice = tokenMarket?.tokens.SOL?.priceUsd ?? null;
  const nativeSol = native.reduce((sum, item) => sum + item.amountSol, 0);
  const wallet: WatchedStakeWallet = {
    address,
    lsts: lsts.map((item) => ({
      symbol: item.symbol,
      name: item.name,
      amount: item.amount,
      priceUsd: item.priceUsd,
      valueUsd: null,
      image: item.image,
      solValue: null,
    })),
    native,
    totalStakeSol: nativeSol,
    totalStakeUsd: solPrice !== null ? nativeSol * solPrice : null,
  };
  positionCache.set(address, { at: now, value: wallet });
  return wallet;
}

/** Merge live LST holdings (from /api/wallet) into a watched stake payload. */
export function mergeWatchedLstHoldings(
  stake: WatchedStakeWallet,
  tokens: Array<{ mint?: string; symbol: string; amount: number; priceUsd: number | null; valueUsd: number | null; image: string | null }>,
  solPriceUsd: number | null,
): WatchedStakeWallet {
  const bySymbol = new Map(tokens.map((token) => [token.symbol, token]));
  const byMint = new Map(tokens.filter((token) => token.mint).map((token) => [token.mint as string, token]));
  const lsts = stake.lsts.map((lst) => {
    const meta = marketLst(lst.symbol);
    const token = bySymbol.get(lst.symbol) ?? (meta ? byMint.get(meta) : undefined);
    const amount = token?.amount ?? 0;
    const priceUsd = token?.priceUsd ?? lst.priceUsd;
    const valueUsd = token?.valueUsd ?? (priceUsd !== null ? amount * priceUsd : null);
    const solValue = priceUsd !== null && solPriceUsd && solPriceUsd > 0 ? (amount * priceUsd) / solPriceUsd : null;
    return {
      ...lst,
      amount,
      priceUsd,
      valueUsd,
      image: token?.image ?? lst.image,
      solValue,
    };
  });
  const lstSol = lsts.reduce((sum, item) => sum + (item.solValue ?? 0), 0);
  const nativeSol = stake.native.reduce((sum, item) => sum + item.amountSol, 0);
  const totalStakeSol = lstSol + nativeSol;
  return {
    ...stake,
    lsts,
    totalStakeSol,
    totalStakeUsd: solPriceUsd !== null ? totalStakeSol * solPriceUsd : stake.totalStakeUsd,
  };
}

function marketLst(symbol: string): string | undefined {
  try {
    return lstToken(symbol).mint;
  } catch {
    return undefined;
  }
}

export function clearStakeCaches(): void {
  marketCache = null;
  positionCache.clear();
}
