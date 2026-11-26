/**
 * Free, rule-based support bot. No LLM: questions are matched against this
 * knowledge base by keyword. Anything that looks urgent (lost funds, hacks,
 * scams, bugs) is flagged so the app offers to send it to the team.
 */
import { PLATFORM_FEE_BPS } from "@/lib/vela/jupiter";
import { WORDLIST } from "@/lib/vela/crypto";

export type SupportArticle = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
};

const swapPct = (PLATFORM_FEE_BPS / 100).toFixed(2).replace(/0$/, "");

export const SUPPORT_ARTICLES: SupportArticle[] = [
  {
    id: "fees",
    title: "What are the fees?",
    keywords: ["fee", "fees", "cost", "charge", "charged", "commission", "percent", "bps", "expensive"],
    answer: `Swaps carry a ${swapPct}% SolPortal fee, shown on the review screen before you sign, plus a tiny Solana network fee. The incinerator keeps a small share of the SOL it reclaims. Sending, receiving, and watching wallets are free.`,
  },
  {
    id: "swap",
    title: "How do swaps work?",
    keywords: ["swap", "swapping", "trade", "exchange", "convert", "jupiter", "slippage", "quote", "route"],
    answer: "Swaps route through Jupiter for the best price. Pick the coins, enter an amount, check the quote, fee, and slippage on the review screen, then approve. If a swap fails, nothing leaves your wallet except possibly the network fee.",
  },
  {
    id: "phrase",
    title: "Recovery phrase",
    keywords: ["phrase", "seed", "recovery", "backup", "words", "mnemonic", "restore", "12"],
    answer: "Your 12-word recovery phrase is the only way to restore a wallet. Write it down offline and never share it. SolPortal support will never ask for it. To restore, open My wallets, tap Add wallet, then Import recovery phrase.",
  },
  {
    id: "wallets",
    title: "Multiple wallets",
    keywords: ["wallets", "multiple", "another", "second", "add", "switch", "rename", "remove", "account", "accounts", "profile"],
    answer: "Tap your wallet name at the top of Home to open My wallets. From there you can switch wallets, rename or remove one from the ⋮ menu, and use Add wallet to create, import, or watch another.",
  },
  {
    id: "send",
    title: "Sending and receiving",
    keywords: ["send", "sending", "receive", "receiving", "deposit", "withdraw", "transfer", "address", "qr"],
    answer: "Tap Send or Receive on Home. Always double-check the address before sending: Solana transfers can't be reversed. To receive, share your address or QR code from Receive.",
  },
  {
    id: "stake",
    title: "Staking",
    keywords: ["stake", "staking", "unstake", "validator", "jitosol", "msol", "bsol", "apy", "yield", "rewards"],
    answer: "Open Stake from Home or More to stake SOL into JitoSOL, mSOL, bSOL, or a native validator. APY is shown before you confirm. Liquid stake can be swapped back any time; native stake takes about one epoch (2 to 3 days) to unlock.",
  },
  {
    id: "incinerator",
    title: "Incinerator and dust",
    keywords: ["incinerator", "burn", "dust", "rent", "reclaim", "close", "empty", "spam", "junk"],
    answer: "The incinerator closes empty or junk token accounts and returns their rent to you as SOL. Review the list before approving, since burned tokens can't be recovered.",
  },
  {
    id: "watch",
    title: "Watch-only wallets",
    keywords: ["watch", "watching", "track", "view", "public", "readonly", "read-only"],
    answer: "A watched wallet shows live balances and NFTs for any public address. It's read-only: SolPortal holds no keys for it and can't send from it.",
  },
  {
    id: "missing",
    title: "Missing balance or token",
    keywords: ["missing", "balance", "zero", "disappeared", "gone", "not showing", "token", "show"],
    answer: "Pull to refresh and check you're on the right wallet in My wallets. Very small or spam tokens are hidden from the list. If funds truly left your wallet, tap Contact support so we can look into it.",
  },
  {
    id: "connected",
    title: "Connected sites",
    keywords: ["connect", "connected", "dapp", "site", "sites", "permission", "revoke", "disconnect", "explore"],
    answer: "Sites you connect from Explore are listed under More, Connected sites. Revoke any you don't recognise. Connecting never moves tokens by itself; only transactions you approve do.",
  },
  {
    id: "pro",
    title: "SolPortal Pro",
    keywords: ["pro", "subscription", "premium", "upgrade", "cancel", "billing"],
    answer: "SolPortal Pro is under More. You can turn it on or off there at any time.",
  },
  {
    id: "buy",
    title: "Buying crypto",
    keywords: ["buy", "card", "fiat", "onramp", "on-ramp", "moonpay", "transak", "stripe", "bank", "usd", "cash"],
    answer: "Tap Buy on any coin or open More, Buy to purchase with a card through a partner. The partner handles payment and ID checks; the coins land in your active wallet.",
  },
  {
    id: "security",
    title: "Staying safe",
    keywords: ["safe", "security", "secure", "drainer", "phishing", "fake", "airdrop", "suspicious", "link"],
    answer: "Never sign transactions from links you don't trust, ignore surprise airdrops, and never type your recovery phrase into any website. SolPortal previews risky sites before they open. See More, Security for the checklist.",
  },
];

const URGENT_PATTERNS = [
  /\b(hack(ed)?|stolen|steal|drain(ed|er)?|compromis(ed|e)|scam(med)?|phish(ed|ing)?)\b/i,
  /\b(lost|missing|disappeared|gone)\b.*\b(funds?|money|sol|usdc|tokens?|coins?|crypto)\b/i,
  /\b(funds?|money|sol|usdc|tokens?|coins?)\b.*\b(lost|missing|disappeared|gone|never (arrived|showed|came))\b/i,
  /\b(refund|charged twice|double charged|unauthori[sz]ed)\b/i,
  /\b(bug|broken|crash(es|ed|ing)?|error|stuck|frozen|not working|doesn'?t work|won'?t (load|open|send))\b/i,
  /\b(legal|lawyer|police|report fraud)\b/i,
];

export function isUrgent(text: string): boolean {
  return URGENT_PATTERNS.some((pattern) => pattern.test(text));
}

/** True when the text looks like someone pasted a recovery phrase. */
export function looksLikePhrase(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.length < 12) return false;
  const known = words.filter((word) => WORDLIST.includes(word) || word.length >= 3).length;
  const runs = text.trim().split(/\s+/);
  const allLower = runs.every((word) => /^[a-z]+$/.test(word));
  return allLower && (runs.length === 12 || runs.length === 24) && known === words.length;
}

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
}

export type SupportMatch = { article: SupportArticle; score: number } | null;

export function matchSupport(text: string): SupportMatch {
  const words = tokens(text);
  const joined = ` ${words.join(" ")} `;
  let best: SupportMatch = null;
  for (const article of SUPPORT_ARTICLES) {
    let score = 0;
    for (const keyword of article.keywords) {
      if (keyword.includes(" ") ? joined.includes(` ${keyword} `) : words.includes(keyword)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { article, score };
  }
  return best;
}
