/**
 * Devnet wallet: a real ed25519 keypair, real signing, real transactions on Solana devnet.
 * Devnet SOL is free play money. The key lives in this browser's localStorage and is for
 * devnet only. Never send mainnet funds to it.
 */
import { Buffer } from "buffer";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  AuthorityType,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}

const KEY_STORE = "solportal-devnet-key-v1";
const NFT_STORE = "solportal-devnet-nfts-v1";

export const DEVNET_ART = [
  { name: "Lantern Knight", image: "/nfts/lantern.webp" },
  { name: "Portal Gate", image: "/nfts/portal.webp" },
  { name: "Crowned Skull", image: "/nfts/crown.webp" },
];

export type DevnetNft = { mint: string; name: string; image: string | null };

let connection: Connection | null = null;
function conn(): Connection {
  connection ??= new Connection(`${window.location.origin}/api/devnet`, {
    commitment: "confirmed",
    disableRetryOnRateLimit: true,
  });
  return connection;
}

export function explorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}
export function explorerAccount(address: string): string {
  return `https://solscan.io/account/${address}?cluster=devnet`;
}

export function loadKeypair(): Keypair | null {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    if (!raw) return null;
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  } catch {
    return null;
  }
}

export function createKeypair(): Keypair {
  const keypair = Keypair.generate();
  localStorage.setItem(KEY_STORE, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

export function resetKeypair(): void {
  localStorage.removeItem(KEY_STORE);
  localStorage.removeItem(NFT_STORE);
}

export function isValidAddress(value: string): boolean {
  try {
    new PublicKey(value.trim());
    return value.trim().length >= 32;
  } catch {
    return false;
  }
}

export async function balanceSol(owner: PublicKey): Promise<number> {
  return (await conn().getBalance(owner, "confirmed")) / LAMPORTS_PER_SOL;
}

async function waitFor(signature: string, timeoutMs = 45_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { value } = await conn().getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error("Transaction failed on devnet");
    if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) return;
    await new Promise((resolve) => setTimeout(resolve, 1_200));
  }
  throw new Error("Timed out waiting for devnet. Check Solscan in a minute.");
}

async function sendIx(payer: Keypair, ixs: TransactionInstruction[], extraSigners: Keypair[] = []): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await conn().getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
  tx.sign(payer, ...extraSigners);
  const signature = await conn().sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  await waitFor(signature);
  return signature;
}

export const PUBLIC_FAUCET = "https://faucet.solana.com";

export async function faucetEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/devnet-faucet", { cache: "no-store" });
    return Boolean(((await res.json()) as { enabled?: boolean }).enabled);
  } catch {
    return false;
  }
}

/** In-app faucet (when SolPortal's devnet faucet wallet is configured). */
export async function airdrop(owner: PublicKey): Promise<string> {
  const res = await fetch("/api/devnet-faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: owner.toBase58() }),
  });
  const body = (await res.json()) as { signature?: string; error?: string };
  if (!res.ok || !body.signature) {
    throw new Error(body.error === "cooldown" ? "faucet cooldown: one drip per hour" : body.error === "faucet-empty" ? "faucet empty" : "faucet unavailable");
  }
  await waitFor(body.signature, 60_000);
  return body.signature;
}

export async function sendSol(payer: Keypair, to: string, sol: number): Promise<string> {
  return sendIx(payer, [
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: new PublicKey(to.trim()),
      lamports: Math.round(sol * LAMPORTS_PER_SOL),
    }),
  ]);
}

function savedNames(): Record<string, { name: string; image: string | null }> {
  try {
    return JSON.parse(localStorage.getItem(NFT_STORE) ?? "{}") as Record<string, { name: string; image: string | null }>;
  } catch {
    return {};
  }
}

/** Mints a one-of-one SPL token (0 decimals, supply 1, mint authority removed) to the wallet. */
export async function mintTestNft(payer: Keypair): Promise<{ signature: string; nft: DevnetNft }> {
  const mint = Keypair.generate();
  const owned = Object.keys(savedNames()).length;
  const art = DEVNET_ART[owned % DEVNET_ART.length]!;
  const name = `${art.name} #${Math.floor(100 + Math.random() * 900)}`;
  const rent = await conn().getMinimumBalanceForRentExemption(MINT_SIZE);
  const ata = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey);
  const signature = await sendIx(
    payer,
    [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: rent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint.publicKey, 0, payer.publicKey, null),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, payer.publicKey, mint.publicKey),
      createMintToInstruction(mint.publicKey, ata, payer.publicKey, 1),
      createSetAuthorityInstruction(mint.publicKey, payer.publicKey, AuthorityType.MintTokens, null),
    ],
    [mint],
  );
  const names = savedNames();
  names[mint.publicKey.toBase58()] = { name, image: art.image };
  localStorage.setItem(NFT_STORE, JSON.stringify(names));
  return { signature, nft: { mint: mint.publicKey.toBase58(), name, image: art.image } };
}

/** NFT-shaped holdings: token accounts with 0 decimals and a balance of exactly 1. */
export async function listNfts(owner: PublicKey): Promise<DevnetNft[]> {
  const { value } = await conn().getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
  const names = savedNames();
  return value
    .map((item) => {
      const info = (item.account.data as { parsed?: { info?: { mint?: string; tokenAmount?: { decimals?: number; amount?: string } } } }).parsed?.info;
      return info;
    })
    .filter((info): info is { mint: string; tokenAmount: { decimals: number; amount: string } } =>
      Boolean(info?.mint && info.tokenAmount && info.tokenAmount.decimals === 0 && info.tokenAmount.amount === "1"),
    )
    .map((info) => ({
      mint: info.mint,
      name: names[info.mint]?.name ?? `Devnet NFT ${info.mint.slice(0, 4)}…${info.mint.slice(-4)}`,
      image: names[info.mint]?.image ?? null,
    }));
}

export async function sendNft(payer: Keypair, mint: string, to: string): Promise<string> {
  const mintKey = new PublicKey(mint);
  const dest = new PublicKey(to.trim());
  const fromAta = getAssociatedTokenAddressSync(mintKey, payer.publicKey);
  const toAta = getAssociatedTokenAddressSync(mintKey, dest, true);
  return sendIx(payer, [
    createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, toAta, dest, mintKey),
    createTransferCheckedInstruction(fromAta, mintKey, toAta, payer.publicKey, 1, 0),
  ]);
}

export type DevnetTx = { signature: string; at: number | null; ok: boolean };

export async function recentTxs(owner: PublicKey): Promise<DevnetTx[]> {
  const list = await conn().getSignaturesForAddress(owner, { limit: 6 });
  return list.map((item) => ({ signature: item.signature, at: item.blockTime ? item.blockTime * 1000 : null, ok: !item.err }));
}

/* ---------------- Devnet Incinerator ---------------- */

const JUNK_STORE = "solportal-devnet-junk-v1";
const JUNK_NAMES = ["RUGGED", "DUSTY", "GHOST", "BONKLESS", "FROGZ", "AIRDROPX"];
const RENT_EXEMPT_MIN_LAMPORTS = 890_880;

export type JunkAccount = {
  account: string;
  mint: string;
  symbol: string;
  amountRaw: string;
  uiAmount: number;
  decimals: number;
  rentLamports: number;
};

function junkNames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(JUNK_STORE) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Creates three junk tokens: two with worthless dust, one empty account. Real devnet accounts. */
export async function makeJunk(payer: Keypair): Promise<string> {
  const mintRent = await conn().getMinimumBalanceForRentExemption(MINT_SIZE);
  const names = junkNames();
  const used = Object.keys(names).length;
  const mints = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const ixs: TransactionInstruction[] = [];
  mints.forEach((mint, i) => {
    const ata = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey);
    ixs.push(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
      createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, payer.publicKey, mint.publicKey),
    );
    // Third one stays empty: just an account holding rent.
    if (i < 2) ixs.push(createMintToInstruction(mint.publicKey, ata, payer.publicKey, Math.floor(1_000 + Math.random() * 90_000_000)));
    names[mint.publicKey.toBase58()] = JUNK_NAMES[(used + i) % JUNK_NAMES.length]!;
  });
  const signature = await sendIx(payer, ixs, mints);
  localStorage.setItem(JUNK_STORE, JSON.stringify(names));
  return signature;
}

/** Every token account that isn't an NFT: dust and empty accounts, each holding ~0.002 SOL of rent. */
export async function scanJunk(owner: PublicKey): Promise<JunkAccount[]> {
  const { value } = await conn().getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID });
  const names = junkNames();
  const out: JunkAccount[] = [];
  for (const item of value) {
    const info = (item.account.data as {
      parsed?: { info?: { mint?: string; tokenAmount?: { decimals?: number; amount?: string; uiAmount?: number | null } } };
    }).parsed?.info;
    const amount = info?.tokenAmount;
    if (!info?.mint || !amount) continue;
    const decimals = amount.decimals ?? 0;
    if (decimals === 0 && amount.amount === "1") continue; // NFT: keep
    out.push({
      account: item.pubkey.toBase58(),
      mint: info.mint,
      symbol: names[info.mint] ?? `${info.mint.slice(0, 4)}…`,
      amountRaw: amount.amount ?? "0",
      uiAmount: amount.uiAmount ?? 0,
      decimals,
      rentLamports: item.account.lamports,
    });
  }
  return out;
}

export type IncinerateResult = { signatures: string[]; reclaimedSol: number; feeSol: number; feeSkipped: boolean };

/** Burns any dust, closes each account (rent back to the wallet), and pays the SolPortal fee on reclaimed rent. */
export async function incinerate(payer: Keypair, items: JunkAccount[], feeBps: number, feeWallet: string): Promise<IncinerateResult> {
  const rentLamports = items.reduce((sum, item) => sum + item.rentLamports, 0);
  let feeLamports = Math.floor((rentLamports * feeBps) / 10_000);
  let feeSkipped = false;
  if (feeLamports > 0) {
    const feeBalance = await conn().getBalance(new PublicKey(feeWallet));
    // A brand-new system account needs ~0.00089 SOL to exist; skip a smaller first fee on devnet.
    if (feeBalance === 0 && feeLamports < RENT_EXEMPT_MIN_LAMPORTS) {
      feeLamports = 0;
      feeSkipped = true;
    }
  }
  const signatures: string[] = [];
  const BATCH = 6;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const ixs: TransactionInstruction[] = [];
    for (const item of chunk) {
      const account = new PublicKey(item.account);
      const mint = new PublicKey(item.mint);
      if (item.amountRaw !== "0") {
        ixs.push(createBurnCheckedInstruction(account, mint, payer.publicKey, BigInt(item.amountRaw), item.decimals));
      }
      ixs.push(createCloseAccountInstruction(account, payer.publicKey, payer.publicKey));
    }
    if (i + BATCH >= items.length && feeLamports > 0) {
      ixs.push(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(feeWallet), lamports: feeLamports }));
    }
    signatures.push(await sendIx(payer, ixs));
  }
  return {
    signatures,
    reclaimedSol: (rentLamports - feeLamports) / LAMPORTS_PER_SOL,
    feeSol: feeLamports / LAMPORTS_PER_SOL,
    feeSkipped,
  };
}
