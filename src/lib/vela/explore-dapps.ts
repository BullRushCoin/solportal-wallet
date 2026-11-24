import type { Category } from "@/lib/vela/dapps";

export type ExploreDappCatalogItem = {
  id: string;
  name: string;
  category: Category;
  /** Official homepage or app URL — verified live before shipping. */
  url: string;
  logo: string;
  blurb: string;
  /** DefiLlama protocol names to sum Solana TVL from. */
  llamaNames: string[];
  /** DefiLlama DEX volume slugs (overview/dexs/solana). */
  volumeSlugs: string[];
};

const icon = (slug: string) => `https://icons.llamao.fi/icons/protocols/${slug}?w=48&h=48`;

/**
 * Curated Solana dapps shown in Explore → Trending.
 * URLs are official hosts (no referral query strings). 404s were rejected
 * before shipping; a few hosts (pump.fun, magiceden.io) return a bot-challenge
 * 403 from datacenter fetches but the public site resolves and is not missing.
 */
export const EXPLORE_DAPPS: ExploreDappCatalogItem[] = [
  {
    id: "jupiter",
    name: "Jupiter",
    category: "DEX",
    url: "https://jup.ag",
    logo: icon("jupiter"),
    blurb: "Solana swap aggregator",
    llamaNames: [],
    volumeSlugs: [],
  },
  {
    id: "raydium",
    name: "Raydium",
    category: "DEX",
    url: "https://raydium.io",
    logo: icon("raydium"),
    blurb: "AMM, launchpad, and farms",
    llamaNames: ["Raydium AMM"],
    volumeSlugs: ["raydium-amm"],
  },
  {
    id: "orca",
    name: "Orca",
    category: "DEX",
    url: "https://www.orca.so",
    logo: icon("orca"),
    blurb: "Whirlpools and concentrated liquidity",
    llamaNames: ["Orca DEX"],
    volumeSlugs: ["orca-dex"],
  },
  {
    id: "meteora",
    name: "Meteora",
    category: "DEX",
    url: "https://app.meteora.ag",
    logo: icon("meteora"),
    blurb: "Dynamic liquidity market maker",
    llamaNames: ["Meteora DLMM", "Meteora DAMM V1", "Meteora DAMM V2", "Meteora vaults"],
    volumeSlugs: ["meteora-dlmm", "meteora-damm-v1", "meteora-damm-v2", "meteora-dynamic-bonding-curve"],
  },
  {
    id: "pump-fun",
    name: "Pump.fun",
    category: "DEX",
    url: "https://pump.fun",
    logo: icon("pump"),
    blurb: "Launch and trade memecoins",
    llamaNames: ["PumpSwap"],
    volumeSlugs: ["pump.fun", "pumpswap"],
  },
  {
    id: "drift",
    name: "Drift",
    category: "DEX",
    url: "https://app.drift.trade",
    logo: icon("drift-trade"),
    blurb: "Perps and borrow-lend",
    llamaNames: ["Drift Trade"],
    volumeSlugs: ["drift-amm"],
  },
  {
    id: "jupiter-perps",
    name: "Jupiter Perps",
    category: "DEX",
    url: "https://jup.ag/perps",
    logo: icon("jupiter-perpetual-exchange"),
    blurb: "On-chain perpetual futures",
    llamaNames: ["Jupiter Perpetual Exchange"],
    volumeSlugs: [],
  },
  {
    id: "kamino",
    name: "Kamino",
    category: "DeFi",
    url: "https://kamino.com",
    logo: icon("kamino"),
    blurb: "Lending, liquidity, and leverage",
    llamaNames: ["Kamino Lend", "Kamino Liquidity"],
    volumeSlugs: [],
  },
  {
    id: "marginfi",
    name: "MarginFi",
    category: "DeFi",
    url: "https://app.marginfi.com",
    logo: icon("marginfi"),
    blurb: "Solana lending and looping",
    llamaNames: ["marginfi Lending", "marginfi LST"],
    volumeSlugs: [],
  },
  {
    id: "sanctum",
    name: "Sanctum",
    category: "Staking",
    url: "https://www.sanctum.so",
    logo: icon("sanctum"),
    blurb: "LST liquidity and Infinity",
    llamaNames: ["Sanctum Validator LSTs", "Sanctum Infinity", "Sanctum Reserve"],
    volumeSlugs: [],
  },
  {
    id: "jito",
    name: "Jito",
    category: "Staking",
    url: "https://www.jito.network",
    logo: icon("jito"),
    blurb: "JitoSOL and restaking",
    llamaNames: ["Jito Liquid Staking", "Jito Restaking"],
    volumeSlugs: [],
  },
  {
    id: "marinade",
    name: "Marinade",
    category: "Staking",
    url: "https://marinade.finance",
    logo: icon("marinade-finance"),
    blurb: "Native stake and mSOL",
    llamaNames: ["Marinade Native", "Marinade Liquid Staking", "Marinade Select"],
    volumeSlugs: [],
  },
  {
    id: "tensor",
    name: "Tensor",
    category: "NFT",
    url: "https://www.tensor.trade",
    logo: icon("tensor"),
    blurb: "NFT marketplace and AMM",
    llamaNames: ["Tensor"],
    volumeSlugs: [],
  },
  {
    id: "magic-eden",
    name: "Magic Eden",
    category: "NFT",
    url: "https://magiceden.io",
    logo: icon("magic-eden"),
    blurb: "NFT marketplace",
    llamaNames: ["Magic Eden"],
    volumeSlugs: [],
  },
  {
    id: "phoenix",
    name: "Phoenix",
    category: "DEX",
    url: "https://www.phoenix.trade",
    logo: icon("phoenix"),
    blurb: "On-chain spot order book",
    llamaNames: ["Phoenix Spot"],
    volumeSlugs: ["phoenix-spot"],
  },
  {
    id: "zeta",
    name: "Zeta",
    category: "DEX",
    url: "https://www.zeta.markets",
    logo: icon("zeta"),
    blurb: "Perpetual futures DEX",
    llamaNames: ["Zeta"],
    volumeSlugs: [],
  },
  {
    id: "flash-trade",
    name: "Flash Trade",
    category: "DEX",
    url: "https://www.flash.trade",
    logo: icon("flashtrade"),
    blurb: "Perps with isolated margin",
    llamaNames: ["FlashTrade"],
    volumeSlugs: [],
  },
  {
    id: "parcl",
    name: "Parcl",
    category: "DeFi",
    url: "https://app.parcl.co",
    logo: icon("parcl"),
    blurb: "Trade real-estate prices",
    llamaNames: ["Parcl V2", "Parcl V3"],
    volumeSlugs: [],
  },
];

export const PERP_VENUES = [
  {
    id: "jupiter-perps",
    name: "Jupiter Perps",
    url: "https://jup.ag/perps",
    logo: icon("jupiter-perpetual-exchange"),
    llamaNames: ["Jupiter Perpetual Exchange"],
  },
  {
    id: "drift",
    name: "Drift",
    url: "https://app.drift.trade",
    logo: icon("drift-trade"),
    llamaNames: ["Drift Trade"],
  },
  {
    id: "zeta",
    name: "Zeta",
    url: "https://dex.zeta.markets",
    logo: icon("zeta"),
    llamaNames: ["Zeta"],
  },
  {
    id: "flash-trade",
    name: "Flash Trade",
    url: "https://www.flash.trade/trade",
    logo: icon("flashtrade"),
    llamaNames: ["FlashTrade"],
  },
  {
    id: "phoenix-perp",
    name: "Phoenix Perp",
    url: "https://www.phoenix.trade/trade",
    logo: icon("phoenix"),
    llamaNames: ["Phoenix Perp"],
  },
] as const;

export const JUPITER_PERP_MARKETS = [
  {
    symbol: "SOL-PERP",
    baseSymbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    jlpSymbol: "SOL",
    tradeUrl: "https://jup.ag/perps/long/SOL-SOL",
    logo: "https://coin-images.coingecko.com/coins/images/21629/large/solana.jpg?1696520989",
  },
  {
    symbol: "ETH-PERP",
    baseSymbol: "ETH",
    mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    jlpSymbol: "ETH",
    tradeUrl: "https://jup.ag/perps/long/ETH-SOL",
    logo: null as string | null,
  },
  {
    symbol: "BTC-PERP",
    baseSymbol: "BTC",
    mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    jlpSymbol: "WBTC",
    tradeUrl: "https://jup.ag/perps/long/BTC-SOL",
    logo: null as string | null,
  },
] as const;

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
