import { useMemo, useState } from "react";
import { feeWalletAddress } from "@/lib/vela/fee-wallet";
import { formatAmt, formatUsd } from "@/lib/vela/format";
import { type TxIntent } from "@/lib/vela/provider";
import {
  lstOutForSol,
  nativeStakeStatus,
  solOutForLst,
  yearlyRewards,
  type LstStakeOption,
  type NativeStakePosition,
} from "@/lib/vela/stake";
import { priorityFeeSol, useVela } from "@/lib/vela/store";
import { useMarket } from "@/lib/vela/use-market";
import { useStakeMarket, useWatchedStake } from "@/lib/vela/use-stake";
import { PrimaryButton, SectionLabel, TokenMark } from "@/components/vela/ui";

type Mode = "lst-stake" | "lst-unstake" | "native-stake";

export function StakeView() {
  const wallet = useVela((state) => state.wallet);
  const watchAddress = useVela((state) => state.watchAddress);
  const holdings = useVela((state) => state.holdings);
  const nativeStakes = useVela((state) => state.nativeStakes);
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const market = useStakeMarket();
  const tokenMarket = useMarket();
  const watched = useWatchedStake(watchAddress);
  const [mode, setMode] = useState<Mode>("lst-stake");
  const [lstSymbol, setLstSymbol] = useState(market.lsts[0]?.symbol ?? "JitoSOL");
  const [vote, setVote] = useState<string | null>(null);
  const [amount, setAmount] = useState("1");

  const lst = market.lsts.find((item) => item.symbol === lstSymbol) ?? market.lsts[0];
  const validator = market.validators.find((item) => item.vote === vote) ?? market.validators[0] ?? null;
  const solPrice = tokenMarket.tokens.SOL?.priceUsd ?? null;
  const amountIn = Number(amount);
  const viewOnly = Boolean(watchAddress);
  const canAct = Boolean(wallet) && !viewOnly;

  const solPerToken = lst?.solPerToken ?? 0;
  const lstOut = lst && mode !== "native-stake" && mode === "lst-stake" ? lstOutForSol(amountIn, solPerToken) : 0;
  const solOut = lst && mode === "lst-unstake" ? solOutForLst(amountIn, solPerToken) : amountIn;
  const apy = mode === "native-stake" ? validator?.apyPct ?? null : lst?.apyPct ?? null;
  const rewards = yearlyRewards(mode === "lst-unstake" ? solOut : amountIn, apy, solPrice);

  const solBalance = holdings.SOL ?? 0;
  const lstBalance = lst ? (holdings[lst.symbol] ?? 0) : 0;
  const reason = !canAct
    ? watchAddress
      ? "View only"
      : "Create a sandbox wallet"
    : amountIn <= 0
      ? "Enter an amount"
      : mode === "lst-unstake"
        ? amountIn > lstBalance
          ? `Not enough ${lst?.symbol ?? "LST"}`
          : null
        : amountIn > solBalance
          ? "Not enough SOL"
          : mode === "native-stake" && !validator
            ? "Pick a validator"
            : null;

  const epoch = market.epoch;

  function review() {
    if (!canAct || reason || !lst) return;
    const feeWallet = feeWalletAddress();
    const networkFeeSol = priorityFeeSol(priority);
    if (mode === "native-stake" && validator) {
      const intent: TxIntent = {
        kind: "stake",
        origin: "https://solportal.wallet",
        site: "SolPortal Stake",
        verified: true,
        title: `Stake ${formatAmt(amountIn)} SOL natively`,
        from: "SOL",
        to: "native",
        amountIn,
        amountOut: amountIn,
        revUsd: 0,
        action: "stake",
        target: "native",
        vote: validator.vote,
        validatorName: validator.name,
        validatorImage: validator.image,
        activationEpoch: epoch?.epoch ?? 0,
        apyPct: validator.apyPct ?? undefined,
        feeWallet,
        networkFeeSol,
        effects: [{ symbol: "SOL", delta: -amountIn, usd: -(amountIn * (solPrice ?? 0)) }],
        authorities: [],
        warnings: simulatedWarnings(
          `This is a simulated native stake. In production, the position would activate after epoch ${(epoch?.epoch ?? 0) + 1}. Nothing is signed or broadcast.`,
          feeWallet,
        ),
      };
      setSheet({ kind: "sign", intent });
      return;
    }
    if (mode === "lst-unstake" && lst) {
      const intent: TxIntent = {
        kind: "stake",
        origin: "https://solportal.wallet",
        site: "SolPortal Stake",
        verified: true,
        title: `Unstake ${formatAmt(amountIn)} ${lst.symbol}`,
        from: lst.symbol,
        to: "SOL",
        amountIn,
        amountOut: solOut,
        revUsd: 0,
        action: "unstake",
        target: "lst",
        apyPct: lst.apyPct ?? undefined,
        feeWallet,
        networkFeeSol,
        effects: [
          { symbol: lst.symbol, delta: -amountIn, usd: -(amountIn * (lst.priceUsd ?? 0)) },
          { symbol: "SOL", delta: solOut, usd: solOut * (solPrice ?? 0) },
        ],
        authorities: [],
        warnings: simulatedWarnings(
          "Simulated instant unstake. A real LST unstake may take an epoch or go through a liquidity pool. Nothing is collected or broadcast.",
          feeWallet,
        ),
      };
      setSheet({ kind: "sign", intent });
      return;
    }
    if (!lst) return;
    const monthRev = rewards?.usd ? (rewards.usd * 0.1) / 12 : 0;
    const intent: TxIntent = {
      kind: "stake",
      origin: "https://solportal.wallet",
      site: "SolPortal Stake",
      verified: true,
      title: `Stake ${formatAmt(amountIn)} SOL to ${lst.symbol}`,
      from: "SOL",
      to: lst.symbol,
      amountIn,
      amountOut: lstOut,
      revUsd: monthRev,
      action: "stake",
      target: "lst",
      apyPct: lst.apyPct ?? undefined,
      feeWallet,
      networkFeeSol,
      effects: [
        { symbol: "SOL", delta: -amountIn, usd: -(amountIn * (solPrice ?? 0)) },
        { symbol: lst.symbol, delta: lstOut, usd: lstOut * (lst.priceUsd ?? 0) },
      ],
      authorities: [],
      warnings: simulatedWarnings(
        `Live rate is ${solPerToken.toFixed(4)} SOL per ${lst.symbol}. Estimated yearly rewards ${rewards ? `${formatAmt(rewards.sol, 4)} SOL` : "—"}${rewards?.usd != null ? ` (${formatUsd(rewards.usd)})` : ""}. A 10% illustrative rebate, if collected, would go to the fee wallet — this sandbox does not collect it.`,
        feeWallet,
      ),
    };
    setSheet({ kind: "sign", intent });
  }

  function unstakeNative(position: NativeStakePosition) {
    if (!canAct) return;
    const feeWallet = feeWalletAddress();
    const intent: TxIntent = {
      kind: "stake",
      origin: "https://solportal.wallet",
      site: "SolPortal Stake",
      verified: true,
      title: `Unstake ${formatAmt(position.amountSol)} SOL`,
      from: "native",
      to: "SOL",
      amountIn: position.amountSol,
      amountOut: position.amountSol,
      revUsd: 0,
      action: "unstake",
      target: "native",
      vote: position.vote,
      validatorName: position.name,
      positionId: position.id,
      feeWallet,
      networkFeeSol: priorityFeeSol(priority),
      effects: [{ symbol: "SOL", delta: position.amountSol, usd: position.amountSol * (solPrice ?? 0) }],
      authorities: [],
      warnings: simulatedWarnings(
        "Simulated unstake: the sandbox returns SOL immediately. On mainnet, native unstake stays deactivating until the next epoch.",
        feeWallet,
      ),
    };
    setSheet({ kind: "sign", intent });
  }

  const sandboxLstPositions = useMemo(
    () => market.lsts.filter((item) => (holdings[item.symbol] ?? 0) > 0.0000001),
    [holdings, market.lsts],
  );

  return (
    <div className="px-5 pt-4 pb-8">
      <p className="text-sm text-pretty text-muted">
        Live APYs and TVL come from public stake APIs. Every stake or unstake in this app is <span className="text-fg">simulated</span> — no keys, nothing broadcasts, nothing is collected.
      </p>
      {epoch ? (
        <p className="mt-2 font-mono text-xs text-muted">
          Epoch {epoch.epoch}
          {epoch.progressPct !== null ? ` · ${epoch.progressPct.toFixed(0)}% elapsed` : ""}
          {epoch.remainingSeconds !== null ? ` · ~${(epoch.remainingSeconds / 3600).toFixed(1)}h left` : ""}
          {market.live ? " · live" : " · fallback"}
        </p>
      ) : null}

      {viewOnly ? (
        <WatchedStakePanel address={watchAddress!} loading={watched.loading} error={watched.error} data={watched.data} />
      ) : (
        <SandboxPositions
          lsts={sandboxLstPositions}
          holdings={holdings}
          native={nativeStakes}
          epoch={epoch?.epoch ?? null}
          onUnstakeLst={(symbol) => {
            setMode("lst-unstake");
            setLstSymbol(symbol);
            setAmount(String(holdings[symbol] ?? 0));
          }}
          onUnstakeNative={unstakeNative}
        />
      )}

      <SectionLabel>Liquid staking</SectionLabel>
      <div className="mt-3 grid gap-2">
        {market.lsts.map((item) => (
          <button
            key={item.symbol}
            onClick={() => {
              setLstSymbol(item.symbol);
              setMode("lst-stake");
            }}
            className={`rounded-card border px-4 py-3 text-left ${lst?.symbol === item.symbol && mode !== "native-stake" ? "border-accent" : "border-line bg-surface"}`}
          >
            <div className="flex items-center gap-3">
              <TokenMark symbol={item.symbol} src={item.image} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.symbol}</span>
                  <span className="text-sm text-accent tabular-nums">{formatApy(item.apyPct)}</span>
                </div>
                <p className="truncate text-xs text-muted">
                  {item.protocol} · {formatTvl(item.tvlSol)}
                  {item.solPerToken ? ` · ${item.solPerToken.toFixed(3)} SOL` : ""}
                  {item.source === "live" ? " · live" : " · fallback APY"}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <SectionLabel>Native validators</SectionLabel>
      <p className="mt-2 text-xs text-muted">Top validators by active stake, with live commission and APY. Simulated only.</p>
      <div className="mt-3 grid gap-2">
        {market.validators.length === 0 ? (
          <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted">
            Validator list is unavailable right now. You can still try a liquid-staking simulation.
          </p>
        ) : (
          market.validators.map((item) => (
            <button
              key={item.vote}
              onClick={() => {
                setVote(item.vote);
                setMode("native-stake");
              }}
              className={`rounded-card border px-4 py-3 text-left ${validator?.vote === item.vote && mode === "native-stake" ? "border-accent" : "border-line bg-surface"}`}
            >
              <div className="flex items-center gap-3">
                <ValidatorMark name={item.name} src={item.image} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="text-sm text-accent tabular-nums">{formatApy(item.apyPct)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {item.commissionPct !== null ? `${item.commissionPct}% commission` : "Commission —"}
                    {item.activatedStakeSol ? ` · ${formatTvl(item.activatedStakeSol).replace(" TVL", "")} staked` : ""}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <ModeChip active={mode === "lst-stake"} onClick={() => setMode("lst-stake")}>
          Stake LST
        </ModeChip>
        <ModeChip active={mode === "lst-unstake"} onClick={() => setMode("lst-unstake")}>
          Unstake LST
        </ModeChip>
        <ModeChip active={mode === "native-stake"} onClick={() => setMode("native-stake")}>
          Native
        </ModeChip>
      </div>

      <label className="mt-4 block rounded-card border border-line bg-surface p-4">
        <span className="text-xs text-muted">
          {mode === "lst-unstake"
            ? `${lst?.symbol ?? "LST"} to unstake · balance ${formatAmt(lstBalance)}`
            : `SOL to stake · balance ${formatAmt(solBalance)}`}
        </span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
          className="mt-2 w-full bg-transparent text-3xl font-semibold tabular-nums outline-none"
        />
      </label>
      <dl className="mt-3 space-y-1 text-sm text-muted">
        {mode === "lst-stake" && lst ? (
          <div>You receive about {formatAmt(lstOut, 4)} {lst.symbol} (simulated).</div>
        ) : null}
        {mode === "lst-unstake" && lst ? <div>You receive about {formatAmt(solOut, 4)} SOL (simulated instant unstake).</div> : null}
        {mode === "native-stake" && validator ? (
          <div>
            Delegate to {validator.name} at {formatApy(validator.apyPct)}. Status starts as activating this epoch.
          </div>
        ) : null}
        {rewards ? (
          <div>
            Estimated yearly rewards: {formatAmt(rewards.sol, 4)} SOL
            {rewards.usd !== null ? ` · ${formatUsd(rewards.usd)}` : ""} at {formatApy(apy)}.
          </div>
        ) : null}
      </dl>
      <div className="mt-4">
        <PrimaryButton disabled={Boolean(reason)} onClick={review}>
          {reason ?? (mode === "lst-unstake" ? "Review unstake" : "Review simulated stake")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function simulatedWarnings(detail: string, _feeWallet: string): TxIntent["warnings"] {
  return [
    { level: "info", title: "Simulated — nothing broadcasts", detail },
    {
      level: "info",
      title: "Fee wallet (not collected here)",
      detail: `Fee goes to the SolPortal cold wallet. This sandbox never transfers fees.`,
    },
  ];
}

function SandboxPositions({
  lsts,
  holdings,
  native,
  epoch,
  onUnstakeLst,
  onUnstakeNative,
}: {
  lsts: LstStakeOption[];
  holdings: Record<string, number>;
  native: NativeStakePosition[];
  epoch: number | null;
  onUnstakeLst: (symbol: LstStakeOption["symbol"]) => void;
  onUnstakeNative: (position: NativeStakePosition) => void;
}) {
  if (lsts.length === 0 && native.length === 0) {
    return <p className="mt-4 mb-6 text-sm text-muted">No simulated stake positions yet.</p>;
  }
  return (
    <div className="mt-4 mb-6">
      <SectionLabel>Your positions</SectionLabel>
      <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
        {lsts.map((item) => (
          <li key={item.symbol} className="flex items-center gap-3 px-3 py-3">
            <TokenMark symbol={item.symbol} src={item.image} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.symbol}</p>
              <p className="text-xs text-muted">{formatAmt(holdings[item.symbol] ?? 0, 4)} · liquid</p>
            </div>
            <button className="text-xs text-accent" onClick={() => onUnstakeLst(item.symbol)}>
              Unstake
            </button>
          </li>
        ))}
        {native.map((item) => {
          const status = nativeStakeStatus(item.activationEpoch, item.deactivationEpoch, epoch);
          return (
            <li key={item.id} className="flex items-center gap-3 px-3 py-3">
              <ValidatorMark name={item.name} src={item.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {formatAmt(item.amountSol, 4)} SOL · {status}
                  {epoch !== null ? ` · epoch ${item.activationEpoch}` : ""}
                </p>
              </div>
              <button className="text-xs text-accent" onClick={() => onUnstakeNative(item)}>
                Unstake
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WatchedStakePanel({
  address,
  loading,
  error,
  data,
}: {
  address: string;
  loading: boolean;
  error: string | null;
  data: ReturnType<typeof useWatchedStake>["data"];
}) {
  return (
    <div className="mt-4 mb-6">
      <SectionLabel>Watched staking</SectionLabel>
      <p className="mt-2 text-xs text-pretty text-muted">
        Read-only positions for {address.slice(0, 4)}…{address.slice(-4)}. Send and stake stay in the sandbox wallet.
      </p>
      {loading ? <p className="mt-3 text-sm text-muted">Loading live stake accounts…</p> : null}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {data ? (
        <>
          <p className="mt-3 text-sm">
            Total staked {data.totalStakeSol !== null ? `${formatAmt(data.totalStakeSol, 2)} SOL` : "—"}
            {data.totalStakeUsd !== null ? ` · ${formatUsd(data.totalStakeUsd)}` : ""}
          </p>
          <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
            {data.lsts.filter((item) => item.amount > 0).length === 0 && data.native.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted">No LST or native stake found for this address.</li>
            ) : null}
            {data.lsts
              .filter((item) => item.amount > 0)
              .map((item) => (
                <li key={item.symbol} className="flex items-center gap-3 px-3 py-3">
                  <TokenMark symbol={item.symbol} src={item.image} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.symbol}</p>
                    <p className="text-xs text-muted">
                      {formatAmt(item.amount, 4)} · liquid
                      {item.valueUsd !== null ? ` · ${formatUsd(item.valueUsd)}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            {data.native.map((item) => (
              <li key={item.pubkey} className="flex items-center gap-3 px-3 py-3">
                <ValidatorMark name={item.validatorName ?? "Validator"} src={item.validatorImage} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.validatorName ?? item.vote ?? "Stake account"}</p>
                  <p className="text-xs text-muted">
                    {formatAmt(item.amountSol, 4)} SOL · {item.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function ValidatorMark({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2">
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-xs text-accent">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function ModeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      className={`h-9 rounded-full border px-3 text-xs ${active ? "border-accent text-fg" : "border-line text-muted"}`}
    >
      {children}
    </button>
  );
}

function formatApy(apy: number | null | undefined): string {
  if (apy === null || apy === undefined) return "APY —";
  return `${apy.toFixed(2)}% APY`;
}

function formatTvl(sol: number | null): string {
  if (sol === null) return "TVL unavailable";
  if (sol >= 1_000_000) return `${(sol / 1_000_000).toFixed(2)}M SOL TVL`;
  if (sol >= 1_000) return `${(sol / 1_000).toFixed(1)}K SOL TVL`;
  return `${formatAmt(sol, 0)} SOL TVL`;
}

