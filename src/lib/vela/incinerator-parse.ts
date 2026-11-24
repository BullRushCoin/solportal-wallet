import { asArray, asNumber, asRecord, asString } from "@/lib/vela/helius-parse";
import { TOKEN_ACCOUNT_RENT_SOL, WSOL_MINT, type IncineratorInput } from "@/lib/vela/incinerator";

export type ParsedTokenAccount = IncineratorInput & {
  pubkey: string;
  rentSol: number;
};

export function parseJupiterSwapQuote(payload: unknown): { outSol: number; inAmount: string | null } | null {
  const rec = asRecord(payload);
  if (!rec) return null;
  const outRaw = asString(rec.outAmount) ?? (asNumber(rec.outAmount) !== null ? String(asNumber(rec.outAmount)) : null);
  if (outRaw === null) return null;
  let out: bigint;
  try {
    out = BigInt(outRaw);
  } catch {
    return null;
  }
  if (out <= 0n) return null;
  return { outSol: Number(out) / 1e9, inAmount: asString(rec.inAmount) };
}

export function parseTokenAccountsByOwner(rpc: unknown): ParsedTokenAccount[] {
  const root = asRecord(rpc);
  const result = asArray(root?.result) ?? asArray(rpc);
  const rows: ParsedTokenAccount[] = [];
  for (const item of result) {
    const rec = asRecord(item);
    if (!rec) continue;
    const pubkey = asString(rec.pubkey) ?? asString(asRecord(rec.account)?.pubkey);
    const account = asRecord(rec.account) ?? rec;
    const lamports = asNumber(account?.lamports);
    const data = asRecord(account?.data);
    const parsed = asRecord(data?.parsed);
    const info = asRecord(parsed?.info) ?? asRecord(data?.info);
    if (!info) continue;
    const mint = asString(info.mint);
    if (!mint || mint === WSOL_MINT) continue;
    const tokenAmount = asRecord(info.tokenAmount);
    const decimals = asNumber(tokenAmount?.decimals) ?? 0;
    const amountRaw = asString(tokenAmount?.amount) ?? (asNumber(tokenAmount?.amount) !== null ? String(asNumber(tokenAmount?.amount)) : "0");
    let amount = asNumber(tokenAmount?.uiAmount);
    if (amount === null) {
      try {
        amount = Number(BigInt(amountRaw)) / 10 ** decimals;
      } catch {
        amount = 0;
      }
    }
    rows.push({
      pubkey: pubkey ?? mint,
      mint,
      amount,
      decimals,
      rentSol: lamports !== null && lamports > 0 ? lamports / 1e9 : TOKEN_ACCOUNT_RENT_SOL,
    });
  }
  return rows;
}

export function parseIncineratorTokenQuery(raw: string | null): IncineratorInput[] {
  if (!raw) return [];
  const items: IncineratorInput[] = [];
  for (const part of raw.split("|")) {
    const [mint, amountText, decimalsText, symbol, name] = part.split(",");
    if (!mint) continue;
    const amount = Number(amountText);
    const decimals = Number(decimalsText);
    items.push({
      mint,
      amount: Number.isFinite(amount) ? amount : 0,
      decimals: Number.isFinite(decimals) ? decimals : 0,
      symbol: symbol || undefined,
      name: name || undefined,
    });
  }
  return items;
}
