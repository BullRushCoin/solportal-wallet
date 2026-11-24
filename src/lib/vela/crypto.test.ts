import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addressFromPhrase, base58Decode, base58Encode, parseSandboxPhrase, WORDLIST } from "./crypto.ts";

const VALID = "amber anchor apple arch armor atlas atom august basin beach birch blade";

describe("parseSandboxPhrase", () => {
  it("accepts exactly 12 sandbox words after acknowledgement", () => {
    const result = parseSandboxPhrase(`  ${VALID}  `, true);
    assert.deepEqual(result, { ok: true, words: VALID.split(" ") });
  });

  it("rejects the wrong length, words outside the list, and a missing acknowledgement", () => {
    assert.deepEqual(parseSandboxPhrase("amber anchor", true), {
      ok: false,
      error: "Enter exactly 12 sandbox words.",
    });
    assert.deepEqual(
      parseSandboxPhrase(
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
        true,
      ),
      {
        ok: false,
        error: "One of those words is not in the sandbox list. Do not type a real phrase.",
      },
    );
    assert.deepEqual(parseSandboxPhrase(VALID, false), {
      ok: false,
      error: "Confirm you are not entering a real recovery phrase.",
    });
  });

  it("normalizes case and whitespace", () => {
    const mixed = WORDLIST.slice(0, 12).join("  ").toUpperCase();
    const result = parseSandboxPhrase(mixed, true);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.words, WORDLIST.slice(0, 12));
  });
});

describe("addressFromPhrase", () => {
  it("is deterministic and not a raw phrase", async () => {
    const a = await addressFromPhrase(VALID);
    const b = await addressFromPhrase(VALID);
    assert.equal(a, b);
    assert.ok(a.length > 10);
    assert.notEqual(a, VALID);
  });
});

describe("base58", () => {
  it("round-trips 32-byte keys", () => {
    const bytes = new Uint8Array(32);
    bytes[0] = 1;
    bytes[31] = 255;
    const encoded = base58Encode(bytes);
    assert.deepEqual(Array.from(base58Decode(encoded)), Array.from(bytes));
  });

  it("rejects characters outside the alphabet", () => {
    assert.throws(() => base58Decode("0OIl"));
  });
});
