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

/** Established Solana-ecosystem coins for the Market tab's "Top coins" list. Mints verified on Jupiter. */
export type TopCoin = { symbol: string; name: string; mint: string; decimals: number; image: string };

const ICON = "https://static.datapi.jup.ag/token-icons/";
export const TOP_COINS: TopCoin[] = [
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, image: `${ICON}79a96c7b893fd899512411dd07a8adf6f9e26dd135989f51d46ddb50f0b8bb6c.webp` },
  { symbol: "BTC", name: "Bitcoin", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, image: `${ICON}010fb6db6c343cd0f90214ab1770278012d0c58a091d1f64715343817dbfb27e.webp` },
  { symbol: "ETH", name: "Ethereum", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, image: `${ICON}c575a248bb3d2411cfcf5483e768987eac04333b8ccf4ddf1ab11ca1970fa28b.webp` },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, image: `${ICON}12254fdd34fa9a0ad62075bd3872df61e28584f9519fe00c744b71b514d4c3d7.webp` },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", decimals: 6, image: `${ICON}e3a3487516776ef5cd3166a0861525d053845b5aa0cf27442a56ca65e673b265.webp` },
  { symbol: "PYTH", name: "Pyth Network", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", decimals: 6, image: `${ICON}2e7287e5e03af0bdcbc4e442da5f687d3b5d28836b958a926302a5aff7d6accd.webp` },
  { symbol: "RENDER", name: "Render", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", decimals: 8, image: `${ICON}aca530a6e0393e07e52c06c30a61cf29367377a6dc8c70abcf75cbcc42996c98.webp` },
  { symbol: "HNT", name: "Helium", mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", decimals: 8, image: "https://entities.nft.helium.io/v2/assets/hnt.png" },
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
