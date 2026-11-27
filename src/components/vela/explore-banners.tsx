import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useVela } from "@/lib/vela/store";
import { EMPTY_REWARDS, REWARD_LADDER, rewardStatus } from "@/lib/vela/rewards";

const DISMISS_KEY = "solportal-explore-banners-dismissed";

type Banner = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  image: string;
  go: () => void;
};

function useHomeBanners(): Banner[] {
  const setMore = useVela((state) => state.setMore);
  const canClaim = useVela((state) => rewardStatus(state.rewards ?? EMPTY_REWARDS).claimable);
  const day = useVela((state) => rewardStatus(state.rewards ?? EMPTY_REWARDS).day);
  return [
    {
      id: "rewards",
      kicker: canClaim ? `Day ${day} ready` : "Daily rewards",
      title: canClaim ? `Claim ${REWARD_LADDER[day - 1]} free trade${REWARD_LADDER[day - 1] === 1 ? "" : "s"}` : "Check in daily",
      body: "Up to 5 fee-free trades on Day 7.",
      cta: "Open rewards",
      image: "/banners/rewards.webp",
      go: () => setMore("rewards"),
    },
    {
      id: "incinerate",
      kicker: "1 tap",
      title: "Turn dead coins into SOL",
      body: "Burn dust, close accounts. No dApp.",
      cta: "Clean up",
      image: "/banners/incinerate.webp",
      go: () => document.getElementById("incinerator")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
  ];
}

function useBanners(): Banner[] {
  const setMore = useVela((state) => state.setMore);
  const setTab = useVela((state) => state.setTab);
  return [
    {
      id: "buy",
      kicker: "Buy",
      title: "Buy SOL from $20",
      body: "Pick $20, $25 or $50.",
      cta: "Buy SOL",
      image: "/banners/buy.webp",
      go: () => setMore("buy"),
    },
    {
      id: "market",
      kicker: "New",
      title: "Market tab, live memecoins",
      body: "New pools with mint and freeze checks.",
      cta: "Open Market",
      image: "/banners/market.webp",
      go: () => setTab("market"),
    },
    {
      id: "stake",
      kicker: "Earn",
      title: "Stake SOL",
      body: "JitoSOL, mSOL or bSOL in a few taps.",
      cta: "Start staking",
      image: "/banners/stake.webp",
      go: () => setMore("stake"),
    },
    {
      id: "watch",
      kicker: "Track",
      title: "Track any wallet",
      body: "See live holdings for any address.",
      cta: "Watch a wallet",
      image: "/banners/track.webp",
      go: () => setMore("watch"),
    },
  ];
}

export function HomeBanners() {
  const banners = useHomeBanners();
  return <BannerCarousel banners={banners} storageKey="solportal-home-banners-dismissed" className="-mx-5 mt-6" autoAdvance compact />;
}

export function ExploreBanners() {
  const banners = useBanners();
  return <BannerCarousel banners={banners} storageKey={DISMISS_KEY} className="mt-4" />;
}

function BannerCarousel({
  banners,
  storageKey,
  className,
  autoAdvance,
  compact,
}: {
  banners: Banner[];
  storageKey: string;
  className: string;
  autoAdvance?: boolean;
  compact?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(storageKey) === "1") setHidden(true);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!autoAdvance || paused || hidden) return;
    const timer = window.setInterval(() => {
      const el = track.current;
      if (!el) return;
      const card = el.firstElementChild as HTMLElement | null;
      const step = card ? card.offsetWidth + 12 : el.clientWidth;
      const current = Math.round(el.scrollLeft / step);
      const next = current >= banners.length - 1 ? 0 : current + 1;
      const target = el.children[next] as HTMLElement | undefined;
      if (target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft - 20, behavior: "smooth" });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [autoAdvance, paused, hidden, banners.length]);

  if (hidden) return null;

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 12 : el.clientWidth;
    setIndex(Math.max(0, Math.min(banners.length - 1, Math.round(el.scrollLeft / step))));
  };

  const goTo = (next: number) => {
    const el = track.current;
    const card = el?.children[next] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 20, behavior: "smooth" });
  };

  const dismiss = () => {
    setHidden(true);
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <section className={`relative ${className}`} aria-roledescription="carousel" aria-label="Highlights">
      <div
        ref={track}
        onScroll={onScroll}
        onPointerDown={() => setPaused(true)}
        onTouchStart={() => setPaused(true)}
        className="flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((banner, i) => (
          <button
            key={banner.id}
            type="button"
            onClick={banner.go}
            aria-label={`${banner.title}. ${banner.cta}`}
            aria-roledescription="slide"
            aria-current={i === index ? "true" : undefined}
            className={`group relative ${compact ? "h-[6.5rem]" : "h-[11rem]"} w-[calc(100%-1.5rem)] shrink-0 snap-start overflow-hidden rounded-[1.5rem] bg-[#0c0c10] text-left shadow-[0_10px_28px_-12px_rgb(0_0_0/0.85),0_2px_6px_rgb(0_0_0/0.35)] ring-1 ring-[#e0b86a]/25 ring-inset`}
          >
            <img
              src={banner.image}
              alt=""
              aria-hidden
              draggable={false}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "low"}
              decoding="async"
              className="pointer-events-none absolute inset-0 size-full object-cover object-right transition-transform duration-500 group-active:scale-[1.02]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgb(8 8 11 / 0.92) 0%, rgb(8 8 11 / 0.78) 38%, rgb(8 8 11 / 0.25) 64%, transparent 82%), linear-gradient(0deg, rgb(8 8 11 / 0.45) 0%, transparent 40%)",
              }}
            />
            <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e0b86a]/60 to-transparent" />
            {compact ? (
              <span className="relative z-10 flex h-full max-w-[70%] flex-col justify-center px-4">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-[#e0b86a] uppercase">
                  {banner.kicker}
                </span>
                <span className="mt-1 block truncate text-[17px] leading-tight font-bold tracking-tight text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
                  {banner.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/70">{banner.body}</span>
              </span>
            ) : (
            <span className="relative z-10 flex h-full max-w-[64%] flex-col justify-between p-4 pr-0">
                <span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-[#e0b86a] uppercase">
                    {banner.kicker}
                  </span>
                  <span className="mt-1.5 block text-[19px] leading-[1.15] font-bold tracking-tight text-balance text-white [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
                    {banner.title}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-snug text-white/70">{banner.body}</span>
                </span>
                <span className="mt-2 inline-flex h-8 w-fit shrink-0 items-center rounded-full bg-gradient-to-b from-[#f1d08e] to-[#e0b86a] px-3.5 text-xs font-bold text-[#1a1408] shadow-[0_4px_14px_-4px_rgb(224_184_106/0.6),inset_0_1px_0_rgb(255_255_255/0.45)]">
                  {banner.cta}
                </span>
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide highlights"
        className="absolute top-2.5 right-[3.25rem] z-20 grid size-7 place-items-center rounded-full bg-black/45 text-white/85 ring-1 ring-[#e0b86a]/30 backdrop-blur"
      >
        <X className="size-3.5" />
      </button>
      <div className="mt-2.5 flex justify-center gap-1.5">
        {banners.map((banner, i) => (
          <button
            key={banner.id}
            type="button"
            aria-label={`Show highlight ${i + 1}`}
            onClick={() => goTo(i)}
            className="grid h-4 place-items-center"
          >
            <span className={`block h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-accent" : "w-1.5 bg-line"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
