import { base58Encode } from "@/lib/vela/crypto";
import { asArray, asNumber, asRecord, asString, httpImageUrl } from "@/lib/vela/helius-parse";
import {
  STAKE_LSTS,
  epochToBigInt,
  isDeactivatingEpoch,
  U64_MAX,
  nativeStakeStatus,
  type EpochSnapshot,
  type LstStakeOption,
  type NativeStakeStatus,
  type StakeLstSymbol,
  type ValidatorOption,
  type WatchedStakePosition,
} from "@/lib/vela/stake";

export function parseSanctumTvl(payload: unknown): Record<string, number> {
  const root = asRecord(payload);
  const tvls = asRecord(root?.tvls) ?? root;
  const out: Record<string, number> = {};
  if (!tvls) return out;
  for (const [key, value] of Object.entries(tvls)) {
    const raw = asNumber(value);
    if (raw === null) continue;
    // Sanctum returns lamports of SOL in the pool.
    out[key] = raw > 1_000_000 ? raw / 1e9 : raw;
  }
  return out;
}

/** Sanctum `solValues` are lamports of SOL per 1 whole LST token. */
export function parseSanctumSolValues(payload: unknown): Record<string, number> {
  const root = asRecord(payload);
  const values = asRecord(root?.solValues) ?? root;
  const out: Record<string, number> = {};
  if (!values) return out;
  for (const [key, value] of Object.entries(values)) {
    const raw = asNumber(value);
    if (raw === null || raw <= 0) continue;
    out[key] = raw > 1000 ? raw / 1e9 : raw;
  }
  return out;
}

export function parseSanctumApys(payload: unknown): Record<string, number> {
  const root = asRecord(payload);
  const apys = asRecord(root?.apys) ?? root;
  const out: Record<string, number> = {};
  if (!apys) return out;
  for (const [key, value] of Object.entries(apys)) {
    const raw = asNumber(value);
    if (raw === null || raw <= 0) continue;
    // Accept either 0.049 or 4.9
    out[key] = raw > 0 && raw < 0.5 ? raw * 100 : raw;
  }
  return out;
}

export function parseBlazeApy(payload: unknown): number | null {
  const root = asRecord(payload);
  const raw = asNumber(root?.apy) ?? asNumber(root?.total) ?? asNumber(root?.base);
  if (raw === null || raw <= 0) return null;
  return raw > 0 && raw < 0.5 ? raw * 100 : raw;
}

export function parseMarinadeTvlSol(payload: unknown): number | null {
  const root = asRecord(payload);
  return (
    asNumber(root?.staked_sol) ??
    asNumber(root?.total_virtual_staked_sol) ??
    asNumber(root?.total_sol) ??
    null
  );
}

function validatorApy(rec: Record<string, unknown>): number | null {
  const raw =
    asNumber(rec.total_apy) ??
    asNumber(rec.staking_apy) ??
    asNumber(rec.apy_estimate) ??
    asNumber(rec.apy);
  if (raw === null || raw <= 0) return null;
  return raw > 0 && raw < 0.5 ? raw * 100 : raw;
}

export function parseStakewizValidators(payload: unknown, limit = 12): ValidatorOption[] {
  const list = asArray(payload);
  const rows: ValidatorOption[] = [];
  for (const item of list) {
    const rec = asRecord(item);
    if (!rec) continue;
    const vote = asString(rec.vote_identity) ?? asString(rec.votePubkey);
    if (!vote) continue;
    const delinquent = rec.delinquent === true;
    const commission = asNumber(rec.commission);
    if (delinquent) continue;
    if (commission !== null && commission >= 100) continue;
    const name = asString(rec.name) ?? `Validator ${vote.slice(0, 4)}`;
    const activated = asNumber(rec.activated_stake);
    rows.push({
      vote,
      identity: asString(rec.identity) ?? asString(rec.nodePubkey),
      name,
      commissionPct: commission,
      apyPct: validatorApy(rec),
      activatedStakeSol: activated,
      image: httpImageUrl(rec.image) ?? httpImageUrl(rec.logo),
      delinquent: false,
      source: "live",
    });
  }
  rows.sort((a, b) => (b.activatedStakeSol ?? 0) - (a.activatedStakeSol ?? 0));
  return rows.slice(0, limit);
}

export function parseStakewizEpoch(payload: unknown): EpochSnapshot | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const epoch = asNumber(rec.epoch);
  if (epoch === null) return null;
  const duration = asNumber(rec.duration_seconds);
  const elapsed = asNumber(rec.elapsed_seconds);
  const remaining = asNumber(rec.remaining_seconds);
  const progress =
    duration && duration > 0 && elapsed !== null ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : null;
  return {
    epoch,
    slotIndex: asNumber(rec.slot_height) ?? asNumber(rec.slotIndex),
    slotsInEpoch: asNumber(rec.epoch_slot_height) ?? asNumber(rec.slotsInEpoch),
    progressPct: progress,
    remainingSeconds: remaining,
    source: "live",
  };
}

export function parseEpochInfo(rpc: unknown): EpochSnapshot | null {
  const rec = asRecord(asRecord(rpc)?.result) ?? asRecord(rpc);
  if (!rec) return null;
  const epoch = asNumber(rec.epoch);
  if (epoch === null) return null;
  const slotIndex = asNumber(rec.slotIndex);
  const slotsInEpoch = asNumber(rec.slotsInEpoch);
  const progress =
    slotIndex !== null && slotsInEpoch && slotsInEpoch > 0
      ? Math.min(100, Math.max(0, (slotIndex / slotsInEpoch) * 100))
      : null;
  const remainingSlots = slotIndex !== null && slotsInEpoch ? Math.max(0, slotsInEpoch - slotIndex) : null;
  return {
    epoch,
    slotIndex,
    slotsInEpoch,
    progressPct: progress,
    remainingSeconds: remainingSlots !== null ? remainingSlots * 0.4 : null,
    source: "live",
  };
}

export function parseVoteAccounts(rpc: unknown, clusterApyPct: number | null, limit = 12): ValidatorOption[] {
  const rec = asRecord(asRecord(rpc)?.result) ?? asRecord(rpc);
  if (!rec) return [];
  const current = asArray(rec.current);
  const rows: ValidatorOption[] = [];
  for (const item of current) {
    const row = asRecord(item);
    if (!row) continue;
    const vote = asString(row.votePubkey);
    if (!vote) continue;
    const commission = asNumber(row.commission);
    if (commission !== null && commission >= 100) continue;
    const activatedLamports = asNumber(row.activatedStake);
    const activated = activatedLamports !== null ? activatedLamports / 1e9 : null;
    const apy =
      clusterApyPct !== null && commission !== null
        ? clusterApyPct * (1 - Math.min(100, Math.max(0, commission)) / 100)
        : clusterApyPct;
    rows.push({
      vote,
      identity: asString(row.nodePubkey),
      name: `Validator ${vote.slice(0, 4)}…${vote.slice(-4)}`,
      commissionPct: commission,
      apyPct: apy,
      activatedStakeSol: activated,
      image: null,
      delinquent: false,
      source: "live",
    });
  }
  rows.sort((a, b) => (b.activatedStakeSol ?? 0) - (a.activatedStakeSol ?? 0));
  return rows.slice(0, limit);
}

function epochFromUnknown(value: unknown): number | null {
  const n = epochToBigInt(
    typeof value === "number" || typeof value === "bigint" || typeof value === "string" ? value : asNumber(value),
  );
  if (n === null || n === U64_MAX) return null;
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(n);
}

export function parseJsonParsedStakeAccounts(rpc: unknown, currentEpoch: number | null): WatchedStakePosition[] {
  const result = asArray(asRecord(rpc)?.result) ?? asArray(rpc);
  const positions: WatchedStakePosition[] = [];
  for (const item of result) {
    const rec = asRecord(item);
    if (!rec) continue;
    const pubkey = asString(rec.pubkey);
    if (!pubkey) continue;
    const account = asRecord(rec.account);
    const data = asRecord(account?.data);
    const parsed = asRecord(data?.parsed);
    const info = asRecord(parsed?.info) ?? parsed;
    if (!info) continue;
    const meta = asRecord(info.meta);
    const authorized = asRecord(meta?.authorized);
    const stake = asRecord(info.stake);
    const delegation = asRecord(stake?.delegation);
    const lamports = asNumber(delegation?.stake) ?? asNumber(account?.lamports);
    const amountSol = lamports !== null ? (lamports > 1000 ? lamports / 1e9 : lamports) : 0;
    const activation = asNumber(delegation?.activationEpoch);
    const deactivation = epochFromUnknown(delegation?.deactivationEpoch);
    const vote = asString(delegation?.voter) ?? asString(delegation?.voterPubkey);
    const status: NativeStakeStatus = nativeStakeStatus(activation, deactivation, currentEpoch);
    positions.push({
      pubkey,
      vote,
      validatorName: null,
      validatorImage: null,
      amountSol,
      status,
      activationEpoch: activation,
      deactivationEpoch: deactivation,
      staker: asString(authorized?.staker),
      withdrawer: asString(authorized?.withdrawer),
    });
  }
  return positions;
}

/** Raw 200-byte Stake state layout (enum u32 + meta + stake). */
export function parseRawStakeAccount(pubkey: string, data: Uint8Array, currentEpoch: number | null): WatchedStakePosition | null {
  if (data.length < 172) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const kind = view.getUint32(0, true);
  if (kind !== 2) return null;
  const staker = data.slice(12, 44);
  const withdrawer = data.slice(44, 76);
  const voter = data.slice(124, 156);
  const amountLamports = view.getBigUint64(156, true);
  const activationEpoch = Number(view.getBigUint64(164, true));
  const deactivationRaw = view.getBigUint64(172, true);
  const deactivation = isDeactivatingEpoch(deactivationRaw) ? Number(deactivationRaw) : null;
  return {
    pubkey,
    vote: base58Encode(voter),
    validatorName: null,
    validatorImage: null,
    amountSol: Number(amountLamports) / 1e9,
    status: nativeStakeStatus(activationEpoch, deactivation, currentEpoch),
    activationEpoch,
    deactivationEpoch: deactivation,
    staker: base58Encode(staker),
    withdrawer: base58Encode(withdrawer),
  };
}

export function lookupLstApy(map: Record<string, number>, symbol: StakeLstSymbol, mint: string): number | null {
  return map[symbol] ?? map[mint] ?? map[symbol.toLowerCase()] ?? null;
}

export function lookupLstAmount(map: Record<string, number>, symbol: StakeLstSymbol, mint: string): number | null {
  return map[symbol] ?? map[mint] ?? map[symbol.toLowerCase()] ?? null;
}

export function mergeLstOption(base: LstStakeOption, patch: Partial<LstStakeOption>): LstStakeOption {
  const next = { ...base, ...patch };
  if (patch.source) next.source = patch.source;
  else if (patch.apyPct != null || patch.tvlSol != null || patch.solPerToken != null) next.source = "live";
  return next;
}

export { STAKE_LSTS };
