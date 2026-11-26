import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight } from "lucide-react";
import { formatAmt, formatUsd, shortAddr } from "@/lib/vela/format";
import { type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela, type MoreRoute, type Priority } from "@/lib/vela/store";
import { holdingsUsd, tokenBySymbol } from "@/lib/vela/tokens";
import { Blueprint } from "@/components/vela/blueprint";
import { GhostButton, PrimaryButton, SectionLabel } from "@/components/vela/ui";
import { Collectibles } from "@/components/vela/home";
import { StakeView } from "@/components/vela/stake-view";
import { SupportChat } from "@/components/vela/support-chat";
import { WatchAddressForm } from "@/components/vela/watch-address";
import type { NftHolding } from "@/lib/vela/helius-parse";

const PARTNERS = ["MoonPay", "Transak", "Stripe"] as const;

export function MoreView() {
  const more = useVela((state) => state.more);
  const setMore = useVela((state) => state.setMore);
  const wallet = useVela((state) => state.wallet);
  const revenue = useVela((state) => state.revenue);
  const pro = useVela((state) => state.pro);
  const resetWallet = useVela((state) => state.resetWallet);
  const watchAddress = useVela((state) => state.watchAddress);

  if (more === "stake") return <StakeView />;
  if (more === "watch") return <WatchWalletPage />;
  if (more === "collectibles") return <CollectiblesPage />;
  if (more === "buy") return <BuyPage />;
  if (more === "sites") return <SitesPage />;
  if (more === "pro") return <ProPage />;
  if (more === "security") return <SecurityPage />;
  if (more === "blueprint") return <Blueprint embedded />;
  if (more === "support") return <SupportPage />;

  const rows: Array<{ id: MoreRoute; title: string; detail: string }> = [
    { id: "stake", title: "Stake", detail: "SOL into JitoSOL, mSOL, or bSOL" },
    { id: "watch", title: "Watch a wallet", detail: watchAddress ? `Watching ${shortAddr(watchAddress)}` : "Live holdings for any public address" },
    { id: "collectibles", title: "Collectibles", detail: "NFTs for this wallet" },
    { id: "buy", title: "Buy", detail: "Fiat on-ramp affiliate" },
    { id: "sites", title: "Connected sites", detail: "Permissions granted in Explore" },
    { id: "pro", title: "SolPortal Pro", detail: pro ? "Active in this sandbox" : "$9 / month · illustrative" },
    { id: "security", title: "Security", detail: "Phrase, drainer preview, checklist" },
    { id: "support", title: "Support", detail: "Help bot and contact the team" },
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

function SupportPage() {
  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Support" />
      <SupportChat />
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

function WatchWalletPage() {
  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Watch a wallet" />
      <p className="mb-4 text-sm text-pretty text-muted">
        Paste any public Solana address to see live balances, logos, staking, and dust accounts. This app cannot sign or send from a watched wallet.
      </p>
      <WatchAddressForm compact />
    </div>
  );
}

function CollectiblesPage() {
  const nfts = useVela((state) => state.nfts);
  const watchAddress = useVela((state) => state.watchAddress);
  const [watched, setWatched] = useState<NftHolding[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!watchAddress) {
      setWatched(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/wallet?address=${encodeURIComponent(watchAddress)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = (await res.json()) as { nfts?: NftHolding[] };
        if (!res.ok) throw new Error("failed");
        return body.nfts ?? [];
      })
      .then((items) => {
        if (!controller.signal.aborted) setWatched(items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setWatched([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [watchAddress]);

  const items = watchAddress
    ? (watched ?? []).map((nft) => ({ ...nft, pattern: undefined }))
    : nfts.map((nft) => ({
        id: nft.id,
        name: nft.name,
        collection: nft.collection,
        image: nft.image ?? null,
        pattern: nft.pattern,
      }));

  return (
    <div className="px-5 pt-5 pb-8">
      <Back title="Collectibles" />
      <p className="mb-2 text-sm text-pretty text-muted">
        Collectibles used to live on Home. They moved here so Home can show the incinerator instead.
      </p>
      <Collectibles items={items} empty={loading ? "Loading collectibles…" : "No NFTs in this wallet."} />
    </div>
  );
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const BUY_PRESETS = [10, 25, 50] as const;
/** MoonPay: $20 minimum (moonpay.com/buy/sol); per-purchase max depends on the buyer's verification level. */
const PARTNER_LIMITS: Record<(typeof PARTNERS)[number], { min: number; max: number } | null> = {
  MoonPay: { min: 20, max: 30_000 },
  Transak: null,
  Stripe: null,
};

function useLiveSolPrice(): { price: number; live: boolean; updatedAt: number | null } {
  const fallback = tokenBySymbol("SOL").priceUsd;
  const [state, setState] = useState<{ price: number; live: boolean; updatedAt: number | null }>({
    price: fallback,
    live: false,
    updatedAt: null,
  });
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/price?mint=${SOL_MINT}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { priceUsd: number | null };
        if (!stopped && body.priceUsd) setState({ price: body.priceUsd, live: true, updatedAt: Date.now() });
      } catch {
        /* keep last price */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);
  return state;
}

function BuyPage() {
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const [preset, setPreset] = useState<number | "other">(25);
  const [custom, setCustom] = useState("");
  const [partner, setPartner] = useState<(typeof PARTNERS)[number]>("MoonPay");
  const sol = useLiveSolPrice();
  const usd = preset === "other" ? Number(custom.replace(/[^0-9.]/g, "")) || 0 : preset;
  const limits = PARTNER_LIMITS[partner];
  const spread = 0.015;
  const out = usd > 0 ? (usd * (1 - spread)) / sol.price : 0;
  const commission = usd * 0.01;
  const problem =
    usd <= 0
      ? "Enter an amount."
      : limits && usd < limits.min
        ? `${partner}'s minimum is ${formatUsd(limits.min)}.`
        : limits && usd > limits.max
          ? `${partner}'s maximum is ${formatUsd(limits.max)} per purchase.`
          : null;

  function review() {
    if (problem) return;
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
      <div className="mt-4 flex items-center justify-between rounded-control border border-line bg-surface px-3 py-2">
        <span className="text-sm text-muted">SOL price</span>
        <span className="flex items-center gap-2 font-mono text-sm tabular-nums">
          <span className={`size-2 rounded-full ${sol.live ? "animate-pulse bg-emerald-400" : "bg-muted"}`} />
          {formatUsd(sol.price)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {BUY_PRESETS.map((value) => (
          <button
            key={value}
            onClick={() => setPreset(value)}
            className={`h-11 rounded-control border text-sm ${preset === value ? "border-accent bg-accent text-on-accent" : "border-line"}`}
          >
            ${value}
          </button>
        ))}
        <button
          onClick={() => setPreset("other")}
          className={`h-11 rounded-control border text-sm ${preset === "other" ? "border-accent bg-accent text-on-accent" : "border-line"}`}
        >
          Other
        </button>
      </div>
      {preset === "other" ? (
        <label className="mt-2 flex h-12 items-center gap-1 rounded-control border border-accent bg-bg px-3">
          <span className="text-muted">$</span>
          <input
            autoFocus
            inputMode="decimal"
            value={custom}
            onChange={(event) => setCustom(event.target.value.replace(/[^0-9.]/g, "").slice(0, 9))}
            placeholder="Enter amount"
            className="min-w-0 flex-1 bg-transparent text-lg tabular-nums outline-none"
          />
          <span className="text-xs text-muted">USD</span>
        </label>
      ) : null}
      <p className="mt-2 text-xs text-muted">
        {limits
          ? `${partner} limits: ${formatUsd(limits.min)} minimum, up to ${formatUsd(limits.max)} per purchase depending on your ${partner} verification level.`
          : `Limits are set by ${partner} at checkout.`}
      </p>
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
      {problem ? (
        <p className="mt-4 text-sm text-danger">{problem}</p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          You receive about {formatAmt(out, 4)} SOL after the partner spread. Affiliate {formatUsd(commission)}.
        </p>
      )}
      <div className="mt-4">
        <PrimaryButton disabled={Boolean(problem)} onClick={review}>
          Review purchase
        </PrimaryButton>
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
