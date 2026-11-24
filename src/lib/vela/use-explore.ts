import { useEffect, useState } from "react";
import { fallbackExploreSnapshot, isExploreSnapshot, type ExploreSnapshot } from "@/lib/vela/explore";

const REFRESH_MS = 30_000;

let cached: ExploreSnapshot | null = null;
let inflight: Promise<ExploreSnapshot> | null = null;
const listeners = new Set<(snapshot: ExploreSnapshot) => void>();

async function fetchExplore(): Promise<ExploreSnapshot> {
  const res = await fetch("/api/explore");
  if (!res.ok) throw new Error("explore");
  const body: unknown = await res.json();
  if (!isExploreSnapshot(body)) throw new Error("explore-shape");
  return body;
}

export async function loadExplore(): Promise<ExploreSnapshot> {
  if (inflight) return inflight;
  inflight = fetchExplore()
    .then((snapshot) => {
      cached = snapshot;
      for (const listen of listeners) listen(snapshot);
      return snapshot;
    })
    .catch(() => cached ?? fallbackExploreSnapshot())
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useExplore(): ExploreSnapshot {
  const [snapshot, setSnapshot] = useState<ExploreSnapshot>(() => cached ?? fallbackExploreSnapshot());

  useEffect(() => {
    listeners.add(setSnapshot);
    void loadExplore().then(setSnapshot);
    const timer = window.setInterval(() => {
      void loadExplore();
    }, REFRESH_MS);
    return () => {
      listeners.delete(setSnapshot);
      window.clearInterval(timer);
    };
  }, []);

  return snapshot;
}
