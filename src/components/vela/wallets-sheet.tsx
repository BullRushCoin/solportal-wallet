import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, Eye, KeyRound, MoreVertical, Plus, Sparkles } from "lucide-react";
import { isSolanaAddress } from "@/lib/vela/address";
import { generatePhrase, parseSandboxPhrase } from "@/lib/vela/crypto";
import { formatUsd, shortAddr } from "@/lib/vela/format";
import { useVela, type Account } from "@/lib/vela/store";
import { holdingsUsd } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";
import { GhostButton, Overlay, PrimaryButton } from "@/components/vela/ui";

const watchValueCache = new Map<string, { at: number; value: number | null }>();
const WATCH_TTL_MS = 60_000;

function useWatchValue(address: string | null): number | null | undefined {
  const [value, setValue] = useState<number | null | undefined>(() =>
    address ? watchValueCache.get(address)?.value : undefined,
  );
  useEffect(() => {
    if (!address) return;
    const hit = watchValueCache.get(address);
    if (hit && Date.now() - hit.at < WATCH_TTL_MS) {
      setValue(hit.value);
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/wallet?address=${encodeURIComponent(address)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ totalUsd: number | null }>) : { totalUsd: null }))
      .then((body) => {
        const next = typeof body.totalUsd === "number" ? body.totalUsd : null;
        watchValueCache.set(address, { at: Date.now(), value: next });
        setValue(next);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [address]);
  return value;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

export function AccountAvatar({ name, active, size = "md" }: { name: string; active?: boolean; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-9 text-xs" : "size-11 text-sm";
  return (
    <span
      className={`grid ${dims} shrink-0 place-items-center rounded-full bg-surface-2 font-semibold ${
        active ? "border-2 border-accent text-accent" : "border border-line text-fg"
      }`}
    >
      {initials(name)}
    </span>
  );
}

export function WalletsSheet() {
  const accounts = useVela((state) => state.accounts);
  const activeId = useVela((state) => state.activeAccountId);
  const wallet = useVela((state) => state.wallet);
  const liveHoldings = useVela((state) => state.holdings);
  const setSheet = useVela((state) => state.setSheet);
  const market = useMarket();
  const prices = useMemo(
    () => Object.fromEntries(Object.entries(market.tokens).map(([symbol, quote]) => [symbol, quote.priceUsd])),
    [market.tokens],
  );
  const [watchValues, setWatchValues] = useState<Record<string, number | null | undefined>>({});

  const sandboxValue = (account: Account) => {
    const holdings = wallet?.address === account.address ? liveHoldings : (account.snapshot?.holdings ?? {});
    return holdingsUsd(holdings, prices);
  };
  const values = accounts.map((account) =>
    account.kind === "watch" ? watchValues[account.id] : sandboxValue(account),
  );
  const netWorth = values.reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0);
  const pending = values.some((value) => value === undefined);

  const groups: Array<{ title: string; items: Account[] }> = [
    { title: "Recovery phrase", items: accounts.filter((account) => account.kind === "seed" || account.kind === "passkey") },
    { title: "Imported", items: accounts.filter((account) => account.kind === "imported") },
    { title: "Watch only", items: accounts.filter((account) => account.kind === "watch") },
  ].filter((group) => group.items.length > 0);

  return (
    <Overlay label="My wallets" onClose={() => setSheet(null)}>
      <h2 className="text-center text-lg font-semibold">My wallets</h2>
      <div className="mt-4 rounded-card border border-line bg-surface-2 p-4">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">Net worth</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {formatUsd(netWorth)}
          {pending ? <span className="ml-2 text-sm font-normal text-muted">updating…</span> : null}
        </p>
        <p className="mt-1 text-xs text-muted">
          {accounts.length} wallet{accounts.length === 1 ? "" : "s"} · sandbox balances are simulated
        </p>
      </div>

      {groups.map((group) => (
        <Group key={group.title} title={group.title} count={group.items.length}>
          {group.items.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              active={account.id === activeId}
              sandboxValue={account.kind === "watch" ? null : sandboxValue(account)}
              onWatchValue={(value) => setWatchValues((prev) => (prev[account.id] === value ? prev : { ...prev, [account.id]: value }))}
            />
          ))}
        </Group>
      ))}

      <div className="mt-6">
        <PrimaryButton onClick={() => setSheet({ kind: "add-wallet" })}>
          <span className="inline-flex items-center gap-2">
            <Plus className="size-4" /> Add wallet
          </span>
        </PrimaryButton>
      </div>
    </Overlay>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-5">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpen(!open)}>
        <span className="text-left">
          <span className="block font-semibold">{title}</span>
          <span className="block text-xs text-muted">
            {count} wallet{count === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <ul className="mt-2 space-y-1">{children}</ul> : null}
    </section>
  );
}

function AccountRow({
  account,
  active,
  sandboxValue,
  onWatchValue,
}: {
  account: Account;
  active: boolean;
  sandboxValue: number | null;
  onWatchValue: (value: number | null | undefined) => void;
}) {
  const switchAccount = useVela((state) => state.switchAccount);
  const renameAccount = useVela((state) => state.renameAccount);
  const removeAccount = useVela((state) => state.removeAccount);
  const setToast = useVela((state) => state.setToast);
  const watchValue = useWatchValue(account.kind === "watch" ? account.address : null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(account.name);

  useEffect(() => {
    if (account.kind === "watch") onWatchValue(watchValue);
  }, [account.kind, watchValue, onWatchValue]);

  const value = account.kind === "watch" ? watchValue : sandboxValue;

  return (
    <li className={`rounded-card ${active ? "bg-surface-2" : ""}`}>
      <div className="flex items-center gap-3 px-2 py-2">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => switchAccount(account.id)}>
          <AccountAvatar name={account.name} active={active} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-medium">{account.name}</span>
              {account.kind === "watch" ? <Eye className="size-3.5 shrink-0 text-muted" aria-label="Watch only" /> : null}
            </span>
            <span className="flex items-center gap-1 font-mono text-xs text-muted">{shortAddr(account.address)}</span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Copy address"
          className="grid size-8 place-items-center text-muted"
          onClick={() => {
            void navigator.clipboard?.writeText(account.address);
            setToast(account.kind === "watch" ? "Public address copied." : "Simulated address copied. Do not send real funds.");
          }}
        >
          <Copy className="size-3.5" />
        </button>
        <span className="min-w-[4.5rem] text-right text-sm tabular-nums">
          {value === undefined ? "…" : value === null ? "—" : formatUsd(value)}
        </span>
        <button type="button" aria-label="Wallet options" className="grid size-8 place-items-center text-muted" onClick={() => setMenu(!menu)}>
          <MoreVertical className="size-4" />
        </button>
      </div>

      {menu && !renaming ? (
        <div className="flex gap-2 px-2 pb-3">
          <button type="button" className="h-9 flex-1 rounded-full border border-line text-sm" onClick={() => { setDraft(account.name); setRenaming(true); }}>
            Rename
          </button>
          <button
            type="button"
            className="h-9 flex-1 rounded-full border border-danger text-sm text-danger"
            onClick={() => {
              setMenu(false);
              removeAccount(account.id);
            }}
          >
            Remove
          </button>
        </div>
      ) : null}

      {renaming ? (
        <form
          className="flex gap-2 px-2 pb-3"
          onSubmit={(event) => {
            event.preventDefault();
            renameAccount(account.id, draft);
            setRenaming(false);
            setMenu(false);
          }}
        >
          <input
            autoFocus
            value={draft}
            maxLength={32}
            onChange={(event) => setDraft(event.target.value)}
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-bg px-3 text-sm outline-none"
          />
          <button type="submit" aria-label="Save name" className="grid size-9 place-items-center rounded-full bg-accent text-on-accent">
            <Check className="size-4" />
          </button>
        </form>
      ) : null}
    </li>
  );
}

type AddStep = "menu" | "import" | "watch";

export function AddWalletSheet() {
  const setSheet = useVela((state) => state.setSheet);
  const createWallet = useVela((state) => state.createWallet);
  const addWatchAccount = useVela((state) => state.addWatchAccount);
  const setToast = useVela((state) => state.setToast);
  const [step, setStep] = useState<AddStep>("menu");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const back = () => {
    setError("");
    if (step === "menu") setSheet({ kind: "wallets" });
    else setStep("menu");
  };

  async function createNew() {
    setBusy(true);
    await createWallet("seed", generatePhrase(), name);
    setToast("New sandbox wallet created");
    setBusy(false);
  }

  async function importPhrase() {
    const result = parseSandboxPhrase(text, ack);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    await createWallet("imported", result.words, name);
    setToast("Sandbox wallet imported");
    setBusy(false);
  }

  function watch() {
    const address = text.trim();
    if (!isSolanaAddress(address)) {
      setError("Enter a valid Solana address. Public keys only, never a recovery phrase.");
      return;
    }
    addWatchAccount(address, name);
    setToast("Watching a public address. No keys, nothing broadcasts.");
  }

  return (
    <Overlay label="Add wallet" onClose={() => setSheet(null)}>
      <h2 className="text-center text-lg font-semibold">Add wallet</h2>

      <label className="mt-4 block text-xs text-muted" htmlFor="wallet-name">
        Name (optional)
      </label>
      <input
        id="wallet-name"
        value={name}
        maxLength={32}
        onChange={(event) => setName(event.target.value)}
        placeholder="e.g. Trading, Savings"
        className="mt-1 h-11 w-full rounded-control border border-line bg-bg px-3 text-sm outline-none"
      />

      {step === "menu" ? (
        <div className="mt-4 space-y-2">
          <Option icon={<Sparkles className="size-5" />} title="Create new wallet" detail="Fresh sandbox wallet with a new recovery phrase" onClick={() => void createNew()} disabled={busy} />
          <Option icon={<KeyRound className="size-5" />} title="Import recovery phrase" detail="12 sandbox words. Never a real phrase." onClick={() => { setText(""); setStep("import"); }} />
          <Option icon={<Eye className="size-5" />} title="Watch an address" detail="Track any Solana wallet, read-only" onClick={() => { setText(""); setStep("watch"); }} />
        </div>
      ) : null}

      {step === "import" ? (
        <div className="mt-4">
          <p className="text-sm text-pretty text-danger">
            Do not paste a real recovery phrase. Sandbox words are stored unencrypted in this browser and control no funds.
          </p>
          <textarea
            value={text}
            onChange={(event) => { setText(event.target.value); setError(""); }}
            placeholder="twelve sandbox words"
            className="mt-3 h-24 w-full resize-none rounded-card border border-line bg-bg px-3 py-3 text-sm outline-none"
          />
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} className="mt-1 size-4 accent-accent" />
            I am not entering a real seed phrase.
          </label>
          <div className="mt-4">
            <PrimaryButton disabled={busy} onClick={() => void importPhrase()}>Import wallet</PrimaryButton>
          </div>
        </div>
      ) : null}

      {step === "watch" ? (
        <div className="mt-4">
          <input
            value={text}
            onChange={(event) => { setText(event.target.value); setError(""); }}
            placeholder="Solana address"
            spellCheck={false}
            autoCapitalize="off"
            className="h-11 w-full rounded-control border border-line bg-bg px-3 font-mono text-sm outline-none"
          />
          <div className="mt-4">
            <PrimaryButton onClick={watch}>Watch wallet</PrimaryButton>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-3">
        <GhostButton onClick={back}>Back</GhostButton>
      </div>
    </Overlay>
  );
}

function Option({ icon, title, detail, onClick, disabled }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-line bg-surface-2 px-3 py-3 text-left disabled:opacity-60"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg text-accent">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted">{detail}</span>
      </span>
    </button>
  );
}
