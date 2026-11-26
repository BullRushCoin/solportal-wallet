/**
 * Coins on the Market tab's ticker strip. Every mint was checked against Jupiter's token
 * search (verified tag) before it went in. xStocks are Backed Finance's tokenized stocks,
 * all issued by the same verified mint authority and tagged "xstocks" by Jupiter.
 */
export type TickerCoin = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  kind: "crypto" | "stock";
};

export const TICKER_COINS: TickerCoin[] = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, kind: "crypto" },
  // Wrapped BTC (Portal / Wormhole), the most liquid BTC on Solana.
  { symbol: "BTC", name: "Bitcoin (Portal)", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, kind: "crypto" },
  // Ether (Portal / Wormhole).
  { symbol: "ETH", name: "Ether (Portal)", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, kind: "crypto" },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, kind: "crypto" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, kind: "crypto" },
  { symbol: "TSLAx", name: "Tesla xStock", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", decimals: 8, kind: "stock" },
  { symbol: "NVDAx", name: "NVIDIA xStock", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", decimals: 8, kind: "stock" },
  { symbol: "AAPLx", name: "Apple xStock", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", decimals: 8, kind: "stock" },
  { symbol: "SPYx", name: "SP500 xStock", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", decimals: 8, kind: "stock" },
];

/** Parse `?mints=a,b,c` into unique, trimmed entries (max `limit`). */
export function parseMintList(raw: string | null, limit = 50): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const mint = part.trim();
    if (mint && !out.includes(mint)) out.push(mint);
    if (out.length >= limit) break;
  }
  return out;
}
