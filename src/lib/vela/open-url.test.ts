import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openSafeHttpUrl, safeHttpUrl } from "./open-url.ts";

describe("safeHttpUrl", () => {
  it("accepts http and https URLs and adds https when the scheme is omitted", () => {
    assert.equal(safeHttpUrl("https://app.drift.trade"), "https://app.drift.trade/");
    assert.equal(safeHttpUrl("http://example.com/path"), "http://example.com/path");
    assert.equal(safeHttpUrl("jup.ag"), "https://jup.ag/");
  });

  it("rejects non-http schemes and empty input", () => {
    assert.equal(safeHttpUrl("javascript:alert(1)"), null);
    assert.equal(safeHttpUrl("data:text/html,hi"), null);
    assert.equal(safeHttpUrl("file:///etc/passwd"), null);
    assert.equal(safeHttpUrl("ftp://example.com"), null);
    assert.equal(safeHttpUrl(""), null);
    assert.equal(safeHttpUrl("   "), null);
  });
});

describe("openSafeHttpUrl", () => {
  it("opens only safe URLs with noopener and noreferrer", () => {
    const calls: unknown[] = [];
    const original = globalThis.window;
    const open = (url?: string | URL, target?: string, features?: string) => {
      calls.push([url, target, features]);
      return null;
    };
    // @ts-expect-error test stub
    globalThis.window = { open };
    try {
      assert.equal(openSafeHttpUrl("https://jup.ag"), true);
      assert.deepEqual(calls[0], ["https://jup.ag/", "_blank", "noopener,noreferrer"]);
      assert.equal(openSafeHttpUrl("javascript:alert(1)"), false);
      assert.equal(calls.length, 1);
    } finally {
      if (original === undefined) {
        // @ts-expect-error cleanup
        delete globalThis.window;
      } else {
        globalThis.window = original;
      }
    }
  });
});
