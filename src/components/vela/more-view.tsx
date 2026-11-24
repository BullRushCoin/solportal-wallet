import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { formatAmt, formatUsd } from "@/lib/vela/format";
import { type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela, type MoreRoute, type Priority } from "@/lib/vela/store";
import { holdingsUsd, tokenBySymbol } from "@/lib/vela/tokens";
import { Blueprint } from "@/components/vela/blueprint";
import { feeWalletAddress } from "@/lib/vela/fee-wallet";
import { GhostButton, PrimaryButton, SectionLabel } from "@/components/vela/ui";
import { StakeView } from "@/components/vela/stake-view";

const PARTNERS = ["MoonPay", "Transak", "Stripe"] as const;

export function MoreView() {
  const more = useVela((state) => state.more);
  const setMore = useVela((state) => state.setMore);
  const wallet = useVela((state) => state.wallet);
  const revenue = useVela((state) => state.revenue);
  const pro = useVela((state) => state.pro);
  const resetWallet = useVela((state) => state.resetWallet);

  if (more === "stake") return <StakeView />;
  if (more === "buy") return <BuyPage />;
  if (more === "sites") return <SitesPage />;
  if (more === "pro") return <ProPage />;
  if (more === "security") return <SecurityPage />;
  if (more === "blueprint") return <Blueprint embedded />;

  const rows: Array<{ id: MoreRoute; title: string; detail: string }> = [
    { id: "stake", title: "Stake", detail: "SOL into JitoSOL, mSOL, or bSOL" },
    { id: "buy", title: "Buy", detail: "Fiat on-ramp affiliate" },
    { id: "sites", title: "Connected sites", detail: "Permissions granted in Explore" },
    { id: "pro", title: "SolPortal Pro", detail: pro ? "Active in this sandbox" : "$9 / month · illustrative" },
    { id: "security", title: "Security", detail: "Phrase, drainer preview, checklist" },
    { id: "blueprint", title: "Flight manual", detail: "Architecture, fees, roadmap" },
  ];

  return (
    <div className="px-5 pt-5 pb-8">
      <SectionLabel>{wallet?.mode === "passkey" ? "Passkey wallet" : "Seed wallet"}</SectionLabel>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">More</h1>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Swap fees" value={formatUsd(revenue.swapFeesUsd)} />
        <Stat label="Stake" value={formatUsd(revenue.stakeRevUsd)} />
        <Stat label="On-ramp" value={formatUsd(revenue.onrampRevUsd)} />
      </dl>
      <ul className="mt-5 divide-y divide-line rounded-card border border-line bg-surface">
        {rows.map((row) => (
          <li key={row.id}>
            <button className="flex w-full items-center gap-3 px-4 py-4 text-left" onClick={() => setMore(row.id)}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{row.title}</span>
                <span className="block text-xs text-muted">{row.detail}</span>
              </span>
              <ChevronRight className="size-4 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-card border border-line bg-surface p-4">
        <p className="font-medium">Fee wallet</p>
        <p className="mt-1 font-mono text-xs break-all text-muted">{feeWalletAddress()}</p>
        <p className="mt-2 text-xs text-pretty text-muted">
          Public fee-collection address. Watch it to see its real balance. This sandbox never sends it fees.
        </p>
        <button
          className="mt-3 text-sm text-accent"
          onClick={() => {
            useVela.getState().setWatchAddress(feeWalletAddress());
          }}
        >
          Watch fee wallet
        </button>
      </div>
      <div className="mt-6">
        <GhostButton onClick={resetWallet}>Erase sandbox wallet</GhostButton>
      </div>
    </div>
  );
}

function Back({ title }: { title: string }) {
  const setMore = useVela((state) => state.setMore);
  return (
    <div className="mb-4 flex items-center gap-2">
      <button className="h-11 px-1 text-sm text-muted" onClick={() => setMore("root")}>
        Back
      </button>
      <h1 className="text-2xl font-semibold">{title}</h1>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line bg-surface px-2 py-3">
      <p className="font-mono text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function BuyPage() {
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const [usd, setUsd] = useState(100);
  const [partner, setPartner] = useState<(typeof PARTNERS)[number]>("MoonPay");
  const sol = tokenBySymbol("SOL");
  const spread = 0.015;
  const out = (usd * (1 - spread)) / sol.priceUsd;
  const commission = usd * 0.01;

  function review() {
    const intent: TxIntent = {
      kind: "buy",
      origin: "https://solportal.wallet",
      site: partner,
      verified: true,
      title: `Buy SOL with ${partner}`,
      usd,
      symbol: "SOL",
      amountOut: out,
      commissionUsd: commission,
      partner,
      networkFeeSol: priorityFeeSol(priority),
      effects: [{ symbol: "SOL", delta: out, usd }],
      authorities: [],
      warnings: [
        {
          level: "info",
          title: "Card fees stay with the partner",
          detail: `Illustrative ${partner} spread 1.5%. SolPortal affiliate is 1% (${formatUsd(commission)}), paid by the partner — not added on top.`,
        },
      ],
    };
    setSheet({ kind: "sign", intent });
  }

  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Buy" />
      <p className="text-sm text-pretty text-muted">
        On iOS the live purchase has to open outside the in-app purchase flow. Apple does not allow buying crypto with IAP.
      </p>
      <div className="mt-4 flex gap-2">
        {[50, 100, 250].map((value) => (
          <button
            key={value}
            onClick={() => setUsd(value)}
            className={`h-11 flex-1 rounded-control border text-sm ${usd === value ? "border-accent bg-accent text-on-accent" : "border-line"}`}
          >
            ${value}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {PARTNERS.map((name) => (
          <button
            key={name}
            onClick={() => setPartner(name)}
            className={`h-12 rounded-control border px-4 text-left text-sm ${partner === name ? "border-accent" : "border-line bg-surface"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        You receive about {formatAmt(out, 4)} SOL after the partner spread. Affiliate {formatUsd(commission)}.
      </p>
      <div className="mt-4">
        <PrimaryButton onClick={review}>Review purchase</PrimaryButton>
      </div>
    </div>
  );
}

function SitesPage() {
  const connected = useVela((state) => state.connected);
  const revokeSite = useVela((state) => state.revokeSite);
  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Sites" />
      {connected.length === 0 ? (
        <p className="text-sm text-muted">No dApp is connected. Open one from Explore and approve a request.</p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line">
          {connected.map((site) => (
            <li key={site.origin} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{site.name}</p>
                <p className="truncate font-mono text-xs text-muted">{site.origin}</p>
              </div>
              <button className="h-11 text-sm text-danger" onClick={() => revokeSite(site.origin)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProPage() {
  const pro = useVela((state) => state.pro);
  const setPro = useVela((state) => state.setPro);
  const priority = useVela((state) => state.priority);
  const setPriority = useVela((state) => state.setPriority);
  const customRpc = useVela((state) => state.customRpc);
  const setCustomRpc = useVela((state) => state.setCustomRpc);
  const holdings = useVela((state) => state.holdings);
  const equity = holdingsUsd(holdings);
  const series = useMemo(() => buildSeries(equity), [equity]);

  const options: Array<{ id: Priority; label: string; locked?: boolean }> = [
    { id: "low", label: "Standard" },
    { id: "fast", label: "Fast" },
    { id: "protect", label: "Protected", locked: !pro },
  ];

  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Pro" />
      <p className="text-sm text-pretty text-muted">
        Power-user preset. On the stores this is a subscription, so it has to go through Apple or Google billing — not a crypto checkout.
      </p>
      <div className={`mt-4 rounded-card border border-line bg-surface p-4 ${pro ? "" : "opacity-70"}`}>
        <SectionLabel>30-day sandbox P&L</SectionLabel>
        <div className="mt-3 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <XAxis dataKey="d" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                formatter={(value) => formatUsd(Number(value))}
                contentStyle={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  color: "var(--color-fg)",
                }}
              />
              <Area dataKey="v" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.18} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            disabled={option.locked}
            onClick={() => setPriority(option.id)}
            className={`h-12 rounded-control border text-sm disabled:opacity-40 ${
              priority === option.id ? "border-accent bg-accent text-on-accent" : "border-line"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm">
        <span className="text-muted">Custom RPC</span>
        <input
          disabled={!pro}
          value={customRpc}
          onChange={(event) => setCustomRpc(event.target.value)}
          className="mt-2 h-12 w-full rounded-control border border-line bg-bg px-3 font-mono text-xs outline-none disabled:opacity-40"
        />
      </label>
      <div className="mt-4">
        <PrimaryButton onClick={() => setPro(!pro)}>{pro ? "Cancel Pro in sandbox" : "Start Pro · $9 / month"}</PrimaryButton>
      </div>
    </div>
  );
}

function SecurityPage() {
  const wallet = useVela((state) => state.wallet);
  const openDapp = useVela((state) => state.openDapp);
  const [reveal, setReveal] = useState(false);
  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Security" />
      <div className="rounded-card border border-danger/40 bg-surface p-4">
        <SectionLabel>Recovery</SectionLabel>
        {wallet?.phrase ? (
          <>
            <p className="mt-2 text-sm text-pretty text-muted">
              Stored in local storage for the demo reveal. Production encrypts this with a passcode or a passkey PRF and never sends it to a server.
            </p>
            <button className="mt-3 text-sm text-accent" onClick={() => setReveal((value) => !value)}>
              {reveal ? "Hide phrase" : "Reveal sandbox phrase"}
            </button>
            {reveal ? (
              <ol className="mt-3 grid grid-cols-2 gap-2">
                {wallet.phrase.map((word, index) => (
                  <li key={`${word}-${index}`} className="rounded-control border border-line px-2 py-2 text-sm">
                    <span className="mr-2 font-mono text-xs text-muted">{index + 1}</span>
                    {word}
                  </li>
                ))}
              </ol>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">This passkey wallet has no phrase. A lost device needs the second-device unwrap you set up in production.</p>
        )}
      </div>
      <div className="mt-4">
        <GhostButton onClick={() => openDapp("drainer", "gate")}>Open a simulated drainer</GhostButton>
        <p className="mt-2 text-xs text-pretty text-muted">
          sol-rewards.gift is not in the directory. The signer should scream before you can approve it.
        </p>
      </div>
    </div>
  );
}

function buildSeries(equity: number) {
  let x = 17;
  let v = 100;
  const raw: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    x = (x * 48271) % 2147483647;
    v *= 1 + ((x % 100) - 46) / 1400;
    raw.push(v);
  }
  const last = raw[raw.length - 1] || 1;
  const scale = equity > 0 ? equity / last : 1;
  return raw.map((point, index) => ({ d: String(index + 1), v: point * scale }));
}
