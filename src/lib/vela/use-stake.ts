import { useEffect, useState } from "react";
import { fallbackStakeMarket, type StakeMarketSnapshot, type WatchedStakeWallet } from "@/lib/vela/stake";

let marketCached: StakeMarketSnapshot | null = null;
let marketInflight: Promise<StakeMarketSnapshot> | null = null;
const marketListeners = new Set<(snapshot: StakeMarketSnapshot) => void>();

async function fetchStakeMarket(): Promise<StakeMarketSnapshot> {
  const res = await fetch("/api/stake");
  if (!res.ok) throw new Error("stake");
  return (await res.json()) as StakeMarketSnapshot;
}

export async function loadStakeMarketClient(): Promise<StakeMarketSnapshot> {
  if (marketInflight) return marketInflight;
  marketInflight = fetchStakeMarket()
    .then((snapshot) => {
      marketCached = snapshot;
      for (const listen of marketListeners) listen(snapshot);
      return snapshot;
    })
    .catch(() => marketCached ?? fallbackStakeMarket())
    .finally(() => {
      marketInflight = null;
    });
  return marketInflight;
}

export function useStakeMarket(): StakeMarketSnapshot {
  const [snapshot, setSnapshot] = useState<StakeMarketSnapshot>(() => marketCached ?? fallbackStakeMarket());
  useEffect(() => {
    marketListeners.add(setSnapshot);
    void loadStakeMarketClient().then(setSnapshot);
    const timer = window.setInterval(() => {
      void loadStakeMarketClient();
    }, 60_000);
    return () => {
      marketListeners.delete(setSnapshot);
      window.clearInterval(timer);
    };
  }, []);
  return snapshot;
}

export function useWatchedStake(address: string | null): {
  data: WatchedStakeWallet | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<WatchedStakeWallet | null>(null);
  const [loading, setLoading] = useState(Boolean(address));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void fetch(`/api/stake-wallet?address=${encodeURIComponent(address)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as WatchedStakeWallet & { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load staking positions.");
        return body;
      })
      .then((wallet) => {
        setData(wallet);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to load staking positions.";
        setError(message === "Failed to fetch" ? "Could not reach the live-data server. Try again." : message);
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [address]);

  return { data, loading, error };
}
