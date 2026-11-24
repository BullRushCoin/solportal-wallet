const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Demo wordlist only — not BIP39, and phrases from it must never be funded. */
export const WORDLIST = [
  "amber", "anchor", "apple", "arch", "armor", "atlas", "atom", "august",
  "basin", "beach", "birch", "blade", "bloom", "bluff", "board", "brass",
  "canyon", "cargo", "cedar", "chalk", "cipher", "cliff", "cloud", "cobalt",
  "coral", "crane", "creek", "crown", "delta", "dune", "ember", "fable",
  "falcon", "fern", "field", "flint", "frost", "garden", "glade", "glen",
  "grain", "harbor", "hazel", "heron", "honey", "iron", "ivory", "jade",
  "keel", "lagoon", "lantern", "lemon", "linen", "lotus", "maple", "marble",
  "marsh", "meadow", "meteor", "mint", "mirror", "moss", "nectar", "north",
  "olive", "onyx", "orbit", "otter", "paddle", "palm", "pearl", "pebble",
  "pilot", "pine", "plover", "pocket", "prairie", "quartz", "quill", "raven",
  "reef", "ridge", "river", "robin", "sable", "sailor", "cedar", "shore",
  "silver", "slate", "sparrow", "spruce", "stone", "summit", "thistle", "tide",
  "timber", "topaz", "tulip", "vapor", "velvet", "violet", "voyage", "walnut",
  "willow", "winter", "yarrow", "zephyr",
].filter((word, index, all) => all.indexOf(word) === index);

export function base58Encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i] ?? 0;
    for (let j = 0; j < digits.length; j += 1) {
      carry += (digits[j] ?? 0) << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let encoded = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    encoded += ALPHABET[digits[i] ?? 0] ?? "1";
  }
  return encoded;
}


export function base58Decode(value: string): Uint8Array {
  let zeros = 0;
  while (zeros < value.length && value[zeros] === "1") zeros += 1;
  const bytes = [0];
  for (let i = zeros; i < value.length; i += 1) {
    const idx = ALPHABET.indexOf(value[i] ?? "");
    if (idx < 0) throw new Error("invalid base58");
    let carry = idx;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += (bytes[j] ?? 0) * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[out.length - 1 - i] = bytes[i] ?? 0;
  }
  return out;
}

export function generatePhrase(): string[] {
  const buf = new Uint16Array(12);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => WORDLIST[n % WORDLIST.length] ?? "keel");
}

export function randomAddress(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base58Encode(bytes);
}

/** Deterministic display address. Not a Solana derivation path. */
export async function addressFromPhrase(phrase: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`vela-sandbox-v1:${phrase}`));
  return base58Encode(new Uint8Array(digest));
}

export function fakeSignature(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base58Encode(bytes);
}

export type SandboxPhraseResult =
  | { ok: true; words: string[] }
  | { ok: false; error: string };

/** Validate a typed import. Rejects anything that is not 12 words from WORDLIST. */
export function parseSandboxPhrase(input: string, acknowledged: boolean): SandboxPhraseResult {
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 12) {
    return { ok: false, error: "Enter exactly 12 sandbox words." };
  }
  if (words.some((word) => !WORDLIST.includes(word))) {
    return { ok: false, error: "One of those words is not in the sandbox list. Do not type a real phrase." };
  }
  if (!acknowledged) {
    return { ok: false, error: "Confirm you are not entering a real recovery phrase." };
  }
  return { ok: true, words };
}
