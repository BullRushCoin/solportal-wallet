import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { GLOBAL_SKIN_KEY, type CardSkinId } from "@/lib/vela/card-skins";
import { addressFromPhrase, fakeSignature, randomAddress } from "@/lib/vela/crypto";
import { dappById } from "@/lib/vela/dapps";
import { uid } from "@/lib/vela/format";
import { safeHttpUrl } from "@/lib/vela/open-url";
import type { TxIntent } from "@/lib/vela/provider";
import type { NativeStakePosition } from "@/lib/vela/stake";
import { preferSwapOutput } from "@/lib/vela/incinerator";
import { claimReward, EMPTY_REWARDS, type Rewards } from "@/lib/vela/rewards";
import {
  holdingKeyFor,
  setCustomTokens,
  STARTER_HOLDINGS,
  STARTER_NFTS,
  tokenBySymbol,
  tokenLookup,
  type CustomToken,
  type Nft,
} from "@/lib/vela/tokens";

export type WalletMode = "seed" | "passkey" | "imported";

export type Wallet = {
  mode: WalletMode;
  address: string;
  phrase: string[] | null;
  createdAt: number;
};

export type ActivityKind = "swap" | "send" | "receive" | "stake" | "buy" | "dapp" | "nft" | "message" | "incinerate";

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

export type Tab = "home" | "explore" | "swap" | "market" | "more";
export type MoreRoute =
  | "root"
  | "activity"
  | "stake"
  | "buy"
  | "sites"
  | "pro"
  | "security"
  | "blueprint"
  | "collectibles"
  | "watch"
  | "support"
  | "revenue"
  | "rewards";
export type Priority = "low" | "fast" | "protect";

export type BrowserState = {
  dappId: string;
  url: string;
  stage: "gate" | "site" | "live";
};

export type SwapPrefill = {
  input: string;
  output: string;
  /** Buy flow from a coin sheet: keep this input/output pair as given and focus the amount. */
  buy?: boolean;
  token?: {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    priceUsd: number | null;
    image?: string | null;
  };
};

export type Sheet =
  | null
  | { kind: "send" }
  | { kind: "receive" }
  | { kind: "sign"; intent: TxIntent }
  | { kind: "connect"; dappId: string; next: TxIntent | { redirect: "swap" } | null }
  | { kind: "url" }
  | { kind: "wallets" }
  | { kind: "add-wallet" }
  | { kind: "card-skin" }
  | { kind: "asset"; token: AssetSheetToken; amount: number; viewOnly?: boolean };

export type AccountKind = WalletMode | "watch";

export type AccountSnapshot = {
  holdings: Record<string, number>;
  nfts: Nft[];
  activity: ActivityItem[];
  connected: ConnectedSite[];
  nativeStakes: NativeStakePosition[];
  incineratedMints: string[];
};

/** One entry in "My wallets". Sandbox wallets keep their balances in `snapshot` while inactive. */
export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  address: string;
  wallet: Wallet | null;
  snapshot: AccountSnapshot | null;
  createdAt: number;
};

/** A starred coin. Shared by every wallet in this browser; prices are fetched live. */
export type WatchItem = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  image: string | null;
  addedAt: number;
};

export type AssetSheetToken = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  priceUsd: number | null;
  change24hPct?: number | null;
  image?: string | null;
};

type Persisted = {
  wallet: Wallet | null;
  accounts: Account[];
  activeAccountId: string | null;
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
  nativeStakes: NativeStakePosition[];
  incineratedMints: string[];
  watchlist: WatchItem[];
  /** Tokens learned at runtime (e.g. bought by mint in Swap). Metadata only; shared by every wallet. */
  customTokens: CustomToken[];
  /** Balance-card skin per account id (GLOBAL_SKIN_KEY when no account). */
  cardSkins: Record<string, CardSkinId>;
  /** Daily check-in streak and unused free trades. */
  rewards: Rewards;
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
  swapPrefill: SwapPrefill | null;
};

type Actions = {
  setHydrated: (value: boolean) => void;
  setTab: (tab: Tab) => void;
  setMore: (more: MoreRoute) => void;
  setSheet: (sheet: Sheet) => void;
  setToast: (toast: string | null) => void;
  createWallet: (mode: WalletMode, phrase: string[] | null, name?: string) => Promise<void>;
  addWatchAccount: (address: string, name?: string) => void;
  switchAccount: (id: string) => void;
  renameAccount: (id: string, name: string) => void;
  removeAccount: (id: string) => void;
  resetWallet: () => void;
  restoreSandbox: () => void;
  openDapp: (dappId: string, stage?: "gate" | "site" | "live") => void;
  goLive: () => void;
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
  openSwap: (from?: string | SwapPrefill) => void;
  clearSwapPrefill: () => void;
  toggleWatch: (item: Omit<WatchItem, "addedAt">) => void;
  /** Refresh USD prices of runtime tokens from /api/prices. */
  refreshCustomPrices: () => Promise<void>;
  setCardSkin: (skin: CardSkinId) => void;
  /** Claim today's check-in reward; returns the free trades gained, or 0 when already claimed. */
  claimDaily: () => number;
};

/** Register a runtime token; returns its holdings key (reuses an existing key for the same mint). */
function registerCustom(list: CustomToken[], token: CustomToken): { list: CustomToken[]; key: string } {
  const sameMint = list.find((item) => item.mint === token.mint);
  if (sameMint) {
    const next = list.map((item) => (item.mint === token.mint ? { ...item, ...token, symbol: item.symbol, priceUsd: token.priceUsd || item.priceUsd } : item));
    return { list: next, key: sameMint.symbol };
  }
  const known = tokenLookup(token.symbol);
  if (known && known.mint === token.mint) return { list, key: known.symbol };
  const key = holdingKeyFor(token.symbol, token.mint, (candidate) => tokenLookup(candidate) ?? list.find((item) => item.symbol === candidate) ?? null);
  return { list: [...list, { ...token, symbol: key }].slice(-200), key };
}

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

function snapshotOf(state: Persisted): AccountSnapshot {
  return {
    holdings: state.holdings,
    nfts: state.nfts,
    activity: state.activity,
    connected: state.connected,
    nativeStakes: state.nativeStakes,
    incineratedMints: state.incineratedMints,
  };
}

/** Write the live top-level balances back into the sandbox account they belong to. */
function captureLive(state: Persisted): Account[] {
  const live = state.wallet?.address;
  if (!live) return state.accounts;
  return state.accounts.map((account) =>
    account.kind !== "watch" && account.address === live ? { ...account, snapshot: snapshotOf(state) } : account,
  );
}

function freshSnapshot(now: number): AccountSnapshot {
  return {
    holdings: { ...STARTER_HOLDINGS },
    nfts: [...STARTER_NFTS],
    activity: seedActivity(now),
    connected: [],
    nativeStakes: [],
    incineratedMints: [],
  };
}

function accountGroup(kind: AccountKind): "Wallet" | "Imported" | "Watched" {
  return kind === "watch" ? "Watched" : kind === "imported" ? "Imported" : "Wallet";
}

function defaultName(accounts: Account[], kind: AccountKind): string {
  if (accounts.length === 0) return "Main Wallet";
  const group = accountGroup(kind);
  const count = accounts.filter((account) => accountGroup(account.kind) === group).length;
  return `${group} ${count + 1}`;
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
      accounts: [],
      activeAccountId: null,
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
      nativeStakes: [],
      incineratedMints: [],
      watchlist: [],
      customTokens: [],
      cardSkins: {},
      rewards: { ...EMPTY_REWARDS },
      hydrated: false,
      tab: "home",
      more: "root",
      sheet: null,
      browser: null,
      toast: null,
      lastSignature: null,
      watchAddress: null,
      swapPrefill: null,

      setHydrated: (hydrated) => set({ hydrated }),
      claimDaily: () => {
        const result = claimReward(get().rewards ?? EMPTY_REWARDS);
        if (!result) return 0;
        set({
          rewards: result.next,
          toast: `Day ${result.next.streak} claimed: +${result.gained} free trade${result.gained === 1 ? "" : "s"}`,
        });
        return result.gained;
      },
      setCardSkin: (skin) =>
        set((state) => ({
          // Remember per wallet, and as the global fallback for wallets that never picked one.
          cardSkins: { ...state.cardSkins, [GLOBAL_SKIN_KEY]: skin, ...(state.activeAccountId ? { [state.activeAccountId]: skin } : {}) },
        })),
      setTab: (tab) => set({ tab, more: tab === "more" ? get().more : "root" }),
      setMore: (more) => set({ more, tab: "more" }),
      setSheet: (sheet) => set({ sheet }),
      setToast: (toast) => set({ toast }),

      createWallet: async (mode, phrase, name) => {
        const address = phrase ? await addressFromPhrase(phrase.join(" ")) : randomAddress();
        const now = Date.now();
        const state = get();
        const accounts = captureLive(state);
        const existing = accounts.find((account) => account.kind !== "watch" && account.address === address);
        if (existing) {
          set({ accounts });
          get().switchAccount(existing.id);
          set({ toast: "That wallet is already added" });
          return;
        }
        const wallet: Wallet = { mode, address, phrase, createdAt: now };
        const account: Account = {
          id: uid(),
          name: name?.trim() || defaultName(accounts, mode),
          kind: mode,
          address,
          wallet,
          snapshot: null,
          createdAt: now,
        };
        const fresh = freshSnapshot(now);
        set({
          wallet,
          accounts: [...accounts, account],
          activeAccountId: account.id,
          ...fresh,
          bookmarks: state.wallet ? state.bookmarks : [],
          recents: state.wallet ? state.recents : [],
          revenue: state.wallet ? state.revenue : { ...EMPTY_REVENUE },
          watchAddress: null,
          tab: "home",
          more: "root",
          sheet: null,
          browser: null,
        });
      },

      addWatchAccount: (address, name) => {
        const state = get();
        const accounts = captureLive(state);
        const existing = accounts.find((account) => account.kind === "watch" && account.address === address);
        if (existing) {
          set({ accounts, activeAccountId: existing.id, watchAddress: address, tab: "home", more: "root", sheet: null });
          return;
        }
        const account: Account = {
          id: uid(),
          name: name?.trim() || defaultName(accounts, "watch"),
          kind: "watch",
          address,
          wallet: null,
          snapshot: null,
          createdAt: Date.now(),
        };
        set({
          accounts: [...accounts, account],
          activeAccountId: account.id,
          watchAddress: address,
          tab: "home",
          more: "root",
          sheet: null,
        });
      },

      switchAccount: (id) => {
        const state = get();
        const target = state.accounts.find((account) => account.id === id);
        if (!target) return;
        const accounts = captureLive(state);
        if (target.kind === "watch") {
          set({ accounts, activeAccountId: id, watchAddress: target.address, tab: "home", more: "root", sheet: null });
          return;
        }
        const saved = accounts.find((account) => account.id === id)!;
        const isLive = state.wallet?.address === target.address;
        const snapshot = isLive ? snapshotOf(state) : (saved.snapshot ?? freshSnapshot(Date.now()));
        set({
          accounts,
          activeAccountId: id,
          wallet: target.wallet,
          ...snapshot,
          watchAddress: null,
          tab: "home",
          more: "root",
          sheet: null,
          browser: null,
        });
      },

      renameAccount: (id, name) => {
        const trimmed = name.trim().slice(0, 32);
        if (!trimmed) return;
        set({ accounts: get().accounts.map((account) => (account.id === id ? { ...account, name: trimmed } : account)) });
      },

      removeAccount: (id) => {
        const state = get();
        const target = state.accounts.find((account) => account.id === id);
        if (!target) return;
        const sandboxCount = state.accounts.filter((account) => account.kind !== "watch").length;
        if (target.kind !== "watch" && sandboxCount <= 1) {
          set({ toast: "Keep at least one wallet. Use Erase sandbox wallet to start over." });
          return;
        }
        const accounts = captureLive(state).filter((account) => account.id !== id);
        set({ accounts, toast: `Removed ${target.name}` });
        const removingLive = target.kind !== "watch" && state.wallet?.address === target.address;
        if (removingLive) {
          const next = accounts.find((account) => account.kind !== "watch")!;
          get().switchAccount(next.id);
          set({ sheet: { kind: "wallets" } });
          return;
        }
        if (state.activeAccountId === id) {
          const live = accounts.find((account) => account.kind !== "watch" && account.address === state.wallet?.address);
          set({ activeAccountId: live?.id ?? null, watchAddress: null });
        }
      },

      resetWallet: () =>
        set({
          wallet: null,
          accounts: [],
          activeAccountId: null,
          holdings: { ...STARTER_HOLDINGS },
          nfts: [...STARTER_NFTS],
          activity: [],
          connected: [],
          bookmarks: [],
          recents: [],
          revenue: { ...EMPTY_REVENUE },
          nativeStakes: [],
          incineratedMints: [],
          pro: false,
          watchAddress: null,
          sheet: null,
          browser: null,
          tab: "home",
          more: "root",
        }),

      restoreSandbox: () =>
        set({
          holdings: { ...STARTER_HOLDINGS },
          nfts: [...STARTER_NFTS],
          nativeStakes: [],
          incineratedMints: [],
          toast: "Sandbox balances restored",
        }),

      openDapp: (dappId, stage) => {
        const dapp = dappById(dappId);
        if (!dapp) return;
        const recents = [dappId, ...get().recents.filter((id) => id !== dappId)].slice(0, 8);
        const nextStage = stage ?? (dapp.verified ? "live" : "gate");
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
          browser: { dappId: "external", url: safe, stage: "live" },
          sheet: null,
        });
      },

      closeBrowser: () => set({ browser: null, sheet: null }),
      goLive: () => {
        const browser = get().browser;
        if (!browser) return;
        set({ browser: { ...browser, stage: "live" } });
      },
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
          let output = intent.output;
          if (intent.outputToken) {
            const registered = registerCustom(get().customTokens, intent.outputToken);
            setCustomTokens(registered.list);
            set({ customTokens: registered.list });
            output = registered.key;
          }
          const deltas: Record<string, number> = {};
          deltas[intent.input] = (deltas[intent.input] ?? 0) - intent.amountIn;
          deltas[output] = (deltas[output] ?? 0) + intent.amountOut;
          deltas.SOL = (deltas.SOL ?? 0) - intent.networkFeeSol;
          holdings = applyDeltas(holdings, deltas);
          if (intent.freeTrade) {
            const rewards = get().rewards ?? EMPTY_REWARDS;
            set({ rewards: { ...rewards, freeTrades: Math.max(0, rewards.freeTrades - 1) } });
          } else {
            revenue = { ...revenue, swapFeesUsd: revenue.swapFeesUsd + intent.feeUsd };
          }
          activity = pushActivity(activity, {
            kind: "swap",
            title: `Swapped ${intent.input} → ${output}`,
            detail: intent.freeTrade ? "Free trade: platform fee waived" : `Platform fee ${intent.feeUsd.toFixed(2)} USD to treasury`,
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
          const action = intent.action ?? "stake";
          const target = intent.target ?? "lst";
          let nativeStakes = [...get().nativeStakes];
          if (action === "unstake" && target === "lst") {
            holdings = applyDeltas(holdings, {
              [intent.from]: -intent.amountIn,
              SOL: intent.amountOut - intent.networkFeeSol,
            });
            activity = pushActivity(activity, {
              kind: "stake",
              title: `Unstaked ${intent.from} → SOL`,
              detail: "Simulated liquid unstake · nothing broadcasts",
              usd: 0,
            });
          } else if (action === "unstake" && target === "native") {
            nativeStakes = intent.positionId
              ? nativeStakes.filter((item) => item.id !== intent.positionId)
              : nativeStakes;
            holdings = applyDeltas(holdings, { SOL: intent.amountOut - intent.networkFeeSol });
            activity = pushActivity(activity, {
              kind: "stake",
              title: "Unstaked native SOL",
              detail: intent.validatorName
                ? `Simulated cooldown skipped · ${intent.validatorName}`
                : "Simulated native unstake · nothing broadcasts",
              usd: 0,
            });
          } else if (target === "native") {
            holdings = applyDeltas(holdings, { SOL: -(intent.amountIn + intent.networkFeeSol) });
            nativeStakes = [
              {
                id: uid(),
                vote: intent.vote ?? "unknown",
                name: intent.validatorName ?? "Validator",
                image: intent.validatorImage ?? null,
                amountSol: intent.amountIn,
                activationEpoch: intent.activationEpoch ?? 0,
                deactivationEpoch: null,
              },
              ...nativeStakes,
            ];
            activity = pushActivity(activity, {
              kind: "stake",
              title: `Staked ${intent.amountIn} SOL natively`,
              detail: `Simulated · ${intent.validatorName ?? intent.vote ?? "validator"}`,
              usd: 0,
            });
          } else {
            holdings = applyDeltas(holdings, {
              SOL: -(intent.amountIn + intent.networkFeeSol),
              [intent.to]: intent.amountOut,
            });
            activity = pushActivity(activity, {
              kind: "stake",
              title: `Staked SOL → ${intent.to}`,
              detail: "Simulated liquid staking receipt · nothing broadcasts",
              usd: 0,
            });
          }
          revenue = { ...revenue, stakeRevUsd: revenue.stakeRevUsd + intent.revUsd };
          set({ holdings, nfts, revenue, activity, nativeStakes, sheet: null, lastSignature: signature, toast: "Signed in sandbox" });
          return;
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
        } else if (intent.kind === "incinerate") {
          for (const item of intent.items) {
            if (item.symbol) delete holdings[item.symbol];
          }
          holdings = applyDeltas(holdings, { SOL: intent.netSol - intent.networkFeeSol });
          revenue = { ...revenue, swapFeesUsd: revenue.swapFeesUsd + intent.feeSol * (tokenBySymbol("SOL").priceUsd) };
          activity = pushActivity(activity, {
            kind: "incinerate",
            title: `Incinerated ${intent.items.length} token account${intent.items.length === 1 ? "" : "s"}`,
            detail: `Simulated · ${intent.netSol.toFixed(6)} SOL back · nothing broadcasts`,
            usd: intent.netSol * tokenBySymbol("SOL").priceUsd,
          });
          set({
            holdings,
            nfts,
            revenue,
            activity,
            incineratedMints: [...new Set([...get().incineratedMints, ...intent.items.map((item) => item.mint)])],
            sheet: null,
            lastSignature: signature,
            toast: "Signed in sandbox",
          });
          return;
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
      setWatchAddress: (watchAddress) => {
        if (watchAddress) {
          get().addWatchAccount(watchAddress);
          return;
        }
        const state = get();
        const live = state.accounts.find((account) => account.kind !== "watch" && account.address === state.wallet?.address);
        set({ watchAddress: null, activeAccountId: live?.id ?? state.activeAccountId, tab: "home", more: "root" });
      },

      openSwap: (from) => {
        if (!from) {
          set({ tab: "swap", more: "root", swapPrefill: null });
          return;
        }
        if (typeof from === "string") {
          set({ tab: "swap", more: "root", swapPrefill: { input: from, output: preferSwapOutput(from) } });
          return;
        }
        set({
          tab: "swap",
          more: "root",
          swapPrefill: { input: from.input, output: from.output || preferSwapOutput(from.input), token: from.token, buy: from.buy },
        });
      },
      clearSwapPrefill: () => set({ swapPrefill: null }),

      refreshCustomPrices: async () => {
        const list = get().customTokens;
        if (!list.length) return;
        try {
          const res = await fetch(`/api/prices?mints=${list.map((token) => token.mint).join(",")}`);
          if (!res.ok) return;
          const body = (await res.json()) as { prices?: Record<string, { priceUsd: number | null }> };
          const next = get().customTokens.map((token) => {
            const price = body.prices?.[token.mint]?.priceUsd;
            return price && price > 0 ? { ...token, priceUsd: price } : token;
          });
          setCustomTokens(next);
          set({ customTokens: next });
        } catch {
          // Keep the last known prices.
        }
      },

      toggleWatch: (item) => {
        const list = get().watchlist;
        const exists = list.some((entry) => entry.mint === item.mint);
        set({
          watchlist: exists ? list.filter((entry) => entry.mint !== item.mint) : [{ ...item, addedAt: Date.now() }, ...list].slice(0, 100),
          toast: exists ? `Removed ${item.symbol} from watchlist` : `Added ${item.symbol} to watchlist`,
        });
      },
    }),
    {
      name: "vela-sandbox-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        wallet: state.wallet,
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
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
        nativeStakes: state.nativeStakes,
        incineratedMints: state.incineratedMints,
        watchlist: state.watchlist,
        customTokens: state.customTokens,
        cardSkins: state.cardSkins,
        rewards: state.rewards,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Persisted>;
        const customTokens = Array.isArray(saved.customTokens) ? saved.customTokens : [];
        setCustomTokens(customTokens);
        const holdings = { ...(saved.holdings ?? current.holdings) };
        const incinerated = new Set(saved.incineratedMints ?? []);
        for (const [symbol, amount] of Object.entries(STARTER_HOLDINGS)) {
          if (symbol in holdings) continue;
          const token = tokenBySymbol(symbol);
          if (incinerated.has(token.mint)) continue;
          holdings[symbol] = amount;
        }
        let accounts = saved.accounts ?? [];
        let activeAccountId = saved.activeAccountId ?? null;
        if (saved.wallet && accounts.length === 0) {
          // Upgrade from the single-wallet build: the existing wallet becomes "Main Wallet".
          const main: Account = {
            id: uid(),
            name: "Main Wallet",
            kind: saved.wallet.mode,
            address: saved.wallet.address,
            wallet: saved.wallet,
            snapshot: null,
            createdAt: saved.wallet.createdAt,
          };
          accounts = [main];
          activeAccountId = main.id;
        }
        const active = accounts.find((account) => account.id === activeAccountId);
        return {
          ...current,
          ...saved,
          accounts,
          activeAccountId,
          watchAddress: active?.kind === "watch" ? active.address : null,
          holdings,
          incineratedMints: saved.incineratedMints ?? [],
          watchlist: Array.isArray(saved.watchlist) ? saved.watchlist : [],
          customTokens,
          cardSkins: saved.cardSkins && typeof saved.cardSkins === "object" ? saved.cardSkins : {},
        };
      },
    },
  ),
);
