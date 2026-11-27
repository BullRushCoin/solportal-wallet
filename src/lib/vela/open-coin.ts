import { planCoinBuy } from "@/lib/vela/buy-coin";
import { useVela, type AssetSheetToken } from "@/lib/vela/store";
import { tokenByMint, tokenBySymbol } from "@/lib/vela/tokens";
import { marketSnapshotNow } from "@/lib/vela/use-market";

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

/**
 * The coin sheet's Buy button. SOL opens the card on-ramp; any other coin opens Swap with
 * that coin as the output (registered as a runtime token when it is new) and SOL or USDC as
 * the input, whichever the wallet holds more of by value. USDC itself is bought with SOL.
 */
export function buyCoin(token: AssetSheetToken) {
  const state = useVela.getState();
  const market = marketSnapshotNow();
  const plan = planCoinBuy(token.mint, {
    sol: state.holdings.SOL ?? 0,
    usdc: state.holdings.USDC ?? 0,
    solPriceUsd: market.tokens.SOL?.priceUsd ?? tokenBySymbol("SOL").priceUsd,
    usdcPriceUsd: market.tokens.USDC?.priceUsd ?? 1,
  });
  state.setSheet(null);
  if (plan.kind === "onramp") {
    state.setMore("buy");
    return;
  }
  state.openSwap({
    input: plan.input,
    output: token.symbol,
    buy: true,
    token: {
      symbol: token.symbol,
      name: token.name,
      mint: token.mint,
      decimals: token.decimals,
      priceUsd: token.priceUsd,
      image: token.image ?? null,
    },
  });
}
