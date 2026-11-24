import { fetchJupiterPrices, heliusApiKey, heliusRpc, loadWatchedWallet } from "@/lib/vela/helius.server";
import { httpImageUrl } from "@/lib/vela/helius-parse";
import {
  TOKEN_ACCOUNT_RENT_SOL,
  WSOL_MINT,
  holdingValueUsd,
  incineratorFeeBps,
  isDeadCoin,
  summarizePlan,
  type IncineratorInput,
  type IncineratorItem,
  type IncineratorPlan,
} from "@/lib/vela/incinerator";
import { parseJupiterSwapQuote, parseTokenAccountsByOwner } from "@/lib/vela/incinerator-parse";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/vela/pda";
import { tokenByMint } from "@/lib/vela/tokens";
import { toBaseUnits, buildQuoteUrl, JUPITER_LITE_API, DEFAULT_SLIPPAGE_BPS } from "@/lib/vela/jupiter";

const PLAN_TTL_MS = 30_000;
const MAX_QUOTES = 20;
const QUOTE_CONCURRENCY = 5;

type CacheEntry = { at: number; value: IncineratorPlan };
const planCache = new Map<string, CacheEntry>();

async function getJson(url: string, timeoutMs = 8_000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function quoteToSol(mint: string, amount: number, decimals: number): Promise<number | null> {
  if (!(amount > 0)) return null;
  const raw = toBaseUnits(amount, decimals);
  if (raw <= 0n) return null;
  const url = buildQuoteUrl(
    {
      inputMint: mint,
      outputMint: WSOL_MINT,
      amount: raw.toString(),
      slippageBps: DEFAULT_SLIPPAGE_BPS,
      platformFeeBps: 0,
    },
    JUPITER_LITE_API,
  );
  try {
    const parsed = parseJupiterSwapQuote(await getJson(url, 8_000));
    return parsed && parsed.outSol > 0 ? parsed.outSol : null;
  } catch {
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await fn(items[current]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function pricesForMints(mints: string[]): Promise<Map<string, { priceUsd: number; image?: string | null }>> {
  const unique = [...new Set(mints.filter(Boolean))];
  const map = new Map<string, { priceUsd: number; image?: string | null }>();
  const chunk = 80;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    try {
      const quotes = await fetchJupiterPrices(slice);
      for (const quote of quotes) {
        if (quote.priceUsd > 0) map.set(quote.mint, { priceUsd: quote.priceUsd });
      }
    } catch {
      // Keep whatever we already have.
    }
  }
  return map;
}

function itemFromInput(
  input: IncineratorInput,
  rentSol: number,
  priceUsd: number | null,
  swapSol: number | null,
  quoteSource: IncineratorItem["quoteSource"],
  image: string | null,
): IncineratorItem {
  const known = tokenByMint(input.mint);
  const amount = input.amount;
  const valueUsd = holdingValueUsd(amount, priceUsd);
  const action: IncineratorItem["action"] = swapSol !== null && swapSol > 0 ? "swap" : "burn";
  return {
    mint: input.mint,
    symbol: input.symbol || known?.symbol || input.mint.slice(0, 4),
    name: input.name || known?.name || "Unknown token",
    amount,
    decimals: input.decimals,
    priceUsd,
    valueUsd,
    image,
    rentSol,
    swapSol: action === "swap" ? swapSol : null,
    action,
    quoteSource: action === "swap" ? quoteSource : "none",
  };
}

async function enrich(inputs: Array<IncineratorInput & { rentSol?: number }>): Promise<IncineratorItem[]> {
  const prices = await pricesForMints(inputs.map((item) => item.mint));
  const candidates: Array<IncineratorInput & { rentSol: number; priceUsd: number | null }> = [];
  for (const input of inputs) {
    const known = tokenByMint(input.mint);
    const priced = prices.get(input.mint)?.priceUsd ?? (input.priceUsd && input.priceUsd > 0 ? input.priceUsd : null) ?? (known && known.priceUsd > 0 ? known.priceUsd : null);
    const valueUsd = holdingValueUsd(input.amount, priced);
    if (!isDeadCoin({ symbol: input.symbol ?? known?.symbol, mint: input.mint, amount: input.amount, valueUsd })) continue;
    candidates.push({
      ...input,
      rentSol: input.rentSol ?? TOKEN_ACCOUNT_RENT_SOL,
      priceUsd: priced,
    });
  }

  const quoteTargets = candidates
    .filter((item) => item.amount > 0)
    .sort((a, b) => (b.priceUsd ?? 0) * b.amount - (a.priceUsd ?? 0) * a.amount)
    .slice(0, MAX_QUOTES);
  const quoteSet = new Set(quoteTargets.map((item) => item.mint + ":" + item.amount));
  const quotes = new Map<string, number>();
  await mapPool(quoteTargets, QUOTE_CONCURRENCY, async (item) => {
    const out = await quoteToSol(item.mint, item.amount, item.decimals);
    if (out !== null) quotes.set(item.mint + ":" + item.amount, out);
  });

  return candidates.map((item) => {
    const key = item.mint + ":" + item.amount;
    const swapSol = quotes.get(key) ?? null;
    const attempted = quoteSet.has(key);
    return itemFromInput(
      item,
      item.rentSol,
      item.priceUsd,
      swapSol,
      swapSol !== null ? "live" : attempted ? "none" : "none",
      httpImageUrl(item.image) ?? null,
    );
  });
}

export async function loadIncineratorForAddress(address: string): Promise<IncineratorPlan> {
  const now = Date.now();
  const cacheKey = `addr:${address}:${incineratorFeeBps()}`;
  const cached = planCache.get(cacheKey);
  if (cached && now - cached.at < PLAN_TTL_MS) return cached.value;

  const key = heliusApiKey();
  if (!key) throw new Error("HELIUS_UNAVAILABLE");

  const [wallet, tokenAccounts, token2022Accounts] = await Promise.all([
    loadWatchedWallet(address).catch(() => null),
    heliusRpc("getTokenAccountsByOwner", [address, { programId: TOKEN_PROGRAM_ID }, { encoding: "jsonParsed" }]).catch(() => null),
    heliusRpc("getTokenAccountsByOwner", [address, { programId: TOKEN_2022_PROGRAM_ID }, { encoding: "jsonParsed" }]).catch(() => null),
  ]);

  const parsed = [...parseTokenAccountsByOwner(tokenAccounts), ...parseTokenAccountsByOwner(token2022Accounts)];
  const byMint = new Map<string, (typeof parsed)[number]>();
  for (const row of parsed) {
    const existing = byMint.get(row.mint);
    if (!existing) byMint.set(row.mint, row);
    else {
      existing.amount += row.amount;
      existing.rentSol += row.rentSol;
    }
  }

  const walletByMint = new Map((wallet?.tokens ?? []).map((token) => [token.mint, token]));
  const inputs: Array<IncineratorInput & { rentSol?: number }> = [];
  const seen = new Set<string>();
  for (const account of byMint.values()) {
    const meta = walletByMint.get(account.mint);
    seen.add(account.mint);
    inputs.push({
      mint: account.mint,
      symbol: meta?.symbol ?? account.symbol,
      name: meta?.name ?? account.name,
      amount: account.amount,
      decimals: account.decimals || meta?.decimals || 0,
      priceUsd: meta?.priceUsd ?? null,
      image: meta?.image ?? null,
      rentSol: account.rentSol,
    });
  }
  for (const token of wallet?.tokens ?? []) {
    if (seen.has(token.mint)) continue;
    if (!isDeadCoin({ symbol: token.symbol, mint: token.mint, amount: token.amount, valueUsd: token.valueUsd })) continue;
    inputs.push({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      amount: token.amount,
      decimals: token.decimals,
      priceUsd: token.priceUsd,
      image: token.image,
      rentSol: TOKEN_ACCOUNT_RENT_SOL,
    });
  }

  const items = await enrich(inputs);
  items.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0) || b.rentSol - a.rentSol);
  const plan = summarizePlan(items, { live: items.some((item) => item.quoteSource === "live") || Boolean(wallet), updatedAt: now });
  planCache.set(cacheKey, { at: now, value: plan });
  return plan;
}

export async function loadIncineratorForHoldings(inputs: IncineratorInput[]): Promise<IncineratorPlan> {
  const now = Date.now();
  const cacheKey = `hold:${inputs.map((item) => `${item.mint}:${item.amount}`).join(",")}:${incineratorFeeBps()}`;
  const cached = planCache.get(cacheKey);
  if (cached && now - cached.at < PLAN_TTL_MS) return cached.value;
  const items = await enrich(inputs);
  const live = items.some((item) => item.quoteSource === "live");
  const plan = summarizePlan(items, { live, updatedAt: now });
  planCache.set(cacheKey, { at: now, value: plan });
  return plan;
}

export function clearIncineratorCaches(): void {
  planCache.clear();
}

