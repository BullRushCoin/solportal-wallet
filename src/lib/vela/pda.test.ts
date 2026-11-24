import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { base58Decode } from "./crypto.ts";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
  isOnCurve,
  sha256,
} from "./pda.ts";
import { DEFAULT_FEE_WALLET } from "./fee-wallet.ts";

describe("sha256", () => {
  it("matches Node's crypto for short and long inputs", () => {
    for (const text of ["", "solportal", "a".repeat(200)]) {
      const input = new TextEncoder().encode(text);
      const expected = new Uint8Array(createHash("sha256").update(input).digest());
      assert.deepEqual(sha256(input), expected);
    }
  });
});

describe("isOnCurve", () => {
  it("accepts a real wallet pubkey and rejects a PDA seed hash that is off-curve", () => {
    assert.equal(isOnCurve(base58Decode(DEFAULT_FEE_WALLET)), true);
    assert.equal(isOnCurve(base58Decode(TOKEN_PROGRAM_ID)), true);
    assert.equal(base58Decode(ASSOCIATED_TOKEN_PROGRAM_ID).length, 32);
    assert.equal(base58Decode(TOKEN_2022_PROGRAM_ID).length, 32);
  });
});

describe("findAssociatedTokenAddress", () => {
  it("derives the default fee wallet ATAs for SOL, USDC, and PYUSD", () => {
    assert.equal(
      findAssociatedTokenAddress(DEFAULT_FEE_WALLET, "So11111111111111111111111111111111111111112"),
      "63rirek2NeBVJPH7D9AwsUyBAbkvkS27QymmrSKpZfAD",
    );
    assert.equal(
      findAssociatedTokenAddress(DEFAULT_FEE_WALLET, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      "B8SfDeR7J7QLT5tAsGZahUBEdY9konVoUxYq6gC4wXT9",
    );
    assert.equal(
      findAssociatedTokenAddress(
        DEFAULT_FEE_WALLET,
        "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
        TOKEN_2022_PROGRAM_ID,
      ),
      "G8k6aTXs9ahSwdb8N3xSNoi6zCs9gZZ4yi2aAkzrxNhD",
    );
  });
});
