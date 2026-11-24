/** Pure parsers for Helius DAS and Jupiter price payloads. No network I/O. */

export type FungibleHolding = {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  priceUsd: number | null;
  valueUsd: number | null;
  image: string | null;
  change24hPct: number | null;
};

export type NftHolding = {
  id: string;
  name: string;
  collection: string;
  image: string | null;
};

export type WatchedWallet = {
  address: string;
  sol: { amount: number; priceUsd: number | null; valueUsd: number | null };
  tokens: FungibleHolding[];
  nfts: NftHolding[];
  totalUsd: number | null;
};

export type AssetQuote = {
  mint: string;
  symbol: string | null;
  name: string | null;
  image: string | null;
  priceUsd: number | null;
  valueUsd: number | null;
};

export type JupiterPriceQuote = {
  mint: string;
  priceUsd: number;
  change24hPct: number | null;
};

const WSOL = "So11111111111111111111111111111111111111112";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function httpImageUrl(value: unknown): string | null {
  const url = asString(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function imageFromContent(content: unknown): string | null {
  const rec = asRecord(content);
  if (!rec) return null;
  const links = asRecord(rec.links);
  const fromLinks = httpImageUrl(links?.image) ?? httpImageUrl(links?.external_url);
  if (fromLinks) return fromLinks;
  for (const file of asArray(rec.files)) {
    const item = asRecord(file);
    const uri = httpImageUrl(item?.uri) ?? httpImageUrl(item?.cdn_uri);
    if (uri) return uri;
  }
  const json = asRecord(rec.json_uri);
  if (json) return httpImageUrl(json.image);
  return httpImageUrl(rec.json_uri);
}

function metadataOf(content: unknown): Record<string, unknown> | null {
  return asRecord(asRecord(content)?.metadata);
}

function isFungibleInterface(value: unknown): boolean {
  const iface = asString(value) ?? "";
  return iface === "FungibleToken" || iface === "FungibleAsset" || iface.toLowerCase().includes("fungible");
}

function isNftInterface(value: unknown): boolean {
  const iface = asString(value) ?? "";
  if (isFungibleInterface(iface)) return false;
  return /nft|programmablenft|mplus/i.test(iface) || iface === "V1_NFT" || iface === "V2_NFT" || iface === "LEGACY_NFT" || iface === "ProgrammableNFT";
}

function tokenAmount(info: Record<string, unknown>): { amount: number; decimals: number } {
  const decimals = asNumber(info.decimals) ?? 0;
  const raw = asNumber(info.balance) ?? asNumber(info.token_amount) ?? asNumber(asRecord(info.token_amount)?.amount);
  if (raw === null) return { amount: 0, decimals };
  // Helius DAS token_info.balance is already in raw units for some payloads, UI amount in others.
  const ui = asNumber(info.ui_amount) ?? asNumber(asRecord(info.token_amount)?.uiAmount) ?? asNumber(asRecord(info.token_amount)?.ui_amount);
  if (ui !== null) return { amount: ui, decimals };
  if (decimals > 0 && raw > 1_000 && Number.isInteger(raw)) return { amount: raw / 10 ** decimals, decimals };
  return { amount: raw, decimals };
}

function collectionName(asset: Record<string, unknown>): string {
  for (const group of asArray(asset.grouping)) {
    const rec = asRecord(group);
    if (!rec) continue;
    const meta = asRecord(rec.collection_metadata);
    const named = asString(meta?.name) ?? asString(rec.collection_metadata);
    if (named) return named;
  }
  const content = metadataOf(asset.content);
  return asString(content?.symbol) ?? "Collectible";
}

export function parseAsset(value: unknown): { kind: "fungible"; holding: FungibleHolding } | { kind: "nft"; holding: NftHolding } | { kind: "quote"; quote: AssetQuote } | null {
  const asset = asRecord(value);
  if (!asset) return null;
  const mint = asString(asset.id);
  if (!mint) return null;
  const tokenInfo = asRecord(asset.token_info);
  const priceInfo = asRecord(tokenInfo?.price_info);
  const priceUsd = asNumber(priceInfo?.price_per_token);
  const valueUsd = asNumber(priceInfo?.total_price);
  const image = imageFromContent(asset.content);
  const meta = metadataOf(asset.content);
  const symbol = asString(tokenInfo?.symbol) ?? asString(meta?.symbol);
  const name = asString(meta?.name) ?? asString(tokenInfo?.symbol) ?? symbol ?? mint.slice(0, 8);

  if (tokenInfo && (isFungibleInterface(asset.interface) || tokenInfo.balance !== undefined || tokenInfo.decimals !== undefined)) {
    if (isNftInterface(asset.interface) && tokenInfo.decimals === 0 && (asNumber(tokenInfo.balance) === 1 || asNumber(tokenInfo.balance) === 0)) {
      // fall through to NFT when it looks like a 1-of-1
    } else if (isFungibleInterface(asset.interface) || (tokenInfo.decimals !== undefined && (asNumber(tokenInfo.decimals) ?? 0) > 0)) {
      const { amount, decimals } = tokenAmount(tokenInfo);
      return {
        kind: "fungible",
        holding: {
          mint,
          symbol: symbol ?? mint.slice(0, 4).toUpperCase(),
          name,
          amount,
          decimals,
          priceUsd,
          valueUsd: valueUsd ?? (priceUsd !== null ? amount * priceUsd : null),
          image,
          change24hPct: null,
        },
      };
    }
  }

  if (isNftInterface(asset.interface) || (!tokenInfo && image) || asString(asset.interface)?.includes("NFT")) {
    return {
      kind: "nft",
      holding: {
        id: mint,
        name,
        collection: collectionName(asset),
        image,
      },
    };
  }

  return {
    kind: "quote",
    quote: { mint, symbol, name, image, priceUsd, valueUsd },
  };
}

export function parseNativeBalance(value: unknown): { amount: number; priceUsd: number | null; valueUsd: number | null } {
  const rec = asRecord(value);
  if (!rec) return { amount: 0, priceUsd: null, valueUsd: null };
  const lamports = asNumber(rec.lamports);
  const sol = asNumber(rec.solana) ?? asNumber(rec.ui_amount) ?? (lamports !== null ? lamports / 1e9 : 0);
  const priceUsd = asNumber(rec.price_per_sol) ?? asNumber(rec.price_per_token);
  const valueUsd = asNumber(rec.total_price) ?? (priceUsd !== null ? sol * priceUsd : null);
  return { amount: sol, priceUsd, valueUsd };
}

export function parseAssetsByOwner(address: string, rpc: unknown): WatchedWallet {
  const root = asRecord(rpc);
  const result = asRecord(root?.result) ?? root;
  const items = asArray(result?.items ?? result?.result);
  const tokens: FungibleHolding[] = [];
  const nfts: NftHolding[] = [];
  for (const item of items) {
    const parsed = parseAsset(item);
    if (!parsed) continue;
    if (parsed.kind === "fungible") {
      if (parsed.holding.mint === WSOL) continue;
      if (parsed.holding.amount <= 0) continue;
      tokens.push(parsed.holding);
    } else if (parsed.kind === "nft") {
      nfts.push(parsed.holding);
    }
  }
  tokens.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const sol = parseNativeBalance(result?.nativeBalance ?? result?.native_balance);
  const knownValues = [sol.valueUsd, ...tokens.map((t) => t.valueUsd)].filter((v): v is number => v !== null);
  const totalUsd = knownValues.length ? knownValues.reduce((sum, v) => sum + v, 0) : null;
  return { address, sol, tokens, nfts, totalUsd };
}

export function parseAssetBatch(rpc: unknown): AssetQuote[] {
  const root = asRecord(rpc);
  const result = root?.result ?? root;
  const items = Array.isArray(result) ? result : asArray(asRecord(result)?.items);
  const quotes: AssetQuote[] = [];
  for (const item of items) {
    const parsed = parseAsset(item);
    if (!parsed) continue;
    if (parsed.kind === "fungible") {
      quotes.push({
        mint: parsed.holding.mint,
        symbol: parsed.holding.symbol,
        name: parsed.holding.name,
        image: parsed.holding.image,
        priceUsd: parsed.holding.priceUsd,
        valueUsd: parsed.holding.valueUsd,
      });
    } else if (parsed.kind === "quote") {
      quotes.push(parsed.quote);
    } else {
      quotes.push({
        mint: parsed.holding.id,
        symbol: null,
        name: parsed.holding.name,
        image: parsed.holding.image,
        priceUsd: null,
        valueUsd: null,
      });
    }
  }
  return quotes;
}

function changeFromUnknown(rec: Record<string, unknown> | null): number | null {
  if (!rec) return null;
  return (
    asNumber(rec.priceChange24h) ??
    asNumber(rec.priceChange24H) ??
    asNumber(rec.price_change_24h) ??
    asNumber(rec.change24h) ??
    asNumber(rec.change24hPct) ??
    asNumber(asRecord(rec.extraInfo)?.priceChange24h) ??
    asNumber(asRecord(rec.quotedPrice)?.priceChange24h) ??
    null
  );
}

function priceFromUnknown(rec: Record<string, unknown> | null): number | null {
  if (!rec) return null;
  return (
    asNumber(rec.usdPrice) ??
    asNumber(rec.price) ??
    asNumber(rec.usd_price) ??
    asNumber(asRecord(rec.extraInfo)?.quotedPrice) ??
    asNumber(asRecord(asRecord(rec.extraInfo)?.quotedPrice)?.buyPrice) ??
    null
  );
}

/** Accepts Jupiter Price API v2 (`data` map) or v3 (top-level mint map). */
export function parseJupiterPrices(payload: unknown): JupiterPriceQuote[] {
  const root = asRecord(payload);
  if (!root) return [];
  const data = asRecord(root.data) ?? root;
  const quotes: JupiterPriceQuote[] = [];
  for (const [mint, value] of Object.entries(data)) {
    if (mint === "timeTaken" || mint === "contextSlot") continue;
    const rec = asRecord(value);
    const priceUsd = priceFromUnknown(rec);
    if (priceUsd === null) continue;
    quotes.push({ mint, priceUsd, change24hPct: changeFromUnknown(rec) });
  }
  return quotes;
}

export function imageFromTokenInfo(payload: unknown): string | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  return (
    httpImageUrl(rec.icon) ??
    httpImageUrl(rec.logoURI) ??
    httpImageUrl(rec.logoUri) ??
    httpImageUrl(rec.logo) ??
    httpImageUrl(asRecord(rec.content)?.links && asRecord(asRecord(rec.content)?.links)?.image)
  );
}
