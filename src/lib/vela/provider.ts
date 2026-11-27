import type { CustomToken, Nft } from "@/lib/vela/tokens";

/**
 * Wallet Standard methods the in-app browser exposes to a dApp.
 * The iframe never receives key material — only this request/response bridge.
 */
export const VELA_PROVIDER_METHODS = [
  "standard:connect",
  "standard:disconnect",
  "solana:signMessage",
  "solana:signTransaction",
  "solana:signAndSendTransaction",
  "solana:signAllTransactions",
] as const;

export type Effect = {
  symbol: string;
  delta: number;
  usd: number;
};

export type Finding = {
  level: "info" | "warn" | "critical";
  title: string;
  detail: string;
};

type IntentBase = {
  origin: string;
  site: string;
  verified: boolean;
  title: string;
  effects: Effect[];
  authorities: Finding[];
  warnings: Finding[];
  networkFeeSol: number;
};

export type TxIntent = IntentBase &
  (
    | {
        kind: "swap";
        input: string;
        output: string;
        amountIn: number;
        amountOut: number;
        feeUsd: number;
        /** A daily-reward free trade: the platform fee is waived and one free trade is used. */
        freeTrade?: boolean;
        /** Set when the output is a token the sandbox has not seen before; registered on approve. */
        outputToken?: CustomToken;
      }
    | { kind: "send"; symbol: string; amount: number; to: string }
    | { kind: "send-nft"; nft: Nft; to: string }
    | {
        kind: "stake";
        from: string;
        to: string;
        amountIn: number;
        amountOut: number;
        revUsd: number;
        action?: "stake" | "unstake";
        target?: "lst" | "native";
        vote?: string;
        validatorName?: string;
        validatorImage?: string | null;
        activationEpoch?: number;
        apyPct?: number;
        positionId?: string;
        feeWallet?: string;
      }
    | {
        kind: "buy";
        usd: number;
        symbol: string;
        amountOut: number;
        commissionUsd: number;
        partner: string;
      }
    | {
        kind: "dapp";
        deltas: Record<string, number>;
        activityTitle: string;
        usd: number;
        nft?: Nft;
      }
    | { kind: "drain" }
    | { kind: "message"; message: string }
    | {
        kind: "incinerate";
        items: Array<{
          mint: string;
          symbol: string;
          name: string;
          amount: number;
          valueUsd: number | null;
          image: string | null;
          action: "swap" | "burn";
          rentSol: number;
          swapSol: number | null;
        }>;
        rentSol: number;
        swapSol: number;
        feeSol: number;
        feeBps: number;
        netSol: number;
        feeWallet: string;
      }
  );

export type BridgeRequest = {
  source: "vela-inpage";
  id: string;
  origin: string;
  method: (typeof VELA_PROVIDER_METHODS)[number];
  payload: unknown;
};

export type BridgeResponse = {
  source: "vela-host";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: "rejected" | "unauthorized" | "simulation-blocked";
};

export function intentBlocked(intent: TxIntent, holdings: Record<string, number>): string | null {
  if (intent.kind === "drain" || intent.kind === "buy") return null;
  if (intent.kind === "incinerate") {
    if ((holdings.SOL ?? 0) + 1e-8 < intent.networkFeeSol) return "Not enough SOL";
    return null;
  }
  const need: Record<string, number> = {};
  for (const effect of intent.effects) {
    if (effect.delta < 0) need[effect.symbol] = (need[effect.symbol] ?? 0) - effect.delta;
  }
  need.SOL = (need.SOL ?? 0) + intent.networkFeeSol;
  for (const [symbol, amount] of Object.entries(need)) {
    if ((holdings[symbol] ?? 0) + 1e-8 < amount) return `Not enough ${symbol}`;
  }
  return null;
}

/**
 * Production inpage provider. Ship this inside the webview, not the keystore.
 * The host frame is the only place allowed to touch secrets.
 */
export const PROVIDER_BRIDGE_EXAMPLE = `type Rpc = {
  id: string;
  method:
    | "standard:connect"
    | "solana:signTransaction"
    | "solana:signMessage";
  payload?: unknown;
};

const pending = new Map<string, (value: unknown) => void>();

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const data = event.data as { source?: string; id?: string; ok?: boolean; result?: unknown };
  if (data?.source !== "vela-host" || !data.id) return;
  pending.get(data.id)?.(data);
  pending.delete(data.id);
});

function ask(method: Rpc["method"], payload?: unknown) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => {
      const data = msg as { ok?: boolean; result?: unknown };
      if (!data.ok) reject(new Error("User rejected the request"));
      else resolve(data.result);
    });
    parent.postMessage(
      { source: "vela-inpage", id, origin: location.origin, method, payload },
      "*",
    );
  });
}

window.addEventListener("wallet-standard:app-ready", () => {
  window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", {
    detail: {
      register(registerWallet: (wallet: unknown) => void) {
        registerWallet({
          name: "SolPortal",
          chains: ["solana:mainnet"],
          features: {
            "standard:connect": { connect: () => ask("standard:connect") },
            "solana:signTransaction": {
              signTransaction: (...inputs: unknown[]) => ask("solana:signTransaction", inputs),
            },
            "solana:signMessage": {
              signMessage: (...inputs: unknown[]) => ask("solana:signMessage", inputs),
            },
          },
        });
      },
    },
  }));
});`;
