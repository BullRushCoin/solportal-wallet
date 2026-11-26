import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { frameAllowed, isPublicHost } from "@/lib/vela/frame-policy";

const host = "solportal-wallet.vercel.app";
describe("frame policy", () => {
  it("blocks DENY and SAMEORIGIN", () => {
    assert.equal(frameAllowed({ xFrameOptions: "DENY", csp: null }, host), false);
    assert.equal(frameAllowed({ xFrameOptions: "SAMEORIGIN", csp: null }, host), false);
  });
  it("reads frame-ancestors", () => {
    assert.equal(frameAllowed({ xFrameOptions: null, csp: "default-src 'self'; frame-ancestors 'self'" }, host), false);
    assert.equal(frameAllowed({ xFrameOptions: null, csp: "frame-ancestors *" }, host), true);
    assert.equal(frameAllowed({ xFrameOptions: null, csp: "frame-ancestors https://*.vercel.app" }, host), true);
  });
  it("allows pages with no policy", () => {
    assert.equal(frameAllowed({ xFrameOptions: null, csp: "default-src 'self'" }, host), true);
  });
  it("rejects private hosts", () => {
    assert.equal(isPublicHost("localhost"), false);
    assert.equal(isPublicHost("127.0.0.1"), false);
    assert.equal(isPublicHost("tensor.trade"), true);
  });
});
