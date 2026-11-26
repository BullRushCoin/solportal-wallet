/** Pure helpers for the Swap token picker: Jupiter search mapping and row ordering. */
import { TICKER_COINS } from "@/lib/vela/market-tickers";
import { holdingKeyFor, type CustomToken, type Token } from "@/lib/vela/tokens";

export type PickerToken = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string | null;
  verified: boolean;
  priceUsd: number | null;
  token2022?: boolean;
};

export type PickerRow = PickerToken & {
  /** Holdings key when the wallet knows this mint. */
  key: string | null;
  held: number;
  heldUsd: number;
  /** Pay side only: a token the sandbox wallet does not hold. */
  disabled: boolean;
};

export const SEARCH_LIMIT = 20;

const xstocks = TICKER_COINS.filter((coin) => coin.kind === "stock").slice(0, 2);

/** Quick-pick chips. Mints checked against Jupiter token search (verified). */
export const POPULAR_TOKENS: Array<Pick<PickerToken, "symbol" | "mint" | "name" | "decimals">> = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9 },
  { symbol: "USDC", name: "USD Coin", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "USDT", name: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6 },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5 },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6 },
  { symbol: "JTO", name: "Jito", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", decimals: 9 },
  ...xstocks.map((coin) => ({ symbol: coin.symbol, name: coin.name, mint: coin.mint, decimals: coin.decimals })),
];

export function shortMint(mint: string): string {
  return mint.length <= 10 ? mint : `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/** Map Jupiter `tokens/v2/search` rows. Drops rows without a mint, symbol or decimals. */
export function mapJupiterSearch(body: unknown, limit = SEARCH_LIMIT): PickerToken[] {
  if (!Array.isArray(body)) return [];
  const out: PickerToken[] = [];
  const seen = new Set<string>();
  for (const row of body as Array<Record<string, unknown>>) {
    const mint = typeof row?.id === "string" ? row.id : "";
    const symbol = typeof row?.symbol === "string" ? row.symbol.trim() : "";
    const decimals = typeof row?.decimals === "number" ? row.decimals : NaN;
    if (!mint || !symbol || !Number.isInteger(decimals) || seen.has(mint)) continue;
    seen.add(mint);
    const tags = Array.isArray(row.tags) ? (row.tags as unknown[]).filter((tag): tag is string => typeof tag === "string") : [];
    const price = typeof row.usdPrice === "number" && row.usdPrice > 0 ? row.usdPrice : null;
    out.push({
      mint,
      symbol: symbol.slice(0, 16),
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 48) : symbol,
      decimals,
      icon: typeof row.icon === "string" && /^https:\/\//.test(row.icon) ? row.icon : null,
      verified: row.isVerified === true || tags.includes("verified"),
      priceUsd: price,
      token2022: tags.includes("token-2022") || row.tokenProgram === "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCxEnQuP7m3",
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** 0 exact symbol / mint, 1 symbol prefix, 2 name prefix, 3 contains, -1 no match. */
export function matchScore(token: Pick<PickerToken, "symbol" | "name" | "mint">, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const symbol = token.symbol.toLowerCase().replace(/^\$/, "");
  const name = token.name.toLowerCase();
  if (symbol === q || token.mint.toLowerCase() === q) return 0;
  if (symbol.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (symbol.includes(q) || name.includes(q)) return 3;
  if (q.length >= 4 && token.mint.toLowerCase().startsWith(q)) return 3;
  return -1;
}

/**
 * Picker sections. "Your tokens" come first (by USD value), then live search results that are
 * not already listed. On the pay side, results the wallet does not hold are disabled.
 */
export function buildPickerRows(args: {
  side: "in" | "out";
  query: string;
  held: PickerRow[];
  results: PickerToken[];
  /** Resolve a wallet token by mint so search hits reuse its key and balance. */
  walletByMint: (mint: string) => PickerRow | null;
}): { yours: PickerRow[]; results: PickerRow[] } {
  const q = args.query.trim();
  const yours = args.held
    .filter((row) => row.held > 0)
    .map((row) => ({ row, score: matchScore(row, q) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || b.row.heldUsd - a.row.heldUsd || a.row.symbol.localeCompare(b.row.symbol))
    .map((item) => item.row);
  const listed = new Set(yours.map((row) => row.mint));
  const results: PickerRow[] = [];
  if (q) {
    for (const hit of args.results) {
      if (listed.has(hit.mint)) continue;
      listed.add(hit.mint);
      const known = args.walletByMint(hit.mint);
      const held = known?.held ?? 0;
      results.push({
        ...hit,
        icon: hit.icon ?? known?.icon ?? null,
        key: known?.key ?? null,
        held,
        heldUsd: known?.heldUsd ?? 0,
        disabled: args.side === "in" && !(held > 0),
      });
    }
  }
  return { yours, results };
}

/** The swap-side token for a picked row. Unknown mints get a unique holdings key. */
export function pickerRowToToken(row: PickerRow, taken: (key: string) => Token | null): CustomToken {
  return {
    symbol: row.key ?? holdingKeyFor(row.symbol, row.mint, taken),
    name: row.name,
    mint: row.mint,
    decimals: row.decimals,
    priceUsd: row.priceUsd ?? 0,
    standard: row.token2022 ? "token-2022" : "spl",
    image: row.icon,
    verified: row.verified,
  };
}
