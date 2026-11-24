import { base58Decode } from "@/lib/vela/crypto";

/** Solana addresses are 32-byte public keys encoded as base58 (typically 32–44 chars). */
export function isSolanaAddress(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 32 || trimmed.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) return false;
  try {
    return base58Decode(trimmed).length === 32;
  } catch {
    return false;
  }
}
