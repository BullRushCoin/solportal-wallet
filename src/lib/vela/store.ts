import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addressFromPhrase, fakeSignature, randomAddress } from "@/lib/vela/crypto";
import { dappById } from "@/lib/vela/dapps";
import { uid } from "@/lib/vela/format";
import { safeHttpUrl } from "@/lib/vela/open-url";
import type { TxIntent } from "@/lib/vela/provider";
import { STARTER_HOLDINGS, STARTER_NFTS, tokenBySymbol, type Nft } from "@/lib/vela/tokens";

export type WalletMode = "seed" | "passkey" | "imported";

export type Wallet = {
  mode: WalletMode;
  address: string;
  phrase: string[] | null;
  createdAt: number;
};

export type ActivityKind = "swap" | "send" | "receive" | "stake" | "buy" | "dapp" | "nft" | "message";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  usd: number;
  ts: number;
};

export type ConnectedSite = {
  origin: string;
  name: string;
  at: number;
};

export type Bookmark = {
  id: string;
  name: string;
  origin: string;
  dappId: string;
};

export type Revenue = {
  swapFeesUsd: number;
  stakeRevUsd: number;
  onrampRevUsd: number;
};

export type Tab = "home" | "explore" | "swap" | "activity" | "more";
export type MoreRoute = "root" | "stake" | "buy" | "sites" | "pro" | "security" | "blueprint";
export type Priority = "low" | "fast" | "protect";

export type BrowserState = {
  dappId: string;
  url: string;
  stage: "gate" | "site";
};

export type Sheet =
  | null
  | { kind: "send" }
  | { kind: "receive" }
  | { kind: "sign"; intent: TxIntent }
  | { kind: "connect"; dappId: string; next: TxIntent | { redirect: "swap" } | null }
  | { kind: "url" };

type Persisted = {
  wallet: Wallet | null;
  holdings: Record<string, number>;
  nfts: Nft[];
  activity: ActivityItem[];
  connected: ConnectedSite[];
  bookmarks: Bookmark[];
  recents: string[];
  revenue: Revenue;
  pro: boolean;
  priority: Priority;
  customRpc: string;
};

type Ephemeral = {
  hydrated: boolean;
  tab: Tab;
  more: MoreRoute;
  sheet: Sheet;
  browser: BrowserState | null;
  toast: string | null;
  lastSignature: string | null;
  watchAddress: string | null;
};

type Actions = {
  setHydrated: (value: boolean) => void;
  setTab: (tab: Tab) => void;
  setMore: (more: MoreRoute) => void;
  setSheet: (sheet: Sheet) => void;
  setToast: (toast: string | null) => void;
  createWallet: (mode: WalletMode, phrase: string[] | null) => Promise<void>;
  resetWallet: () => void;
  restoreSandbox: () => void;
  openDapp: (dappId: string, stage?: "gate" | "site") => void;
  openExternal: (url: string) => void;
  closeBrowser: () => void;
  acceptGate: () => void;
  toggleBookmark: (dappId: string) => void;
  connectSite: (dappId: string) => void;
  revokeSite: (origin: string) => void;
  approve: (intent: TxIntent) => void;
  reject: () => void;
  setPro: (pro: boolean) => void;
  setPriority: (priority: Priority) => void;
  setCustomRpc: (customRpc: string) => void;
  setWatchAddress: (address: string | null) => void;
};

const EMPTY_REVENUE: Revenue = { swapFeesUsd: 0, stakeRevUsd: 0, onrampRevUsd: 0 };

function seedActivity(now: number): ActivityItem[] {
  return [
    {
      id: uid(),
      kind: "receive",
      title: "Received SOL",
      detail: "From a sandbox faucet",
      usd: 1784,
      ts: now - 1000 * 60 * 60 * 26,
    },
    {
      id: uid(),
      kind: "swap",
      title: "Swapped SOL → USDC",
      detail: "Jupiter · 85 bps to treasury",
      usd: -420,
      ts: now - 1000 * 60 * 50,
    },
    {
      id: uid(),
      kind: "dapp",
      title: "Connected Drift",
      detail: "No tokens moved",
      usd: 0,
      ts: now - 1000 * 60 * 12,
    },
  ];
}

function pushActivity(list: ActivityItem[], item: Omit<ActivityItem, "id" | "ts">): ActivityItem[] {
  return [{ ...item, id: uid(), ts: Date.now() }, ...list].slice(0, 40);
}

function applyDeltas(holdings: Record<string, number>, deltas: Record<string, number>) {
  const next = { ...holdings };
  for (const [symbol, delta] of Object.entries(deltas)) {
    next[symbol] = Math.max(0, (next[symbol] ?? 0) + delta);
  }
  return next;
}

export function priorityFeeSol(priority: Priority): number {
  if (priority === "protect") return 0.0002;
  if (priority === "fast") return 0.00005;
  return 0.000005;
}

export const useVela = create<Persisted & Ephemeral & Actions>()(
  persist(
    (set, get) => ({
      wallet: null,
      holdings: { ...STARTER_HOLDINGS },
      nfts: [...STARTER_NFTS],
      activity: [],
      connected: [],
      bookmarks: [],
      recents: [],
      revenue: { ...EMPTY_REVENUE },
      pro: false,
      priority: "fast",
      customRpc: "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY",
      hydrated: false,
      tab: "home",
      more: "root",
      sheet: null,
      browser: null,
      toast: null,
      lastSignature: null,
      watchAddress: null,

      setHydrated: (hydrated) => set({ hydrated }),
      setTab: (tab) => set({ tab, more: tab === "more" ? get().more : "root" }),
      setMore: (more) => set({ more, tab: "more" }),
      setSheet: (sheet) => set({ sheet }),
      setToast: (toast) => set({ toast }),

      createWallet: async (mode, phrase) => {
        const address = phrase ? await addressFromPhrase(phrase.join(" ")) : randomAddress();
        const now = Date.now();
        set({
          wallet: { mode, address, phrase, createdAt: now },
          holdings: { ...STARTER_HOLDINGS },
          nfts: [...STARTER_NFTS],
          activity: seedActivity(now),
          connected: [],
          bookmarks: [],
          recents: [],
          revenue: { ...EMPTY_REVENUE },
          tab: "home",
          more: "root",
          sheet: null,
          browser: null,
        });
      },

      resetWallet: () =>
        set({
          wallet: null,
          holdings: { ...STARTER_HOLDINGS },
          nfts: [...STARTER_NFTS],
          activity: [],
          connected: [],
          bookmarks: [],
          recents: [],
          revenue: { ...EMPTY_REVENUE },
          pro: false,
          sheet: null,
          browser: null,
          tab: "home",
          more: "root",
        }),

      restoreSandbox: () =>
        set({
          holdings: { ...STARTER_HOLDINGS },
          nfts: [...STARTER_NFTS],
          toast: "Sandbox balances restored",
        }),

      openDapp: (dappId, stage) => {
        const dapp = dappById(dappId);
        if (!dapp) return;
        const recents = [dappId, ...get().recents.filter((id) => id !== dappId)].slice(0, 8);
        const nextStage = stage ?? (dapp.verified ? "site" : "gate");
        set({ browser: { dappId, url: dapp.origin, stage: nextStage }, recents });
      },

      openExternal: (url) => {
        const dapp = dappById("drainer");
        const hostish = url.trim();
        const matched = hostish.includes("sol-rewards.gift") ? dapp : undefined;
        if (matched) {
          set({
            browser: { dappId: matched.id, url: matched.origin, stage: "gate" },
            sheet: null,
          });
          return;
        }
        const safe = safeHttpUrl(hostish);
        if (!safe) {
          set({ sheet: null, toast: "Only http and https links can open." });
          return;
        }
        set({
          browser: { dappId: "external", url: safe, stage: "gate" },
          sheet: null,
        });
      },

      closeBrowser: () => set({ browser: null, sheet: null }),
      acceptGate: () => {
        const browser = get().browser;
        if (!browser) return;
        set({ browser: { ...browser, stage: "site" } });
      },

      toggleBookmark: (dappId) => {
        const dapp = dappById(dappId);
        if (!dapp) return;
        const exists = get().bookmarks.some((bookmark) => bookmark.dappId === dappId);
        set({
          bookmarks: exists
            ? get().bookmarks.filter((bookmark) => bookmark.dappId !== dappId)
            : [{ id: uid(), name: dapp.name, origin: dapp.origin, dappId }, ...get().bookmarks],
          toast: exists ? "Bookmark removed" : "Bookmarked",
        });
      },

      connectSite: (dappId) => {
        const dapp = dappById(dappId);
        if (!dapp) return;
        if (get().connected.some((site) => site.origin === dapp.origin)) return;
        set({
          connected: [{ origin: dapp.origin, name: dapp.name, at: Date.now() }, ...get().connected],
        });
      },

      revokeSite: (origin) => set({ connected: get().connected.filter((site) => site.origin !== origin) }),

      approve: (intent) => {
        const signature = fakeSignature();
        let holdings = { ...get().holdings };
        let nfts = get().nfts;
        let revenue = { ...get().revenue };
        let activity = get().activity;

        if (intent.kind === "swap") {
          const deltas: Record<string, number> = {};
          deltas[intent.input] = (deltas[intent.input] ?? 0) - intent.amountIn;
          deltas[intent.output] = (deltas[intent.output] ?? 0) + intent.amountOut;
          deltas.SOL = (deltas.SOL ?? 0) - intent.networkFeeSol;
          holdings = applyDeltas(holdings, deltas);
          revenue = { ...revenue, swapFeesUsd: revenue.swapFeesUsd + intent.feeUsd };
          activity = pushActivity(activity, {
            kind: "swap",
            title: `Swapped ${intent.input} → ${intent.output}`,
            detail: `Platform fee ${intent.feeUsd.toFixed(2)} USD to treasury`,
            usd: -intent.feeUsd,
          });
        } else if (intent.kind === "send") {
          const deltas: Record<string, number> = { [intent.symbol]: -intent.amount };
          deltas.SOL = (deltas.SOL ?? 0) - intent.networkFeeSol;
          holdings = applyDeltas(holdings, deltas);
          activity = pushActivity(activity, {
            kind: "send",
            title: `Sent ${intent.symbol}`,
            detail: intent.to,
            usd: -intent.amount * tokenBySymbol(intent.symbol).priceUsd,
          });
        } else if (intent.kind === "stake") {
          holdings = applyDeltas(holdings, {
            SOL: -(intent.amountIn + intent.networkFeeSol),
            [intent.to]: intent.amountOut,
          });
          revenue = { ...revenue, stakeRevUsd: revenue.stakeRevUsd + intent.revUsd };
          activity = pushActivity(activity, {
            kind: "stake",
            title: `Staked SOL → ${intent.to}`,
            detail: "Liquid staking receipt",
            usd: 0,
          });
        } else if (intent.kind === "buy") {
          holdings = applyDeltas(holdings, { [intent.symbol]: intent.amountOut });
          revenue = { ...revenue, onrampRevUsd: revenue.onrampRevUsd + intent.commissionUsd };
          activity = pushActivity(activity, {
            kind: "buy",
            title: `Bought ${intent.symbol}`,
            detail: `${intent.partner} · affiliate booked`,
            usd: intent.usd,
          });
        } else if (intent.kind === "dapp") {
          holdings = applyDeltas(holdings, { ...intent.deltas, SOL: (intent.deltas.SOL ?? 0) - intent.networkFeeSol });
          if (intent.nft && !nfts.some((nft) => nft.id === intent.nft?.id)) nfts = [intent.nft, ...nfts];
          activity = pushActivity(activity, {
            kind: intent.nft ? "nft" : "dapp",
            title: intent.activityTitle,
            detail: intent.site,
            usd: intent.usd,
          });
        } else if (intent.kind === "drain") {
          holdings = Object.fromEntries(Object.keys(holdings).map((symbol) => [symbol, 0]));
          nfts = [];
          activity = pushActivity(activity, {
            kind: "dapp",
            title: "Signed a drainer",
            detail: "Sandbox balances cleared — this is the failure mode",
            usd: -1,
          });
        } else if (intent.kind === "message") {
          activity = pushActivity(activity, {
            kind: "message",
            title: intent.title,
            detail: intent.site,
            usd: 0,
          });
        }

        set({
          holdings,
          nfts,
          revenue,
          activity,
          sheet: null,
          lastSignature: signature,
          toast: intent.kind === "drain" ? "Drainer signed. Balances cleared." : "Signed in sandbox",
        });
      },

      reject: () => set({ sheet: null, toast: "Rejected" }),

      setPro: (pro) => set({ pro, priority: pro ? "protect" : get().priority === "protect" ? "fast" : get().priority }),
      setPriority: (priority) => set({ priority }),
      setCustomRpc: (customRpc) => set({ customRpc }),
      setWatchAddress: (watchAddress) => set({ watchAddress, tab: "home" }),
    }),
    {
      name: "vela-sandbox-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        wallet: state.wallet,
        holdings: state.holdings,
        nfts: state.nfts,
        activity: state.activity,
        connected: state.connected,
        bookmarks: state.bookmarks,
        recents: state.recents,
        revenue: state.revenue,
        pro: state.pro,
        priority: state.priority,
        customRpc: state.customRpc,
      }),
    },
  ),
);
