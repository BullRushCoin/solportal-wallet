import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSolanaAddress } from "./address.ts";
import { base58Encode } from "./crypto.ts";

const WSOL = "So11111111111111111111111111111111111111112";

describe("isSolanaAddress", () => {
  it("accepts a 32-byte base58 public key", () => {
    assert.equal(isSolanaAddress(WSOL), true);
    assert.equal(isSolanaAddress(`  ${WSOL}  `), true);
    const key = base58Encode(new Uint8Array(32).fill(7));
    assert.equal(isSolanaAddress(key), true);
  });

  it("rejects empty, short, or non-base58 values", () => {
    assert.equal(isSolanaAddress(""), false);
    assert.equal(isSolanaAddress("not-an-address"), false);
    assert.equal(isSolanaAddress("0".repeat(44)), false);
    assert.equal(isSolanaAddress(WSOL.slice(0, 20)), false);
    const tooShort = base58Encode(new Uint8Array(16).fill(1));
    assert.equal(isSolanaAddress(tooShort), false);
  });
});
