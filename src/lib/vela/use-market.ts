import { useEffect, useState } from "react";
import { fallbackMarketSnapshot, type MarketSnapshot } from "@/lib/vela/market";

let cached: MarketSnapshot | null = null;
let inflight: Promise<MarketSnapshot> | null = null;
const listeners = new Set<(snapshot: MarketSnapshot) => void>();

async function fetchMarket(): Promise<MarketSnapshot> {
  const res = await fetch("/api/market");
  if (!res.ok) throw new Error("market");
  return (await res.json()) as MarketSnapshot;
}

export async function loadMarket(): Promise<MarketSnapshot> {
  if (inflight) return inflight;
  inflight = fetchMarket()
    .then((snapshot) => {
      cached = snapshot;
      for (const listen of listeners) listen(snapshot);
      return snapshot;
    })
    .catch(() => cached ?? fallbackMarketSnapshot())
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useMarket(): MarketSnapshot {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(() => cached ?? fallbackMarketSnapshot());

  useEffect(() => {
    listeners.add(setSnapshot);
    void loadMarket().then(setSnapshot);
    const timer = window.setInterval(() => {
      void loadMarket();
    }, 45_000);
    return () => {
      listeners.delete(setSnapshot);
      window.clearInterval(timer);
    };
  }, []);

  return snapshot;
}
