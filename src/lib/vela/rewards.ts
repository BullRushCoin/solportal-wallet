/** Daily check-in rewards: a 7-day ladder of free trades (platform fee waived). Sandbox only. */
export const REWARD_LADDER = [1, 1, 2, 2, 3, 3, 5] as const;

export type Rewards = {
  /** Day of the current streak that was last claimed (1-7), 0 before the first claim. */
  streak: number;
  /** Local calendar day of the last claim, YYYY-MM-DD. */
  lastClaim: string | null;
  /** Fee-free swaps left to use. */
  freeTrades: number;
};

export const EMPTY_REWARDS: Rewards = { streak: 0, lastClaim: null, freeTrades: 0 };

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function yesterdayKey(now: Date): string {
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 1);
  return dayKey(prev);
}

/** The day (1-7) that today's claim counts as, and whether it is still unclaimed. */
export function rewardStatus(rewards: Rewards, now: Date = new Date()) {
  const today = dayKey(now);
  if (rewards.lastClaim === today) return { day: rewards.streak, claimable: false };
  const continues = rewards.lastClaim === yesterdayKey(now) && rewards.streak > 0 && rewards.streak < REWARD_LADDER.length;
  return { day: continues ? rewards.streak + 1 : 1, claimable: true };
}

export function claimReward(rewards: Rewards, now: Date = new Date()): { next: Rewards; gained: number } | null {
  const status = rewardStatus(rewards, now);
  if (!status.claimable) return null;
  const gained = REWARD_LADDER[status.day - 1] ?? 1;
  return { next: { streak: status.day, lastClaim: dayKey(now), freeTrades: rewards.freeTrades + gained }, gained };
}
