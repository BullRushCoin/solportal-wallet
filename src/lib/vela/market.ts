import { TOKENS, type Token } from "@/lib/vela/tokens";

export { holdingsUsd } from "@/lib/vela/tokens";

export type MarketTokenQuote = {
  symbol: string;
  mint: string;
  name: string;
  priceUsd: number;
  change24hPct: number | null;
  image: string | null;
  source: "live" | "fallback";
};

export type MarketSnapshot = {
  tokens: Record<string, MarketTokenQuote>;
  updatedAt: number;
  live: boolean;
};

export function fallbackMarketSnapshot(at = Date.now()): MarketSnapshot {
  const tokens: Record<string, MarketTokenQuote> = {};
  for (const token of TOKENS) {
    tokens[token.symbol] = {
      symbol: token.symbol,
      mint: token.mint,
      name: token.name,
      priceUsd: token.priceUsd,
      change24hPct: null,
      image: null,
      source: "fallback",
    };
  }
  return { tokens, updatedAt: at, live: false };
}

export function withLivePrice(token: Token, quote: MarketTokenQuote | undefined): Token {
  if (!quote || !(quote.priceUsd > 0)) return token;
  return { ...token, priceUsd: quote.priceUsd };
}

/** Portfolio-weighted 24h change in percent, or null when no live changes exist. */
export function holdingsChange24h(
  holdings: Record<string, number>,
  quotes: Record<string, MarketTokenQuote>,
): number | null {
  let value = 0;
  let weighted = 0;
  let hasChange = false;
  for (const [symbol, amount] of Object.entries(holdings)) {
    const quote = quotes[symbol];
    const price = quote?.priceUsd ?? TOKENS.find((token) => token.symbol === symbol)?.priceUsd ?? 0;
    const usd = amount * price;
    value += usd;
    if (quote && quote.change24hPct !== null) {
      hasChange = true;
      weighted += usd * quote.change24hPct;
    }
  }
  if (!hasChange || value <= 0) return null;
  return weighted / value;
}
