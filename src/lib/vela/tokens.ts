export type TokenStandard = "native" | "spl" | "token-2022";

export type Token = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  priceUsd: number;
  standard: TokenStandard;
  extension?: string;
};

export type Nft = {
  id: string;
  name: string;
  collection: string;
  pattern: "nft-keel" | "nft-market" | "nft-night";
  image?: string | null;
};

export const TOKENS: Token[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    priceUsd: 73.21,
    standard: "native",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    priceUsd: 1,
    standard: "spl",
  },
  {
    symbol: "PYUSD",
    name: "PayPal USD",
    mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    decimals: 6,
    priceUsd: 1,
    standard: "token-2022",
    extension: "Metadata pointer",
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    priceUsd: 0.248,
    standard: "spl",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    priceUsd: 0.0000219,
    standard: "spl",
  },
  {
    symbol: "JitoSOL",
    name: "Jito Staked SOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
    priceUsd: 96.19,
    standard: "spl",
  },
  {
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    priceUsd: 103.96,
    standard: "spl",
  },
  {
    symbol: "bSOL",
    name: "BlazeStake Staked SOL",
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    decimals: 9,
    priceUsd: 97.05,
    standard: "spl",
  },
  {
    symbol: "INF",
    name: "Sanctum Infinity",
    mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
    decimals: 9,
    priceUsd: 107.16,
    standard: "spl",
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    decimals: 6,
    priceUsd: 0.138,
    standard: "spl",
  },
  {
    symbol: "POPCAT",
    name: "POPCAT",
    mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
    decimals: 9,
    priceUsd: 0.0278,
    standard: "spl",
  },
  {
    symbol: "DEAD",
    name: "Dead Coin",
    mint: "8mQy1s2uSRri9uaibZRpw5F79QTpqevyou5tfBExtLqj",
    decimals: 6,
    priceUsd: 0,
    standard: "spl",
  },
  {
    symbol: "SAMO",
    name: "Samoyedcoin",
    mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    decimals: 9,
    priceUsd: 0.000272,
    standard: "spl",
  },
];

export const TOKEN_MAP = Object.fromEntries(TOKENS.map((token) => [token.symbol, token])) as Record<
  string,
  Token
>;

export const STARTER_HOLDINGS: Record<string, number> = {
  SOL: 18.42,
  USDC: 2450.12,
  PYUSD: 320.44,
  JUP: 840,
  BONK: 12_500_000,
  JitoSOL: 2.1,
  mSOL: 0,
  bSOL: 0,
  INF: 0,
  WIF: 4.2,
  POPCAT: 18,
  DEAD: 1_250_000,
  SAMO: 0,
};

export const STARTER_NFTS: Nft[] = [
  { id: "keel-128", name: "Keel Pass #128", collection: "Keel", pattern: "nft-keel" },
  { id: "market-42", name: "Night Market #42", collection: "Night Market", pattern: "nft-market" },
  { id: "night-7", name: "Harbor Light #7", collection: "Harbor", pattern: "nft-night" },
];

/**
 * A token the sandbox learned about at runtime (e.g. bought through Swap by mint).
 * `symbol` is the holdings key and is unique in the wallet; on a clash with a known
 * symbol it carries a mint suffix ("USDC-Ab12").
 */
export type CustomToken = Token & { image: string | null; verified?: boolean };

const customRegistry = new Map<string, CustomToken>();

/** Replace the runtime registry (store hydration). Known symbols are never shadowed. */
export function setCustomTokens(list: CustomToken[]): void {
  customRegistry.clear();
  for (const token of list) {
    if (!TOKEN_MAP[token.symbol]) customRegistry.set(token.symbol, token);
  }
}

export function customTokenList(): CustomToken[] {
  return [...customRegistry.values()];
}

export function customTokenLookup(symbol: string): CustomToken | null {
  return customRegistry.get(symbol) ?? null;
}

/** Built-in tokens plus anything registered at runtime. */
export function walletTokens(): Token[] {
  return [...TOKENS, ...customRegistry.values()];
}

/** Holdings key for a mint: its own symbol when free, else symbol plus a mint suffix. */
export function holdingKeyFor(symbol: string, mint: string, taken: (key: string) => Token | null = tokenLookup): string {
  const base = (symbol || "UNK").trim().slice(0, 16) || "UNK";
  const owner = taken(base);
  if (!owner || owner.mint === mint) return base;
  return `${base}-${mint.slice(0, 4)}`;
}

export function tokenLookup(symbol: string): Token | null {
  return TOKEN_MAP[symbol] ?? customRegistry.get(symbol) ?? null;
}

export function tokenBySymbol(symbol: string): Token {
  const token = tokenLookup(symbol);
  if (!token) throw new Error(`Unknown token ${symbol}`);
  return token;
}

export function tokenByMint(mint: string): Token | null {
  return TOKENS.find((token) => token.mint === mint) ?? [...customRegistry.values()].find((token) => token.mint === mint) ?? null;
}

export function holdingsUsd(holdings: Record<string, number>, prices?: Record<string, number>): number {
  return Object.entries(holdings).reduce((sum, [symbol, amount]) => {
    const price = prices?.[symbol] ?? tokenLookup(symbol)?.priceUsd ?? 0;
    return sum + amount * price;
  }, 0);
}

/**
 * Keep the built-in table in step with live prices, so every screen that reads
 * `tokenBySymbol(...).priceUsd` (stake, Jito, browser dApps) shows the same SOL price as Swap.
 */
export function syncLivePrices(prices: Record<string, { priceUsd?: number | null } | undefined>): void {
  for (const [symbol, quote] of Object.entries(prices)) {
    const token = TOKEN_MAP[symbol];
    const price = quote?.priceUsd;
    if (token && typeof price === "number" && Number.isFinite(price) && price > 0) token.priceUsd = price;
  }
}
