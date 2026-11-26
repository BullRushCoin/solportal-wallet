/**
 * Explore → Discover: well-known Solana apps with honest one-line taglines.
 * Apps that exist in the sandbox dapp catalog (`dapps.ts`) carry `dappId` and open through
 * `openDapp`; the rest open their official URL in the in-app browser via `openExternal`.
 * Logos: DefiLlama protocol icons or Google's favicon service, each checked to return an image.
 * Nothing here is paid placement.
 */

export const DISCOVER_TABS = ["Featured", "Earn", "DeFi", "Trade", "NFTs", "Memes"] as const;
export type DiscoverTab = (typeof DISCOVER_TABS)[number];

export type DiscoverApp = {
  id: string;
  name: string;
  tagline: string;
  /** Official URL opened in the in-app browser when there is no sandbox dapp. */
  url: string;
  logo: string;
  /** Sandbox catalog id, when the app is in `DAPPS`. */
  dappId?: string;
  tabs: DiscoverTab[];
  /** Extra words for search. */
  keywords?: string;
};

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const llama = (slug: string) => `https://icons.llamao.fi/icons/protocols/${slug}?w=128&h=128`;

export const DISCOVER_APPS: DiscoverApp[] = [
  { id: "jupiter", name: "Jupiter", tagline: "Best-price swaps routed across Solana DEXs", url: "https://jup.ag", logo: favicon("jup.ag"), dappId: "jupiter", tabs: ["Featured", "Trade"], keywords: "swap aggregator jup" },
  { id: "kamino", name: "Kamino", tagline: "Lend, borrow and automated liquidity vaults", url: "https://app.kamino.finance", logo: favicon("kamino.finance"), dappId: "kamino", tabs: ["Featured", "Earn", "DeFi"], keywords: "lending vaults yield" },
  { id: "drift", name: "Drift", tagline: "Perpetual futures, spot and borrow-lend", url: "https://app.drift.trade", logo: favicon("drift.trade"), dappId: "drift", tabs: ["Featured", "DeFi", "Trade"], keywords: "perps leverage" },
  { id: "jito", name: "Jito", tagline: "Liquid-stake SOL for JitoSOL with MEV rewards", url: "https://www.jito.network", logo: llama("jito"), dappId: "jito", tabs: ["Featured", "Earn"], keywords: "stake jitosol lst" },
  { id: "pump-fun", name: "pump.fun", tagline: "Launch and trade brand-new memecoins", url: "https://pump.fun", logo: favicon("pump.fun"), tabs: ["Featured", "Memes"], keywords: "pump memecoin launchpad" },
  { id: "magic-eden", name: "Magic Eden", tagline: "Buy, sell and mint NFTs", url: "https://magiceden.io", logo: favicon("magiceden.io"), dappId: "magic-eden", tabs: ["Featured", "NFTs"], keywords: "nft marketplace" },
  { id: "raydium", name: "Raydium", tagline: "AMM swaps, liquidity pools and LaunchLab", url: "https://raydium.io/swap/", logo: favicon("raydium.io"), tabs: ["Featured", "DeFi", "Trade"], keywords: "amm dex pools" },
  { id: "sanctum", name: "Sanctum", tagline: "Swap between liquid staking tokens, earn with INF", url: "https://app.sanctum.so", logo: llama("sanctum"), tabs: ["Featured", "Earn"], keywords: "lst inf stake" },
  { id: "marginfi", name: "marginfi", tagline: "Lend and borrow SOL, USDC and LSTs", url: "https://app.marginfi.com", logo: llama("marginfi"), dappId: "marginfi", tabs: ["Earn", "DeFi"], keywords: "lending borrow" },
  { id: "marinade", name: "Marinade", tagline: "Liquid-stake SOL for mSOL or stake natively", url: "https://marinade.finance", logo: favicon("marinade.finance"), dappId: "marinade", tabs: ["Earn"], keywords: "stake msol lst" },
  { id: "blaze", name: "SolBlaze", tagline: "Liquid-stake SOL for bSOL", url: "https://stake.solblaze.org", logo: favicon("solblaze.org"), dappId: "blaze", tabs: ["Earn"], keywords: "stake bsol lst blaze" },
  { id: "save", name: "Save", tagline: "Lending protocol, formerly Solend", url: "https://save.finance", logo: favicon("save.finance"), tabs: ["Earn", "DeFi"], keywords: "solend lending" },
  { id: "meteora", name: "Meteora", tagline: "Dynamic pools and DLMM liquidity", url: "https://app.meteora.ag", logo: llama("meteora"), tabs: ["DeFi", "Trade"], keywords: "dlmm pools liquidity" },
  { id: "orca", name: "Orca", tagline: "Concentrated-liquidity swaps on Whirlpools", url: "https://www.orca.so", logo: llama("orca"), tabs: ["DeFi", "Trade"], keywords: "whirlpools dex" },
  { id: "jupiter-perps", name: "Jupiter Perps", tagline: "Up to 100x leverage on SOL, ETH and BTC", url: "https://jup.ag/perps", logo: llama("jupiter-perpetual-exchange"), tabs: ["Trade"], keywords: "perps leverage jup" },
  { id: "phoenix", name: "Phoenix", tagline: "Fully on-chain limit order book", url: "https://app.phoenix.trade", logo: favicon("phoenix.trade"), dappId: "phoenix", tabs: ["Trade"], keywords: "orderbook clob" },
  { id: "tensor", name: "Tensor", tagline: "Pro NFT trading with collection bids", url: "https://www.tensor.trade", logo: llama("tensor"), dappId: "tensor", tabs: ["NFTs"], keywords: "nft marketplace" },
  { id: "exchange-art", name: "Exchange Art", tagline: "1/1 art and editions on Solana", url: "https://exchange.art", logo: favicon("exchange.art"), tabs: ["NFTs"], keywords: "nft art" },
  { id: "star-atlas", name: "Star Atlas", tagline: "Space strategy game with on-chain ships", url: "https://play.staratlas.com", logo: favicon("staratlas.com"), dappId: "star-atlas", tabs: ["NFTs"], keywords: "game gaming nft" },
  { id: "letsbonk", name: "LetsBonk.fun", tagline: "BONK community memecoin launchpad", url: "https://letsbonk.fun", logo: favicon("letsbonk.fun"), tabs: ["Memes"], keywords: "bonk launchpad memecoin" },
  { id: "dexscreener", name: "DEX Screener", tagline: "Live charts for every Solana pair", url: "https://dexscreener.com/solana", logo: favicon("dexscreener.com"), tabs: ["Memes", "Trade"], keywords: "charts pairs" },
  { id: "birdeye", name: "Birdeye", tagline: "Token analytics, charts and wallet tracking", url: "https://birdeye.so", logo: favicon("birdeye.so"), tabs: ["Memes"], keywords: "charts analytics" },
];

export function appsForTab(tab: DiscoverTab): DiscoverApp[] {
  return DISCOVER_APPS.filter((app) => app.tabs.includes(tab));
}

export function discoverAppForDapp(dappId: string): DiscoverApp | undefined {
  return DISCOVER_APPS.find((app) => app.dappId === dappId || app.id === dappId);
}

/** Up to two letters for a logo fallback ("Magic Eden" → "ME", "pump.fun" → "PU"). */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}
