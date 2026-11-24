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
};

export const TOKENS: Token[] = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
    priceUsd: 178.42,
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
    priceUsd: 0.92,
    standard: "spl",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    priceUsd: 0.0000214,
    standard: "spl",
  },
  {
    symbol: "JitoSOL",
    name: "Jito Staked SOL",
    mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    decimals: 9,
    priceUsd: 192.15,
    standard: "spl",
  },
  {
    symbol: "mSOL",
    name: "Marinade Staked SOL",
    mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    decimals: 9,
    priceUsd: 201.4,
    standard: "spl",
  },
  {
    symbol: "bSOL",
    name: "BlazeStake Staked SOL",
    mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
    decimals: 9,
    priceUsd: 196.8,
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
};

export const STARTER_NFTS: Nft[] = [
  { id: "keel-128", name: "Keel Pass #128", collection: "Keel", pattern: "nft-keel" },
  { id: "market-42", name: "Night Market #42", collection: "Night Market", pattern: "nft-market" },
  { id: "night-7", name: "Harbor Light #7", collection: "Harbor", pattern: "nft-night" },
];

export function tokenBySymbol(symbol: string): Token {
  const token = TOKEN_MAP[symbol];
  if (!token) throw new Error(`Unknown token ${symbol}`);
  return token;
}

export function holdingsUsd(holdings: Record<string, number>): number {
  return Object.entries(holdings).reduce((sum, [symbol, amount]) => {
    const token = TOKEN_MAP[symbol];
    return sum + (token ? amount * token.priceUsd : 0);
  }, 0);
}
