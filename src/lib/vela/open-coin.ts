import { useVela } from "@/lib/vela/store";
import { tokenByMint } from "@/lib/vela/tokens";

export type CoinRef = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number | null;
  image: string | null;
  priceUsd: number | null;
  change24hPct?: number | null;
};

/** Open the coin detail sheet for any mint (same sheet the Market tab uses). */
export function openCoinSheet(coin: CoinRef) {
  const state = useVela.getState();
  const known = tokenByMint(coin.mint);
  const amount = known ? (state.holdings[known.symbol] ?? 0) : 0;
  state.setSheet({
    kind: "asset",
    amount,
    token: {
      symbol: coin.symbol,
      name: coin.name,
      mint: coin.mint,
      decimals: coin.decimals ?? known?.decimals ?? 6,
      priceUsd: coin.priceUsd,
      change24hPct: coin.change24hPct ?? null,
      image: coin.image,
    },
  });
}
