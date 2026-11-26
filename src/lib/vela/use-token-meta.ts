import { useEffect, useState } from "react";
import type { PickerToken } from "@/lib/vela/token-picker";

const known = new Map<string, PickerToken | null>();
const listeners = new Set<() => void>();
const inflight = new Set<string>();

async function load(mints: string[]) {
  const missing = mints.filter((mint) => !known.has(mint) && !inflight.has(mint));
  if (!missing.length) return;
  for (const mint of missing) inflight.add(mint);
  try {
    const res = await fetch(`/api/token-search?mints=${missing.join(",")}`);
    const body = res.ok ? ((await res.json()) as { tokens?: PickerToken[] }) : null;
    for (const mint of missing) known.set(mint, body?.tokens?.find((token) => token.mint === mint) ?? null);
    for (const listen of listeners) listen();
  } catch {
    // Icons are cosmetic; leave the letter marks.
  } finally {
    for (const mint of missing) inflight.delete(mint);
  }
}

/** Jupiter metadata (icon, verified, price) for a set of mints, fetched in one batch and cached for the session. */
export function useTokenMeta(mints: string[]): Record<string, PickerToken> {
  const key = [...new Set(mints)].sort().join(",");
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listen = () => setVersion((value) => value + 1);
    listeners.add(listen);
    if (key) void load(key.split(","));
    return () => {
      listeners.delete(listen);
    };
  }, [key]);
  const out: Record<string, PickerToken> = {};
  for (const mint of key ? key.split(",") : []) {
    const meta = known.get(mint);
    if (meta) out[mint] = meta;
  }
  return out;
}
