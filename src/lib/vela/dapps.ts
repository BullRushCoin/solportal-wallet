import type { TxIntent } from "@/lib/vela/provider";
import { tokenBySymbol, type Nft } from "@/lib/vela/tokens";

export type Category = "DeFi" | "DEX" | "NFT" | "Gaming" | "Social" | "Staking";

export type DappAction =
  | "perps"
  | "lend"
  | "nft-buy"
  | "nft-list"
  | "stake-marinade"
  | "stake-jito"
  | "tip"
  | "play"
  | "open-swap"
  | "drain"
  | "unknown";

export type Dapp = {
  id: string;
  name: string;
  host: string;
  origin: string;
  category: Category;
  blurb: string;
  listed: boolean;
  verified: boolean;
  sponsored?: boolean;
  campaign?: string;
  trending: number;
  action: DappAction;
};

export const DAPPS: Dapp[] = [
  {
    id: "drift",
    name: "Drift",
    host: "app.drift.trade",
    origin: "https://app.drift.trade",
    category: "DEX",
    blurb: "Perps and borrow-lend. One-tap margin from the SolPortal browser.",
    listed: true,
    verified: true,
    sponsored: true,
    campaign: "Perps week · sponsored rank",
    trending: 98,
    action: "perps",
  },
  {
    id: "kamino",
    name: "Kamino",
    host: "app.kamino.finance",
    origin: "https://app.kamino.finance",
    category: "DeFi",
    blurb: "Vaults and lending. Launchpad spotlight for the USDC prime vault.",
    listed: true,
    verified: true,
    sponsored: true,
    campaign: "Vault launch · spotlight",
    trending: 91,
    action: "lend",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    host: "jup.ag",
    origin: "https://jup.ag",
    category: "DEX",
    blurb: "Aggregator the native swap already uses. Opens SolPortal Swap.",
    listed: true,
    verified: true,
    trending: 96,
    action: "open-swap",
  },
  {
    id: "magic-eden",
    name: "Magic Eden",
    host: "magiceden.io",
    origin: "https://magiceden.io",
    category: "NFT",
    blurb: "Buy a sandbox collectible. Simulation shows the USDC debit before you sign.",
    listed: true,
    verified: true,
    trending: 84,
    action: "nft-buy",
  },
  {
    id: "tensor",
    name: "Tensor",
    host: "www.tensor.trade",
    origin: "https://www.tensor.trade",
    category: "NFT",
    blurb: "List a Keel Pass. The prompt flags the marketplace delegate.",
    listed: true,
    verified: true,
    trending: 77,
    action: "nft-list",
  },
  {
    id: "marinade",
    name: "Marinade",
    host: "marinade.finance",
    origin: "https://marinade.finance",
    category: "Staking",
    blurb: "Native SOL to mSOL. Partner rebate is booked on confirm.",
    listed: true,
    verified: true,
    trending: 73,
    action: "stake-marinade",
  },
  {
    id: "jito",
    name: "Jito",
    host: "www.jito.network",
    origin: "https://www.jito.network",
    category: "Staking",
    blurb: "Stake to JitoSOL. Same liquid-staking rail as the Stake screen.",
    listed: true,
    verified: true,
    trending: 88,
    action: "stake-jito",
  },
  {
    id: "phoenix",
    name: "Phoenix",
    host: "app.phoenix.trade",
    origin: "https://app.phoenix.trade",
    category: "DEX",
    blurb: "On-chain order book. Connect, then hand off to the native swap.",
    listed: true,
    verified: true,
    trending: 64,
    action: "open-swap",
  },
  {
    id: "marginfi",
    name: "marginfi",
    host: "app.marginfi.com",
    origin: "https://app.marginfi.com",
    category: "DeFi",
    blurb: "Supply USDC. A plain debit — no authority change.",
    listed: true,
    verified: true,
    trending: 70,
    action: "lend",
  },
  {
    id: "dialect",
    name: "Dialect",
    host: "dialect.to",
    origin: "https://dialect.to",
    category: "Social",
    blurb: "Tip a creator in SOL without leaving the thread.",
    listed: true,
    verified: true,
    trending: 61,
    action: "tip",
  },
  {
    id: "star-atlas",
    name: "Star Atlas",
    host: "play.staratlas.com",
    origin: "https://play.staratlas.com",
    category: "Gaming",
    blurb: "Sign a session ticket. Message only — no token movement.",
    listed: true,
    verified: true,
    trending: 69,
    action: "play",
  },
  {
    id: "blaze",
    name: "Blaze",
    host: "stake.solblaze.org",
    origin: "https://stake.solblaze.org",
    category: "Staking",
    blurb: "SOL to bSOL. Illustrative partner rate, not a live validator deal.",
    listed: true,
    verified: true,
    trending: 58,
    action: "stake-jito",
  },
  {
    id: "drainer",
    name: "SOL Rewards",
    host: "sol-rewards.gift",
    origin: "https://sol-rewards.gift",
    category: "DeFi",
    blurb: "Unlisted lookalike. Claims an airdrop and asks to seize token accounts.",
    listed: false,
    verified: false,
    trending: 0,
    action: "drain",
  },
];

export const CATEGORIES: Array<Category | "All" | "News"> = [
  "All",
  "News",
  "DeFi",
  "DEX",
  "NFT",
  "Gaming",
  "Staking",
];

export const DIRECTORY = DAPPS.filter((dapp) => dapp.listed);

export function dappById(id: string): Dapp | undefined {
  return DAPPS.find((dapp) => dapp.id === id);
}

export function dappByHost(input: string): Dapp | undefined {
  const host = normalizeHost(input);
  if (!host) return undefined;
  return DAPPS.find((dapp) => dapp.host === host);
}

export function normalizeHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProto).host.toLowerCase();
  } catch {
    return null;
  }
}

const BOUGHT_NFT: Nft = {
  id: "market-88",
  name: "Night Market #88",
  collection: "Night Market",
  pattern: "nft-night",
};

export function intentForAction(
  dapp: Dapp,
  holdings: Record<string, number>,
  priorityFee: number,
): TxIntent | { redirect: "swap" } {
  const base = {
    origin: dapp.origin,
    site: dapp.name,
    verified: dapp.verified,
    networkFeeSol: priorityFee,
  };

  if (dapp.action === "open-swap") return { redirect: "swap" };

  if (dapp.action === "perps") {
    const margin = 0.5;
    return {
      ...base,
      kind: "dapp",
      title: "Open 5x SOL-PERP long",
      effects: [
        { symbol: "SOL", delta: -margin, usd: -margin * tokenBySymbol("SOL").priceUsd },
      ],
      authorities: [],
      warnings: [
        {
          level: "warn",
          title: "Leverage can liquidate the margin",
          detail: "Drift would escrow 0.50 SOL. This sandbox only locks the margin — it does not trade.",
        },
      ],
      deltas: { SOL: -margin },
      activityTitle: "Drift margin",
      usd: -margin * tokenBySymbol("SOL").priceUsd,
    };
  }

  if (dapp.action === "lend") {
    const amount = Math.min(500, holdings.USDC ?? 0);
    return {
      ...base,
      kind: "dapp",
      title: dapp.id === "kamino" ? "Supply USDC to Prime vault" : "Supply USDC",
      effects: [{ symbol: "USDC", delta: -amount, usd: -amount }],
      authorities: [],
      warnings:
        amount <= 0
          ? [{ level: "critical", title: "Nothing to supply", detail: "USDC balance is empty." }]
          : [
              {
                level: "info",
                title: "Lending deposit",
                detail: "You can withdraw later on the venue. No new delegate is granted in this simulation.",
              },
            ],
      deltas: { USDC: -amount },
      activityTitle: `${dapp.name} supply`,
      usd: -amount,
    };
  }

  if (dapp.action === "nft-buy") {
    const price = 120;
    return {
      ...base,
      kind: "dapp",
      title: "Buy Night Market #88",
      effects: [{ symbol: "USDC", delta: -price, usd: -price }],
      authorities: [],
      warnings: [],
      deltas: { USDC: -price },
      activityTitle: "Bought Night Market #88",
      usd: -price,
      nft: BOUGHT_NFT,
    };
  }

  if (dapp.action === "nft-list") {
    return {
      ...base,
      kind: "message",
      title: "Approve marketplace delegate",
      message: "Grant Tensor a temporary delegate on Keel Pass #128",
      effects: [],
      authorities: [
        {
          level: "warn",
          title: "Delegate can transfer this NFT",
          detail: "A list instruction approves the marketplace program on Keel Pass #128. Revoke it from Connected sites if you delist.",
        },
      ],
      warnings: [
        {
          level: "warn",
          title: "Authority change",
          detail: "No tokens move now. The delegate could move the NFT while the listing is live.",
        },
      ],
    };
  }

  if (dapp.action === "stake-marinade" || dapp.action === "stake-jito") {
    const lst = dapp.action === "stake-marinade" ? "mSOL" : dapp.id === "blaze" ? "bSOL" : "JitoSOL";
    const amountIn = 1;
    const out = (amountIn * tokenBySymbol("SOL").priceUsd) / tokenBySymbol(lst).priceUsd;
    const apy = lst === "mSOL" ? 0.071 : lst === "bSOL" ? 0.074 : 0.078;
    const annual = amountIn * tokenBySymbol("SOL").priceUsd * apy;
    const revUsd = (annual * 0.1) / 12;
    return {
      ...base,
      kind: "stake",
      title: `Stake 1 SOL to ${lst}`,
      from: "SOL",
      to: lst,
      amountIn,
      amountOut: out,
      revUsd,
      effects: [
        { symbol: "SOL", delta: -amountIn, usd: -amountIn * tokenBySymbol("SOL").priceUsd },
        { symbol: lst, delta: out, usd: out * tokenBySymbol(lst).priceUsd },
      ],
      authorities: [],
      warnings: [
        {
          level: "info",
          title: "Liquid staking receipt",
          detail: `You receive ${lst}. Illustrative partner rebate is 10% of rewards. Sandbox books one month ($${revUsd.toFixed(2)}).`,
        },
      ],
    };
  }

  if (dapp.action === "tip") {
    const tip = 0.05;
    return {
      ...base,
      kind: "dapp",
      title: "Tip 0.05 SOL",
      effects: [{ symbol: "SOL", delta: -tip, usd: -tip * tokenBySymbol("SOL").priceUsd }],
      authorities: [],
      warnings: [],
      deltas: { SOL: -tip },
      activityTitle: "Dialect tip",
      usd: -tip * tokenBySymbol("SOL").priceUsd,
    };
  }

  if (dapp.action === "play") {
    return {
      ...base,
      kind: "message",
      title: "Sign session ticket",
      message: "SolPortal sandbox session for play.staratlas.com",
      effects: [],
      authorities: [],
      warnings: [
        {
          level: "info",
          title: "Message only",
          detail: "This signature does not move tokens. Reject it if the site is not the game you opened.",
        },
      ],
    };
  }

  if (dapp.action === "drain") {
    const effects = Object.entries(holdings)
      .filter(([, amount]) => amount > 0)
      .map(([symbol, amount]) => ({
        symbol,
        delta: -amount,
        usd: -amount * (tokenBySymbol(symbol).priceUsd ?? 0),
      }));
    return {
      ...base,
      kind: "drain",
      title: "Claim bonus SOL",
      effects,
      authorities: [
        {
          level: "critical",
          title: "setAuthority on every token account",
          detail: "The transaction replaces the owner of your token accounts with the site's withdraw authority.",
        },
        {
          level: "critical",
          title: "Unlimited USDC approval",
          detail: "An Approve instruction grants the maximum amount to an unknown account.",
        },
      ],
      warnings: [
        {
          level: "critical",
          title: "Drainer pattern",
          detail: "Unverified domain, new site, and a claim button that empties the wallet. SolPortal would block this behind the warning you are reading.",
        },
      ],
    };
  }

  return {
    ...base,
    kind: "message",
    title: "Sign in",
    message: `Sign in to ${dapp.host}`,
    effects: [],
    authorities: [],
    warnings: [
      {
        level: "warn",
        title: "Unverified domain",
        detail: "This host is not in the SolPortal directory. Confirm the URL character by character.",
      },
    ],
  };
}

export const RATE_CARD = [
  { name: "Sponsored rank", term: "Directory pin, 7 days", price: "$4,500" },
  { name: "Launchpad spotlight", term: "Hero card + push to recents", price: "$2,000" },
  { name: "Referred deposits", term: "Where the partner program allows", price: "10–15%" },
  { name: "Swap platform fee", term: "Every native Jupiter swap", price: "85 bps" },
  { name: "Fiat affiliate", term: "MoonPay, Transak, or Stripe", price: "~1%" },
  { name: "LST partner share", term: "Slice of the staking rebate", price: "10% of rebate" },
];
