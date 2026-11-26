import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUrgent, looksLikePhrase, matchSupport } from "@/lib/vela/support-kb";

describe("support bot", () => {
  it("matches fee questions", () => {
    assert.equal(matchSupport("how much are the swap fees?")?.article.id, "fees");
  });
  it("matches staking", () => {
    assert.equal(matchSupport("how do I unstake my JitoSOL")?.article.id, "stake");
  });
  it("returns null for gibberish", () => {
    assert.equal(matchSupport("qwerty zxcv"), null);
  });
  it("flags urgent issues", () => {
    assert.ok(isUrgent("my wallet got hacked"));
    assert.ok(isUrgent("I lost all my SOL"));
    assert.ok(isUrgent("send button is broken"));
    assert.ok(!isUrgent("what are the fees"));
  });
  it("detects a pasted phrase", () => {
    assert.ok(looksLikePhrase("amber anchor apple arch armor atlas atom august basin beach birch blade"));
    assert.ok(!looksLikePhrase("how do I back up my recovery phrase safely please tell me the steps now ok"));
  });
});
