import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeftRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  Copy,
  CreditCard,
  Eye,
  Gauge,
  GraduationCap,
  History,
  Images,
  Info,
  KeyRound,
  Layers,
  LifeBuoy,
  Link2,
  MessageCircle,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import { formatAmt, formatUsd, shortAddr } from "@/lib/vela/format";
import { type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela, type Priority } from "@/lib/vela/store";
import { resolveCardSkin } from "@/lib/vela/card-skins";
import { holdingsUsd, tokenBySymbol, tokenLookup } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { ActivityView } from "@/components/vela/activity-view";
import { Blueprint } from "@/components/vela/blueprint";
import { LearnGuide } from "@/components/vela/explore-learn";
import { IconTile, PageBar, SettingsGroup, SettingsRow, type Tone } from "@/components/vela/more-ui";
import { AccountAvatar } from "@/components/vela/wallets-sheet";
import { GhostButton, Mark, Overlay, PrimaryButton, SectionLabel } from "@/components/vela/ui";
import { Collectibles } from "@/components/vela/home";
import { StakeView } from "@/components/vela/stake-view";
import { SupportChat } from "@/components/vela/support-chat";
import { WatchAddressForm } from "@/components/vela/watch-address";
import type { NftHolding } from "@/lib/vela/helius-parse";

const PARTNERS = ["MoonPay", "Transak", "Stripe"] as const;

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const APP_VERSION = "0.1 sandbox";
const PRIORITY_LABEL: Record<Priority, string> = { low: "Standard", fast: "Fast", protect: "Protected" };
const LST_SYMBOLS = ["JitoSOL", "mSOL", "bSOL", "INF"] as const;

export function MoreView() {
  const more = useVela((state) => state.more);

  if (more === "activity") return <ActivityPage />;
  if (more === "stake") return <StakePage />;
  if (more === "watch") return <WatchWalletPage />;
  if (more === "collectibles") return <CollectiblesPage />;
  if (more === "buy") return <BuyPage />;
  if (more === "sites") return <SitesPage />;
  if (more === "pro") return <ProPage />;
  if (more === "security") return <SecurityPage />;
  if (more === "blueprint") return <BlueprintPage />;
  if (more === "support") return <SupportPage />;
  if (more === "revenue") return <RevenuePage />;
  return <MoreRoot />;
}

function MoreRoot() {
  const setMore = useVela((state) => state.setMore);
  const setSheet = useVela((state) => state.setSheet);
  const wallet = useVela((state) => state.wallet);
  const revenue = useVela((state) => state.revenue);
  const pro = useVela((state) => state.pro);
  const priority = useVela((state) => state.priority);
  const resetWallet = useVela((state) => state.resetWallet);
  const cardSkinName = useVela((state) => resolveCardSkin(state.cardSkins, state.activeAccountId).name);
  const watchAddress = useVela((state) => state.watchAddress);
  const accounts = useVela((state) => state.accounts);
  const activity = useVela((state) => state.activity);
  const connected = useVela((state) => state.connected);
  const nfts = useVela((state) => state.nfts);
  const holdings = useVela((state) => state.holdings);
  const nativeStakes = useVela((state) => state.nativeStakes);
  const activeAccount = useVela((state) => state.accounts.find((account) => account.id === state.activeAccountId) ?? null);
  const market = useMarket();
  const [learn, setLearn] = useState(false);
  const [about, setAbout] = useState(false);

  const watching = activeAccount?.kind === "watch" || (!activeAccount && Boolean(watchAddress));
  const stakedUsd = useMemo(() => {
    if (watching) return 0;
    const price = (symbol: string) => market.tokens[symbol]?.priceUsd ?? tokenLookup(symbol)?.priceUsd ?? 0;
    const native = nativeStakes.reduce((sum, item) => sum + item.amountSol, 0) * price("SOL");
    const lst = LST_SYMBOLS.reduce((sum, symbol) => sum + (holdings[symbol] ?? 0) * price(symbol), 0);
    return native + lst;
  }, [holdings, market.tokens, nativeStakes, watching]);
  const revenueTotal = revenue.swapFeesUsd + revenue.stakeRevUsd + revenue.onrampRevUsd;

  const actions: Array<{ label: string; icon: IconType; tone: Tone; run: () => void }> = [
    { label: "Buy", icon: CreditCard, tone: "emerald", run: () => setMore("buy") },
    { label: "Stake", icon: Layers, tone: "sky", run: () => setMore("stake") },
    { label: "Collectibles", icon: Images, tone: "rose", run: () => setMore("collectibles") },
    { label: "Activity", icon: History, tone: "gold", run: () => setMore("activity") },
    { label: "Watch", icon: Eye, tone: "cyan", run: () => setMore("watch") },
    { label: "Sites", icon: Link2, tone: "blue", run: () => setMore("sites") },
    { label: "Support", icon: LifeBuoy, tone: "orange", run: () => setMore("support") },
    { label: "Learn", icon: GraduationCap, tone: "lime", run: () => setLearn(true) },
  ];

  return (
    <div className="pb-10">
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between bg-bg/85 px-5 backdrop-blur-md">
        <h1 className="text-xl font-semibold tracking-tight">More</h1>
        <span className="rounded-full border border-line px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">Sandbox</span>
      </div>

      <div className="px-4">
        <ProfileCard
          name={activeAccount?.name ?? (watching ? "Watched wallet" : "Main Wallet")}
          address={activeAccount?.address ?? watchAddress ?? wallet?.address ?? ""}
          kindLabel={watching ? null : wallet?.mode === "passkey" ? "Passkey wallet" : activeAccount?.kind === "imported" ? "Imported wallet" : "Seed wallet"}
          watching={watching}
          onSwitch={() => setSheet({ kind: "wallets" })}
        />

        <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-3 rounded-card border border-line/70 bg-surface/90 px-2 py-4">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.run}
              className="flex flex-col items-center gap-1.5 rounded-control py-1 transition-transform active:scale-95"
            >
              <IconTile icon={action.icon} tone={action.tone} size="lg" />
              <span className="text-xs font-medium text-fg/90">{action.label}</span>
            </button>
          ))}
        </div>

        <ProCard pro={pro} onOpen={() => setMore("pro")} />

        <SettingsGroup title="Wallet">
          <SettingsRow icon={History} tone="gold" title="Activity" subtitle="Swaps, dApps, fiat, stake, and burns" value={activity.length || undefined} onClick={() => setMore("activity")} />
          <SettingsRow icon={Images} tone="rose" title="Collectibles" subtitle={watching ? "NFTs in the watched wallet" : "NFTs for this wallet"} value={!watching && nfts.length ? nfts.length : undefined} onClick={() => setMore("collectibles")} />
          <SettingsRow icon={Link2} tone="blue" title="Connected sites" subtitle="Permissions granted in Explore" value={connected.length || "None"} onClick={() => setMore("sites")} />
          <SettingsRow icon={Eye} tone="cyan" title="Watch a wallet" subtitle={watchAddress ? `Watching ${shortAddr(watchAddress)}` : "Live holdings for any public address"} onClick={() => setMore("watch")} />
          <SettingsRow icon={WalletCards} tone="slate" title="Manage wallets" subtitle="Switch, add, rename, or remove" value={accounts.length || undefined} onClick={() => setSheet({ kind: "wallets" })} />
          <SettingsRow icon={Palette} tone="gold" title="Card style" subtitle="Artwork behind your Home balance" value={cardSkinName} onClick={() => setSheet({ kind: "card-skin" })} />
        </SettingsGroup>

        <SettingsGroup title="Earn & Buy">
          <SettingsRow icon={Layers} tone="sky" title="Stake" subtitle="Liquid or native SOL staking" value={stakedUsd > 0.005 ? formatUsd(stakedUsd) : undefined} onClick={() => setMore("stake")} />
          <SettingsRow icon={CreditCard} tone="emerald" title="Buy crypto" subtitle="Card via MoonPay, Transak, or Stripe" onClick={() => setMore("buy")} />
        </SettingsGroup>

        <SettingsGroup title="Security">
          <SettingsRow
            icon={KeyRound}
            tone="amber"
            title="Recovery & security"
            subtitle={wallet?.phrase ? "Recovery phrase, drainer preview" : "Passkey recovery, drainer preview"}
            onClick={() => setMore("security")}
          />
          <SettingsRow icon={Gauge} tone="teal" title="Network & priority fees" subtitle="Priority preset and custom RPC" value={PRIORITY_LABEL[priority]} onClick={() => setMore("pro")} />
        </SettingsGroup>

        <SettingsGroup title="Help">
          <SettingsRow icon={MessageCircle} tone="orange" title="Support chat" subtitle="Help bot and contact the team" onClick={() => setMore("support")} />
          <SettingsRow icon={GraduationCap} tone="lime" title="SolPortal guide" subtitle="Protect and grow your crypto" onClick={() => setLearn(true)} />
          <SettingsRow icon={BookOpen} tone="slate" title="Flight manual" subtitle="Architecture, fees, roadmap" onClick={() => setMore("blueprint")} />
          <SettingsRow icon={Info} tone="slate" title="About SolPortal" value={APP_VERSION} onClick={() => setAbout(true)} />
        </SettingsGroup>

        <SettingsGroup title="Owner">
          <SettingsRow icon={ChartNoAxesCombined} tone="gold" title="Revenue" subtitle="Swap, stake, and on-ramp fees" value={formatUsd(revenueTotal)} onClick={() => setMore("revenue")} />
        </SettingsGroup>

        <ul className="mt-6 overflow-hidden rounded-card border border-line/70 bg-surface/90">
          <SettingsRow icon={Trash2} tone="red" title="Erase sandbox wallet" danger chevron={false} onClick={resetWallet} />
        </ul>
        <p className="mt-4 text-center font-mono text-[10px] tracking-widest text-muted/70 uppercase">SolPortal · {APP_VERSION}</p>
      </div>

      {learn ? <LearnGuide onClose={() => setLearn(false)} /> : null}
      {about ? (
        <Overlay label="About SolPortal" onClose={() => setAbout(false)}>
          <div className="flex items-center gap-3">
            <Mark className="size-12" />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">SolPortal</h2>
              <p className="font-mono text-xs text-muted">Version {APP_VERSION}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-pretty text-muted">
            A non-custodial Solana wallet sandbox. Prices, quotes, and stake data are live; swaps, stakes, and signatures are simulated and nothing broadcasts.
          </p>
        </Overlay>
      ) : null}
    </div>
  );
}

function ProfileCard({
  name,
  address,
  kindLabel,
  watching,
  onSwitch,
}: {
  name: string;
  address: string;
  kindLabel: string | null;
  watching: boolean;
  onSwitch: () => void;
}) {
  const setToast = useVela((state) => state.setToast);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setToast("Address copied");
    } catch {
      setToast("Couldn't copy the address");
    }
  }

  return (
    <div
      className="relative mt-1 overflow-hidden rounded-card border border-[#e0b86a]/25 p-4"
      style={{ background: "linear-gradient(135deg, #1d1a14 0%, #15130f 55%, #262014 100%)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-12 size-48 rounded-full"
        style={{ background: "radial-gradient(circle, rgb(224 184 106 / 0.22) 0%, transparent 70%)" }}
      />
      <div className="relative flex items-center gap-3">
        <AccountAvatar name={name} active />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[17px] font-semibold">{name}</p>
            {watching ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                <Eye className="size-3" aria-hidden />
                Watch-only
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copy address"
            className="mt-0.5 inline-flex items-center gap-1.5 rounded-md font-mono text-xs text-muted active:text-fg"
          >
            {address ? shortAddr(address) : "No address"}
            {copied ? <Check className="size-3.5 text-emerald-300" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
            {copied ? <span className="font-sans text-emerald-300">Copied</span> : null}
          </button>
        </div>
        <button
          type="button"
          onClick={onSwitch}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#e0b86a]/40 bg-[#e0b86a]/10 px-3 text-sm font-medium text-[#e0b86a] active:bg-[#e0b86a]/20"
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
          Switch
        </button>
      </div>
      {kindLabel ? (
        <p className="relative mt-3 flex items-center gap-1.5 border-t border-white/5 pt-3 text-xs text-muted">
          <ShieldCheck className="size-3.5 text-[#e0b86a]" aria-hidden />
          {kindLabel} · keys stay on this device
        </p>
      ) : (
        <p className="relative mt-3 border-t border-white/5 pt-3 text-xs text-muted">View balances only. This app can't sign or send from a watched wallet.</p>
      )}
    </div>
  );
}

function ProCard({ pro, onOpen }: { pro: boolean; onOpen: () => void }) {
  const perks = ["Protected priority fees", "Custom RPC endpoint", "30-day P&L chart"];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="pro-shimmer relative mt-4 block w-full overflow-hidden rounded-card border border-[#e0b86a]/40 p-4 text-left"
      style={{ background: "linear-gradient(125deg, #3a2c12 0%, #1c160c 42%, #4b3816 78%, #6b5020 100%)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -bottom-14 size-44 rounded-full"
        style={{ background: "radial-gradient(circle, rgb(240 207 138 / 0.4) 0%, transparent 68%)" }}
      />
      <span className="relative flex items-start justify-between gap-3">
        <span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-[#f0cf8a] uppercase">
            <Sparkles className="size-3.5" aria-hidden />
            SolPortal Pro
          </span>
          <span className="mt-1 block text-lg leading-tight font-semibold">{pro ? "Pro is active" : "Trade like a pro"}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg leading-tight font-semibold text-[#f0cf8a]">$9</span>
          <span className="block text-[10px] text-fg/60">/ month · illustrative</span>
        </span>
      </span>
      <ul className="relative mt-3 space-y-1.5">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2 text-sm text-fg/85">
            <Check className="size-3.5 text-[#f0cf8a]" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>
      <span className="relative mt-4 inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-r from-[#f0cf8a] to-[#c99a4a] px-5 text-sm font-semibold text-on-accent">
        {pro ? "Manage Pro" : "See Pro"}
      </span>
      {pro ? <span className="relative mt-2 block text-[11px] text-fg/55">Active in this sandbox</span> : null}
    </button>
  );
}

function SubPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <PageBar title={title} />
      <div className="px-5 pt-4 pb-8">{children}</div>
    </div>
  );
}

function ActivityPage() {
  return (
    <div>
      <PageBar title="Activity" />
      <ActivityView hideTitle />
    </div>
  );
}

function StakePage() {
  return (
    <div>
      <PageBar title="Stake" />
      <StakeView />
    </div>
  );
}

function BlueprintPage() {
  return (
    <div>
      <PageBar title="Flight manual" />
      <Blueprint embedded />
    </div>
  );
}

function SupportPage() {
  return (
    <SubPage title="Support">
      <SupportChat />
    </SubPage>
  );
}

function RevenuePage() {
  const revenue = useVela((state) => state.revenue);
  const total = revenue.swapFeesUsd + revenue.stakeRevUsd + revenue.onrampRevUsd;
  const stats: Array<{ label: string; detail: string; value: number; icon: IconType; tone: Tone }> = [
    { label: "Swap fees", detail: "Platform fee on swaps", value: revenue.swapFeesUsd, icon: ArrowLeftRight, tone: "gold" },
    { label: "Stake", detail: "Liquid-staking rebates", value: revenue.stakeRevUsd, icon: Layers, tone: "sky" },
    { label: "On-ramp", detail: "Partner affiliate", value: revenue.onrampRevUsd, icon: CreditCard, tone: "emerald" },
  ];
  return (
    <SubPage title="Revenue">
      <div
        className="rounded-card border border-[#e0b86a]/25 p-4"
        style={{ background: "linear-gradient(135deg, #1d1a14 0%, #15130f 60%, #262014 100%)" }}
      >
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Total recorded</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{formatUsd(total)}</p>
        <p className="mt-1 text-xs text-muted">Owner earnings this sandbox wallet has recorded. Simulated — nothing is collected.</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-card border border-line/70 bg-surface/90 p-3">
            <IconTile icon={stat.icon} tone={stat.tone} />
            <dt className="mt-3 text-xs text-muted">{stat.label}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold tabular-nums">{formatUsd(stat.value)}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 overflow-hidden rounded-card border border-line/70 bg-surface/90">
        {stats.map((stat) => (
          <li key={stat.label} className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3 text-sm last:border-b-0">
            <span className="text-muted">{stat.detail}</span>
            <span className="tabular-nums">{total > 0 ? `${((stat.value / total) * 100).toFixed(0)}%` : "—"}</span>
          </li>
        ))}
      </ul>
    </SubPage>
  );
}

function WatchWalletPage() {
  return (
    <SubPage title="Watch a wallet">
      <p className="mb-4 text-sm text-pretty text-muted">
        Paste any public Solana address to see live balances, logos, staking, and dust accounts. This app cannot sign or send from a watched wallet.
      </p>
      <WatchAddressForm compact />
    </SubPage>
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
    <SubPage title="Collectibles">
      <p className="mb-2 text-sm text-pretty text-muted">
        Collectibles used to live on Home. They moved here so Home can show the incinerator instead.
      </p>
      <Collectibles items={items} empty={loading ? "Loading collectibles…" : "No NFTs in this wallet."} />
    </SubPage>
  );
}

const SOL_MINT = "So11111111111111111111111111111111111111112";
const BUY_PRESETS = [20, 25, 50] as const;
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
    <SubPage title="Buy">
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
    </SubPage>
  );
}

function SitesPage() {
  const connected = useVela((state) => state.connected);
  const revokeSite = useVela((state) => state.revokeSite);
  return (
    <SubPage title="Connected sites">
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
    </SubPage>
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
    <SubPage title="SolPortal Pro">
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
    </SubPage>
  );
}

function SecurityPage() {
  const wallet = useVela((state) => state.wallet);
  const openDapp = useVela((state) => state.openDapp);
  const [reveal, setReveal] = useState(false);
  return (
    <SubPage title="Security">
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
    </SubPage>
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
