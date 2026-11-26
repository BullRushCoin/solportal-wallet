import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useVela } from "@/lib/vela/store";

const DISMISS_KEY = "solportal-explore-banners-dismissed";

type Banner = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  cta: string;
  art: "sun" | "pulse" | "stake" | "radar";
  bg: string;
  go: () => void;
};

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
      art: "sun",
      bg: "linear-gradient(135deg, #3a2a10 0%, #6b4a17 48%, #e0b86a 130%)",
      go: () => setMore("buy"),
    },
    {
      id: "market",
      kicker: "New",
      title: "Market tab, live memecoins",
      body: "New pools with mint and freeze checks.",
      cta: "Open Market",
      art: "pulse",
      bg: "linear-gradient(135deg, #0b2a24 0%, #0f4a3a 55%, #1f8a64 130%)",
      go: () => setTab("market"),
    },
    {
      id: "stake",
      kicker: "Earn",
      title: "Stake SOL",
      body: "JitoSOL, mSOL or bSOL in a few taps.",
      cta: "Start staking",
      art: "stake",
      bg: "linear-gradient(135deg, #1b1b22 0%, #2c2a24 50%, #8a6b33 140%)",
      go: () => setMore("stake"),
    },
    {
      id: "watch",
      kicker: "Track",
      title: "Track any wallet",
      body: "See live holdings for any address.",
      cta: "Watch a wallet",
      art: "radar",
      bg: "linear-gradient(135deg, #0d1c2b 0%, #123049 55%, #2b6c8f 140%)",
      go: () => setMore("watch"),
    },
  ];
}

export function ExploreBanners() {
  const banners = useBanners();
  const [hidden, setHidden] = useState(false);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === "1") setHidden(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

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
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <section className="relative mt-4" aria-roledescription="carousel" aria-label="Highlights">
      <div
        ref={track}
        onScroll={onScroll}
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
            className="relative h-40 w-[calc(100%-1.5rem)] shrink-0 snap-start overflow-hidden rounded-card border border-line text-left"
            style={{ background: banner.bg }}
          >
            <BannerArt kind={banner.art} />
            <span className="relative z-10 flex h-full max-w-[62%] flex-col justify-between p-4">
              <span>
                <span className="font-mono text-[10px] tracking-widest text-fg/70 uppercase">{banner.kicker}</span>
                <span className="mt-1 block text-[17px] leading-tight font-semibold text-balance">{banner.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-snug text-fg/75">{banner.body}</span>
              </span>
              <span className="mt-2 inline-flex h-7 w-fit shrink-0 items-center rounded-full bg-fg/95 px-3 text-xs font-semibold text-bg">{banner.cta}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide highlights"
        className="absolute top-2 right-[3.25rem] z-20 grid size-7 place-items-center rounded-full bg-bg/50 text-fg/80 backdrop-blur"
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

function BannerArt({ kind }: { kind: Banner["art"] }) {
  if (kind === "sun") {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -top-6 -right-8 size-40 rounded-full" style={{ background: "radial-gradient(circle, #f6d996 0%, #e0b86a 35%, transparent 70%)" }} />
        <span className="absolute top-8 right-6 grid size-16 place-items-center rounded-full border-4 border-[#1a1408]/30 bg-[#e0b86a] font-mono text-xl font-bold text-[#1a1408] shadow-lg">◎</span>
        <span className="absolute right-20 bottom-4 size-6 rounded-full bg-[#f6d996]/70" />
      </span>
    );
  }
  if (kind === "pulse") {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -right-10 -bottom-16 size-48 rounded-full" style={{ background: "radial-gradient(circle, rgb(52 211 153 / 0.45) 0%, transparent 65%)" }} />
        <svg viewBox="0 0 120 60" className="absolute top-8 right-3 h-20 w-32">
          <polyline points="0,48 18,40 30,44 44,26 58,32 72,14 86,22 100,8 120,4" fill="none" stroke="#6ee7b7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="100" cy="8" r="4" fill="#e0b86a" />
        </svg>
      </span>
    );
  }
  if (kind === "stake") {
    return (
      <span aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute top-5 right-5 h-24 w-24">
          <span className="absolute inset-x-2 bottom-0 h-6 rounded-[50%] bg-[#e0b86a]/90 shadow-[0_-6px_0_0_#b8914a]" />
          <span className="absolute inset-x-2 bottom-7 h-6 rounded-[50%] bg-[#e0b86a]/80 shadow-[0_-6px_0_0_#a07f40]" />
          <span className="absolute inset-x-2 bottom-14 h-6 rounded-[50%] bg-[#f0cf8a] shadow-[0_-6px_0_0_#c79e55]" />
        </span>
        <span className="absolute -top-10 -right-10 size-36 rounded-full" style={{ background: "radial-gradient(circle, rgb(224 184 106 / 0.35) 0%, transparent 70%)" }} />
      </span>
    );
  }
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className="absolute top-4 right-4 size-28 rounded-full border border-sky-300/30" />
      <span className="absolute top-9 right-9 size-18 rounded-full border border-sky-300/40" />
      <span className="absolute top-14 right-14 size-8 rounded-full border border-sky-300/60" />
      <span className="absolute top-[4.6rem] right-[4.6rem] size-2.5 rounded-full bg-[#e0b86a] shadow-[0_0_12px_#e0b86a]" />
      <span className="absolute top-8 right-20 size-1.5 rounded-full bg-sky-200" />
      <span className="absolute top-24 right-8 size-1.5 rounded-full bg-sky-200" />
    </span>
  );
}
