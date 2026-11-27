import { Check, Flame, Gift, Lock } from "lucide-react";
import { REWARD_LADDER, rewardStatus, EMPTY_REWARDS } from "@/lib/vela/rewards";
import { useVela } from "@/lib/vela/store";
import { PrimaryButton } from "@/components/vela/ui";

/** Daily check-in: a 7-day ladder of free (fee-waived) trades. */
export function RewardsView() {
  const rewards = useVela((state) => state.rewards ?? EMPTY_REWARDS);
  const claimDaily = useVela((state) => state.claimDaily);
  const openSwap = useVela((state) => state.openSwap);
  const status = rewardStatus(rewards);
  // Days already banked in the current streak (today's included once claimed).
  const done = status.claimable ? status.day - 1 : status.day;

  return (
    <div>
      <div
        className="relative overflow-hidden rounded-[1.5rem] border border-[#e0b86a]/30 p-5"
        style={{ background: "radial-gradient(120% 120% at 100% 0%, rgb(224 184 106 / 0.28), transparent 55%), linear-gradient(160deg, #1d1a14, #0f0f11)" }}
      >
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-[#e0b86a] uppercase">
          <Flame className="size-3.5" aria-hidden /> {done > 0 ? `${done}-day streak` : "Start your streak"}
        </p>
        <p className="mt-2 text-[40px] leading-none font-semibold tracking-tight tabular-nums">{rewards.freeTrades}</p>
        <p className="mt-1 text-sm text-muted">free trade{rewards.freeTrades === 1 ? "" : "s"} ready · no 0.85% fee</p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2.5">
        {REWARD_LADDER.map((amount, i) => {
          const day = i + 1;
          const claimed = day <= done;
          const today = status.claimable && day === status.day;
          const big = day === REWARD_LADDER.length;
          return (
            <div
              key={day}
              className={`relative flex flex-col items-center justify-center rounded-2xl border py-3 ${big ? "col-span-2" : ""} ${
                today
                  ? "border-[#e0b86a] bg-[#e0b86a]/12 shadow-[0_0_24px_-6px_rgb(224_184_106/0.7)]"
                  : claimed
                    ? "border-[#e0b86a]/40 bg-surface"
                    : "border-line bg-surface/60"
              }`}
            >
              <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Day {day}</span>
              <span className={`mt-1 grid size-9 place-items-center rounded-full ${claimed ? "bg-[#e0b86a] text-[#1a1408]" : today ? "bg-[#e0b86a]/20 text-[#e0b86a]" : "bg-surface-2 text-muted"}`}>
                {claimed ? <Check className="size-4" /> : today || big ? <Gift className="size-4" /> : <Lock className="size-3.5" />}
              </span>
              <span className={`mt-1 text-xs font-semibold ${claimed || today ? "text-fg" : "text-muted"}`}>
                {amount} free trade{amount === 1 ? "" : "s"}
              </span>
            </div>
          );
        })}
      </div>

      <PrimaryButton className="mt-5" disabled={!status.claimable} onClick={() => claimDaily()}>
        {status.claimable ? `Claim Day ${status.day}: +${REWARD_LADDER[status.day - 1]} free trade${REWARD_LADDER[status.day - 1] === 1 ? "" : "s"}` : "Come back tomorrow"}
      </PrimaryButton>
      {rewards.freeTrades > 0 ? (
        <button type="button" onClick={() => openSwap()} className="mt-3 w-full text-center text-sm font-medium text-accent">
          Use a free trade in Swap
        </button>
      ) : null}
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Check in once a day. Each free trade waives the 0.85% platform fee on one swap. Miss a day and the streak starts again at Day 1; your unused free trades stay. Sandbox rewards, nothing broadcasts.
      </p>
    </div>
  );
}
