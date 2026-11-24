import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const memory = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => {
    memory.set(key, String(value));
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};
Object.defineProperty(globalThis, "localStorage", {
  value: localStorageStub,
  configurable: true,
});

const { useVela } = await import("./store.ts");
const { STARTER_HOLDINGS } = await import("./tokens.ts");
const { addressFromPhrase } = await import("./crypto.ts");
type TxIntent = import("./provider.ts").TxIntent;

const PHRASE = "amber anchor apple arch armor atlas atom august basin beach birch blade".split(" ");

function swapIntent(overrides?: Partial<Extract<TxIntent, { kind: "swap" }>>): TxIntent {
  return {
    kind: "swap",
    origin: "https://solportal.wallet",
    site: "SolPortal Swap",
    verified: true,
    title: "Swap SOL for USDC",
    input: "SOL",
    output: "USDC",
    amountIn: 1,
    amountOut: 176.84,
    feeUsd: 1.52,
    networkFeeSol: 0.00005,
    effects: [
      { symbol: "SOL", delta: -1, usd: -178.42 },
      { symbol: "USDC", delta: 176.84, usd: 176.84 },
    ],
    authorities: [],
    warnings: [],
    ...overrides,
  };
}

afterEach(() => {
  useVela.getState().resetWallet();
  useVela.setState({ toast: null, lastSignature: null, browser: null, sheet: null });
  memory.clear();
});

describe("store create and approve", () => {
  it("creates a sandbox wallet from a phrase with a deterministic address", async () => {
    await useVela.getState().createWallet("imported", PHRASE);
    const state = useVela.getState();
    assert.equal(state.wallet?.mode, "imported");
    assert.deepEqual(state.wallet?.phrase, PHRASE);
    assert.equal(state.wallet?.address, await addressFromPhrase(PHRASE.join(" ")));
    assert.equal(state.holdings.SOL, STARTER_HOLDINGS.SOL);
    assert.equal(state.tab, "home");
  });

  it("applies a swap only in local state and records activity", async () => {
    await useVela.getState().createWallet("imported", PHRASE);
    const before = useVela.getState().holdings;
    useVela.getState().approve(swapIntent());
    const after = useVela.getState();
    assert.ok(Math.abs(after.holdings.SOL - (before.SOL - 1 - 0.00005)) < 1e-9);
    assert.ok(Math.abs(after.holdings.USDC - (before.USDC + 176.84)) < 1e-9);
    assert.equal(after.activity[0]?.kind, "swap");
    assert.match(after.activity[0]?.title ?? "", /Swapped SOL → USDC/);
    assert.equal(after.toast, "Signed in sandbox");
    assert.equal(typeof after.lastSignature, "string");
    assert.ok((after.lastSignature?.length ?? 0) > 10);
    assert.ok(after.revenue.swapFeesUsd > 0);
  });

  it("reject does not change holdings", async () => {
    await useVela.getState().createWallet("imported", PHRASE);
    useVela.getState().setSheet({ kind: "sign", intent: swapIntent() });
    const holdings = { ...useVela.getState().holdings };
    useVela.getState().reject();
    assert.deepEqual(useVela.getState().holdings, holdings);
    assert.equal(useVela.getState().sheet, null);
    assert.equal(useVela.getState().toast, "Rejected");
  });

  it("refuses to open a non-http URL in the in-app browser", () => {
    useVela.getState().openExternal("javascript:alert(1)");
    assert.equal(useVela.getState().browser, null);
    assert.match(useVela.getState().toast ?? "", /http/i);
  });

  it("opens a typed https URL in the sandbox browser", () => {
    useVela.getState().openExternal("example.com");
    const browser = useVela.getState().browser;
    assert.equal(browser?.dappId, "external");
    assert.equal(browser?.url, "https://example.com/");
    assert.equal(browser?.stage, "gate");
  });
});
