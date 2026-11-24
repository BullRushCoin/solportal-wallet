import { isSolanaAddress } from "@/lib/vela/address";
import { findAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/vela/pda";
import { TOKEN_MAP, type Token } from "@/lib/vela/tokens";

/** Public fee-collection address. Safe to show in the client — it is not a secret. */
export const DEFAULT_FEE_WALLET = "GD5z4HJRrG6MTwrtceeu3W7mtHwZp7vBtQGkCHJrjJ2c";

function readConfiguredFeeWallet(): string | undefined {
  const candidates: Array<string | undefined> = [];
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
    candidates.push(env?.VITE_FEE_WALLET_ADDRESS, env?.FEE_WALLET_ADDRESS);
  } catch {
    // import.meta.env is optional in unit tests.
  }
  if (typeof process !== "undefined") {
    candidates.push(process.env.VITE_FEE_WALLET_ADDRESS, process.env.FEE_WALLET_ADDRESS);
  }
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Validated fee wallet: env override if it is a base58 pubkey, otherwise the shipped default. */
export function feeWalletAddress(): string {
  const configured = readConfiguredFeeWallet();
  if (configured && isSolanaAddress(configured)) return configured;
  return DEFAULT_FEE_WALLET;
}

export function tokenProgramFor(token: Token): string {
  return token.standard === "token-2022" ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/** Associated token account of the fee wallet for this mint — Jupiter's `feeAccount`. */
export function feeAccountForToken(token: Token, owner = feeWalletAddress()): string {
  return findAssociatedTokenAddress(owner, token.mint, tokenProgramFor(token));
}

export function feeAccountForSymbol(symbol: string, owner = feeWalletAddress()): string | null {
  const token = TOKEN_MAP[symbol];
  if (!token) return null;
  return feeAccountForToken(token, owner);
}
