import { useState } from "react";
import { feeAccountForToken } from "@/lib/vela/fee-wallet";
import { buildSwapBody, PLATFORM_FEE_BPS, sampleQuoteUrl } from "@/lib/vela/jupiter";
import { PROVIDER_BRIDGE_EXAMPLE, VELA_PROVIDER_METHODS } from "@/lib/vela/provider";
import { RATE_CARD } from "@/lib/vela/dapps";
import { useVela } from "@/lib/vela/store";
import { tokenBySymbol } from "@/lib/vela/tokens";
import { SectionLabel } from "@/components/vela/ui";

const PHASES = [
  {
    name: "MVP",
    when: "Weeks 1–6",
    items: "Seed + passkey onboarding, local keystore, SOL/SPL/Token-2022 balances, NFTs, send, receive, history.",
  },
  {
    name: "Swaps",
    when: "Weeks 7–9",
    items: "Jupiter quote and swap from your backend. 85 bps fee account. Slippage and priority fee presets.",
  },
  {
    name: "Explore",
    when: "Weeks 10–15",
    items: "Directory, sandboxed webview, Wallet Standard bridge, simulation, bookmarks, connected sites.",
  },
  {
    name: "Revenue",
    when: "Weeks 16–19",
    items: "LST partner flows, fiat affiliate webview, sponsored placements, campaign reporting.",
  },
  {
    name: "Pro + launch",
    when: "Weeks 20–24",
    items: "MEV-aware tips, custom RPC, P&L, store review, abuse review, and a public audit.",
  },
];

const CHECKS = [
  { title: "Keys never enter the webview", detail: "Inject a provider shim. The iframe is sandboxed and has no token to the keystore." },
  { title: "Origin is part of every request", detail: "Compare the webview origin to the connected-site record. Drop the message if they differ." },
  { title: "Simulate before sign", detail: "Helius or your RPC simulateTransaction. Show deltas, authority changes, and a drainer rule pack." },
  { title: "Unknown domains are second-class", detail: "Directory hosts skip the interstitial. Everything else gets a warning the user cannot scroll past." },
  { title: "Phrase stays on device", detail: "Encrypt with a passcode or WebAuthn PRF. No analytics event may contain it. Warn before screenshots." },
  { title: "Fee account is a token account you own", detail: "Mint must be the input or output mint. Token-2022 fees need instructionVersion=V2." },
  { title: "API key stays on the server", detail: "portal.jup.ag keys do not ship in the app. The phone only receives an unsigned transaction." },
  { title: "Store billing is separate from crypto", detail: "Pro is IAP. Buying SOL is an external on-ramp. Do not sell crypto through Apple In-App Purchase." },
];

export function Blueprint({ embedded = false }: { embedded?: boolean }) {
  const setMore = useVela((state) => state.setMore);
  const revenue = useVela((state) => state.revenue);
  const [code, setCode] = useState<"quote" | "swap" | "bridge">("quote");
  const sol = tokenBySymbol("SOL");
  const swapPreview = buildSwapBody({
    quoteResponse: {
      inputMint: sol.mint,
      inAmount: "1000000000",
      outputMint: tokenBySymbol("USDC").mint,
      outAmount: "0",
      otherAmountThreshold: "0",
      swapMode: "ExactIn",
      slippageBps: 50,
      priceImpactPct: "0",
      platformFee: { amount: "0", feeBps: PLATFORM_FEE_BPS },
      routePlan: [],
    },
    userPublicKey: "USER_PUBLIC_KEY",
    feeAccount: feeAccountForToken(tokenBySymbol("USDC")),
    prioritization: "fast",
  });

  return (
    <article className={`px-5 pt-5 pb-16 ${embedded ? "" : "mx-auto max-w-3xl"}`}>
      {embedded ? (
        <button className="mb-3 h-11 text-sm text-muted" onClick={() => setMore("root")}>
          Back
        </button>
      ) : (
        <p className="font-mono text-xs tracking-widest text-accent uppercase">Flight manual</p>
      )}
      <h1 className="text-4xl font-semibold tracking-tight text-balance">SolPortal, built as a wallet that can actually charge.</h1>
      <p className="mt-4 text-base leading-relaxed text-pretty text-muted">
        Non-custodial Solana wallet. The phone holds the keys. Jupiter collects the swap fee. Explore sells attention. The sandbox on the left is the MVP surface — it does not broadcast.
      </p>

      <section className="mt-8">
        <SectionLabel>Architecture</SectionLabel>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card
            title="Wallet core"
            body="Seed (BIP39 + SLIP-0010) or a passkey-wrapped embedded key. Encrypted keystore in the secure enclave / StrongBox. UI only sees the public key and a signing handle."
          />
          <Card
            title="RPC and DAS"
            body="Helius (or Triton) for balances, Token-2022 extensions, NFTs, and enhanced history. One websocket per wallet. Index webhooks so Explore and the portfolio are not RPC-polling the client."
          />
          <Card
            title="dApp browser"
            body="WKWebView / Android WebView, or a desktop iframe. Sandbox without wallet globals except the shim. Wallet Standard plus Mobile Wallet Adapter for apps that already speak it."
          />
          <Card
            title="Treasury"
            body="A hot operations wallet owns fee token accounts for WSOL, USDC, and PYUSD. Swaps pay them inside the Jupiter transaction. A watcher sweeps to cold storage."
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionLabel>Fee path</SectionLabel>
        <ol className="mt-3 space-y-3 text-sm leading-relaxed">
          <li className="rounded-card border border-line bg-surface px-4 py-3">
            <span className="text-accent">1.</span> Quote with <code className="font-mono text-accent">platformFeeBps={PLATFORM_FEE_BPS}</code>. Prefer a stable or SOL fee mint so the treasury does not fill up with junk.
          </li>
          <li className="rounded-card border border-line bg-surface px-4 py-3">
            <span className="text-accent">2.</span> Build the swap on the server. Pass <code className="font-mono text-accent">feeAccount</code>. Jupiter transfers the fee inside the same transaction the user signs.
          </li>
          <li className="rounded-card border border-line bg-surface px-4 py-3">
            <span className="text-accent">3.</span> Client simulates, shows the fee line, signs locally, and submits. No second transfer, so the fee cannot be skipped.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          This sandbox session has booked {revenue.swapFeesUsd.toFixed(2)} USD in swap fees, {revenue.stakeRevUsd.toFixed(2)} in staking rebate, and {revenue.onrampRevUsd.toFixed(2)} in on-ramp affiliate. Illustrative, not settled.
        </p>
      </section>

      <section className="mt-8">
        <SectionLabel>What you can charge</SectionLabel>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line">
          {RATE_CARD.map((row) => (
            <li key={row.name} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">{row.name}</span>
                <span className="text-muted">{row.term}</span>
              </span>
              <span className="shrink-0 font-mono text-xs text-accent">{row.price}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">Sample rate card for planning. Not a quote from Jupiter, MoonPay, or any LST.</p>
      </section>

      <section className="mt-8">
        <SectionLabel>Roadmap</SectionLabel>
        <ol className="mt-3 space-y-4">
          {PHASES.map((phase, index) => (
            <li key={phase.name} className="flex gap-3">
              <span className="font-mono text-sm text-accent">0{index + 1}</span>
              <span>
                <span className="block font-medium">
                  {phase.name} <span className="font-normal text-muted">· {phase.when}</span>
                </span>
                <span className="mt-1 block text-sm text-pretty text-muted">{phase.items}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <SectionLabel>Requests the shim exposes</SectionLabel>
        <p className="mt-2 font-mono text-xs leading-relaxed break-all text-muted">{VELA_PROVIDER_METHODS.join(" · ")}</p>
        <div className="mt-4 flex gap-2">
          {(
            [
              ["quote", "Quote"],
              ["swap", "Swap"],
              ["bridge", "Bridge"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setCode(id)}
              className={`h-9 rounded-full border px-3 text-sm ${code === id ? "border-accent bg-accent text-on-accent" : "border-line text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <pre className="mt-3 max-h-80 overflow-auto rounded-card border border-line bg-bg p-4 font-mono text-xs leading-relaxed text-fg">
          {code === "quote" ? sampleQuoteUrl() : code === "swap" ? JSON.stringify(swapPreview, null, 2) : PROVIDER_BRIDGE_EXAMPLE}
        </pre>
      </section>

      <section className="mt-8">
        <SectionLabel>Security and compliance</SectionLabel>
        <ul className="mt-3 space-y-3">
          {CHECKS.map((item) => (
            <li key={item.title} className="rounded-card border border-line px-4 py-3">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-pretty text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{body}</p>
    </div>
  );
}
