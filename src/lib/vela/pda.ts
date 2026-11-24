import { base58Decode, base58Encode } from "@/lib/vela/crypto";

/** SPL Token program. */
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
/** Token-2022 program. */
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
/** Associated Token program. */
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

const PD_SUFFIX = new TextEncoder().encode("ProgramDerivedAddress");
const ED25519_P = (1n << 255n) - 19n;
const ED25519_D = (((-121665n % ED25519_P) + ED25519_P) * modInv(121666n, ED25519_P)) % ED25519_P;

function rot(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** Sync SHA-256 so ATA derivation can run in the browser during a quote. */
export function sha256(message: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bitLen = message.length * 8;
  const paddedLen = ((message.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0);
  // high 32 bits of length; message is well under 2^32 bits here
  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15]!;
      const w2 = w[i - 2]!;
      const s0 = rot(w15, 7) ^ rot(w15, 18) ^ (w15 >>> 3);
      const s1 = rot(w2, 17) ^ rot(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0);
  outView.setUint32(4, h1);
  outView.setUint32(8, h2);
  outView.setUint32(12, h3);
  outView.setUint32(16, h4);
  outView.setUint32(20, h5);
  outView.setUint32(24, h6);
  outView.setUint32(28, h7);
  return out;
}

function modInv(value: bigint, mod: bigint): bigint {
  return modPow(value % mod, mod - 2n, mod);
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

/** True when the 32-byte value is an Ed25519 point (not a valid PDA). */
export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  let y = 0n;
  for (let i = 0; i < 32; i += 1) y |= BigInt(bytes[i] ?? 0) << (8n * BigInt(i));
  y &= (1n << 255n) - 1n;
  const y2 = (y * y) % ED25519_P;
  const denom = (ED25519_D * y2 + 1n) % ED25519_P;
  if (denom === 0n) return false;
  const x2 = (((y2 - 1n) % ED25519_P) + ED25519_P) * modInv(denom, ED25519_P);
  const residue = (x2 % ED25519_P + ED25519_P) % ED25519_P;
  const legendre = modPow(residue, (ED25519_P - 1n) / 2n, ED25519_P);
  return residue === 0n || legendre === 1n;
}

export function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): { address: Uint8Array; bump: number } {
  for (let bump = 255; bump >= 0; bump -= 1) {
    let length = PD_SUFFIX.length + programId.length + 1;
    for (const seed of seeds) length += seed.length;
    const input = new Uint8Array(length);
    let offset = 0;
    for (const seed of seeds) {
      input.set(seed, offset);
      offset += seed.length;
    }
    input[offset] = bump;
    offset += 1;
    input.set(programId, offset);
    offset += programId.length;
    input.set(PD_SUFFIX, offset);
    const hash = sha256(input);
    if (!isOnCurve(hash)) return { address: hash, bump };
  }
  throw new Error("unable to find a program address");
}

export function findAssociatedTokenAddress(
  owner: string,
  mint: string,
  tokenProgram: string = TOKEN_PROGRAM_ID,
): string {
  const { address } = findProgramAddress(
    [base58Decode(owner), base58Decode(tokenProgram), base58Decode(mint)],
    base58Decode(ASSOCIATED_TOKEN_PROGRAM_ID),
  );
  return base58Encode(address);
}
