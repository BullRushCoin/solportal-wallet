import { useState } from "react";
import { BadgeCheck, Coins, KeyRound, ShieldAlert, Star, Link2 } from "lucide-react";
import { Overlay } from "@/components/vela/ui";
import { SectionHeader } from "@/components/vela/explore-ui";

const TIPS = [
  {
    icon: KeyRound,
    title: "Keep your recovery phrase offline",
    body: "Write the 12 words on paper and store them somewhere safe. No screenshots, photos, notes apps or cloud drives.",
  },
  {
    icon: ShieldAlert,
    title: "Never share your phrase",
    body: "SolPortal and its support will never ask for it. Any site, DM or “support agent” asking for your phrase is a scam.",
  },
  {
    icon: BadgeCheck,
    title: "Check the mint and freeze badges",
    body: "In Market, “Mint revoked” means no one can print more supply and “Freeze revoked” means your tokens can’t be locked. “Mint on” or “Freeze on” plus thin liquidity are classic rug-pull signs.",
  },
  {
    icon: Coins,
    title: "Keep a little SOL for fees",
    body: "Every Solana transaction pays a small network fee in SOL, plus a one-time deposit when you receive a new token. Keep some SOL so you’re never stuck.",
  },
  {
    icon: Link2,
    title: "Open apps from Explore",
    body: "Fake airdrop sites copy real apps. Open apps from Discover and check the address bar before you approve anything.",
  },
  {
    icon: Star,
    title: "Use the watchlist",
    body: "Tap the star on any coin to follow it in Market and Explore without buying. Watch first, decide later.",
  },
];

export function LearnCard() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-7 px-5">
      <SectionHeader title="Learn" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative mt-2 block h-36 w-full overflow-hidden rounded-card border border-line text-left"
        style={{ background: "linear-gradient(140deg, #16130c 0%, #2a2214 45%, #4a3a1c 100%)" }}
      >
        <span aria-hidden className="pointer-events-none absolute inset-0">
          <span className="absolute -right-8 -bottom-10 size-44 rounded-full" style={{ background: "radial-gradient(circle, rgb(224 184 106 / 0.45) 0%, transparent 68%)" }} />
          <span
            className="absolute top-5 right-6 h-24 w-20 bg-gradient-to-b from-[#f0cf8a] to-[#b8914a] shadow-[0_8px_24px_rgb(0_0_0/0.4)]"
            style={{ clipPath: "polygon(50% 0, 100% 16%, 100% 52%, 50% 100%, 0 52%, 0 16%)" }}
          />
          <span
            className="absolute top-8 right-9 grid h-[4.5rem] w-14 place-items-center bg-[#1a1408]/85 pb-4 text-xl font-bold text-[#e0b86a]"
            style={{ clipPath: "polygon(50% 0, 100% 16%, 100% 52%, 50% 100%, 0 52%, 0 16%)" }}
          >
            ✓
          </span>
        </span>
        <span className="relative z-10 flex h-full max-w-[66%] flex-col justify-between p-4">
          <span>
            <span className="font-mono text-[10px] tracking-widest text-accent uppercase">SolPortal guide</span>
            <span className="mt-1 block text-lg leading-tight font-semibold text-balance">Protect and grow your crypto</span>
          </span>
          <span className="text-xs text-fg/70">{TIPS.length} quick tips · 2 min read</span>
        </span>
      </button>
      {open ? (
        <Overlay label="SolPortal guide" onClose={() => setOpen(false)}>
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">SolPortal guide</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Protect and grow your crypto</h2>
          <ol className="mt-4 space-y-3">
            {TIPS.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <li key={tip.title} className="flex gap-3 rounded-control border border-line bg-surface-2/60 p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {i + 1}. {tip.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{tip.body}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Overlay>
      ) : null}
    </section>
  );
}
