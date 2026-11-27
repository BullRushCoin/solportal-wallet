import { useEffect, useRef, useState } from "react";
import type { MemeFeed } from "@/lib/vela/memecoins";

export type LiveQuote = { priceUsd: number | null; change24hPct: number | null };

/** Run `tick` now and every `ms` while the page is visible and `enabled`; resumes on focus. */
export function useVisiblePoll(tick: () => void, ms: number, enabled = true) {
  const ref = useRef(tick);
  useEffect(() => {
    ref.current = tick;
  });
  useEffect(() => {
    if (!enabled) return;
    let timer: number | null = null;
    const start = () => {
      if (timer !== null) return;
      ref.current();
      timer = window.setInterval(() => ref.current(), ms);
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
}

/** Batch prices for a list of mints via /api/prices (Jupiter, free). */
export function useLivePrices(mints: string[], ms = 30_000): Record<string, LiveQuote> {
  const [prices, setPrices] = useState<Record<string, LiveQuote>>({});
  const key = mints.join(",");
  useVisiblePoll(
    () => {
      if (!key) return;
      const load = (retry: boolean) =>
        void fetch(`/api/prices?mints=${encodeURIComponent(key)}`, { cache: "no-store" })
          .then((res) => (res.ok ? (res.json() as Promise<{ prices?: Record<string, LiveQuote> }>) : null))
          .then((body) => {
            const got = body?.prices && Object.values(body.prices).some((quote) => quote.priceUsd !== null);
            if (got) setPrices((prev) => ({ ...prev, ...body!.prices }));
            else if (retry) window.setTimeout(() => load(false), 4_000);
          })
          .catch(() => {
            if (retry) window.setTimeout(() => load(false), 4_000);
          });
      load(true);
    },
    ms,
    Boolean(key),
  );
  return prices;
}

export type FeedState = { feed: MemeFeed | null; error: boolean; loading: boolean };

/** The memecoin feed, polled every `ms` while visible and not paused. */
export function useMemeFeed(paused: boolean, ms = 15_000, view: "new" | "trending" = "new"): FeedState {
  const [state, setState] = useState<FeedState>({ feed: null, error: false, loading: true });
  const viewRef = useRef(view);
  const load = () => {
    const wanted = viewRef.current;
    void fetch(wanted === "trending" ? "/api/memecoins?view=trending" : "/api/memecoins")
      .then((res) => (res.ok ? (res.json() as Promise<MemeFeed>) : Promise.reject(new Error("feed"))))
      .then((feed) => {
        if (viewRef.current === wanted) setState({ feed, error: false, loading: false });
      })
      .catch(() => {
        if (viewRef.current === wanted) setState((prev) => ({ ...prev, error: true, loading: false }));
      });
  };
  useEffect(() => {
    if (viewRef.current === view) return;
    viewRef.current = view;
    setState({ feed: null, error: false, loading: true });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useVisiblePoll(load, ms, !paused);
  return state;
}

/** A clock that ticks every second, for live ages. */
export function useNow(ms = 1_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}
