import { useState } from "react";
import { BackupSheet } from "@/components/vela/backup";
import { ShieldAlert } from "lucide-react";
import { dappByHost, dappById, normalizeHost } from "@/lib/vela/dapps";
import { formatAmt, formatUsd, shortAddr } from "@/lib/vela/format";
import { intentBlocked, type TxIntent } from "@/lib/vela/provider";
import { priorityFeeSol, useVela } from "@/lib/vela/store";
import { tokenBySymbol, walletTokens } from "@/lib/vela/tokens";
import { AssetSheet } from "@/components/vela/asset-sheet";
import { CardSkinSheet } from "@/components/vela/balance-card";
import { AddWalletSheet, WalletsSheet } from "@/components/vela/wallets-sheet";
import { DangerButton, GhostButton, Overlay, PrimaryButton, TokenMark } from "@/components/vela/ui";

export function Sheets() {
  const sheet = useVela((state) => state.sheet);
  if (!sheet) return null;
  if (sheet.kind === "sign") return <SignSheet intent={sheet.intent} />;
  if (sheet.kind === "receive") return <ReceiveSheet />;
  if (sheet.kind === "send") return <SendSheet />;
  if (sheet.kind === "url") return <UrlSheet />;
  if (sheet.kind === "connect") return <ConnectSheet dappId={sheet.dappId} next={sheet.next} />;
  if (sheet.kind === "wallets") return <WalletsSheet />;
  if (sheet.kind === "add-wallet") return <AddWalletSheet />;
  if (sheet.kind === "card-skin") return <CardSkinSheet />;
  if (sheet.kind === "backup") return <BackupSheet />;
  if (sheet.kind === "nft") return <NftSheet id={sheet.id} />;
  if (sheet.kind === "asset") return <AssetSheet key={sheet.token.mint} token={sheet.token} amount={sheet.amount} viewOnly={sheet.viewOnly} />;
  return null;
}

function SignSheet({ intent }: { intent: TxIntent }) {
  const approve = useVela((state) => state.approve);
  const reject = useVela((state) => state.reject);
  const holdings = useVela((state) => state.holdings);
  const priority = useVela((state) => state.priority);
  const blocked = intentBlocked(intent, holdings);
  const critical = intent.warnings.some((item) => item.level === "critical") || intent.authorities.some((item) => item.level === "critical") || intent.kind === "drain";

  return (
    <Overlay label="Review transaction" onClose={reject}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            {intent.verified ? "Verified" : "Unverified"}
          </p>
          <h2 className="text-xl font-semibold">{intent.title}</h2>
        </div>
        {critical ? <ShieldAlert className="size-6 text-danger" /> : null}
      </div>
      <p className="mt-1 font-mono text-xs text-muted">{intent.origin}</p>

      {critical ? (
        <div className="mt-4 rounded-control border border-danger bg-bg px-3 py-3 text-sm text-danger">
          This transaction does more than the button claimed. Read the deltas before you approve.
        </div>
      ) : null}

      {intent.kind === "incinerate" ? (
        <ul className="mt-4 divide-y divide-line rounded-control border border-line">
          {intent.items.map((item) => (
            <li key={item.mint} className="flex items-center gap-3 px-3 py-3">
              <TokenMark symbol={item.symbol} src={item.image} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.symbol}</p>
                <p className="text-xs text-muted">
                  {item.amount === 0 ? "Empty account" : formatAmt(item.amount, item.amount >= 1_000 ? 0 : 4)}
                  {item.valueUsd !== null ? ` · ${formatUsd(item.valueUsd)}` : " · no price"}
                  {item.action === "swap" ? " · swap to SOL" : " · burn + close"}
                  {item.swapSol ? ` · ${formatAmt(item.swapSol, 6)} SOL` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {intent.kind === "send-nft" ? (
        <div className="mt-4 flex items-center gap-3 rounded-control border border-line px-3 py-3">
          <NftArt nft={intent.nft} className="size-14 shrink-0 rounded-control" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{intent.nft.name}</p>
            <p className="truncate text-xs text-muted">{intent.nft.collection}</p>
          </div>
          <span className="text-sm text-danger tabular-nums">−1</span>
        </div>
      ) : null}
      {intent.kind === "send-nft" ? (
        <p className="mt-2 rounded-control bg-bg px-3 py-2 font-mono text-xs break-all text-muted">To {intent.to}</p>
      ) : null}

      <div className="mt-4 space-y-2">
        {intent.kind === "send-nft" ? null : intent.kind === "incinerate" ? (
          <div className="rounded-control border border-line px-3 py-3 text-sm">
            <p>Rent {formatAmt(intent.rentSol, 6)} SOL</p>
            <p className="mt-1">Swaps {formatAmt(intent.swapSol, 6)} SOL</p>
            <p className="mt-1">Fee {formatAmt(intent.feeSol, 6)} SOL ({(intent.feeBps / 100).toFixed(intent.feeBps % 100 === 0 ? 0 : 1)}%) to SolPortal cold wallet</p>
            <p className="mt-2 font-medium">Net +{formatAmt(intent.netSol, 6)} SOL</p>
          </div>
        ) : intent.effects.length === 0 ? (
          <p className="rounded-control border border-line px-3 py-3 text-sm text-muted">No token movement.</p>
        ) : (
          intent.effects.map((effect) => (
            <div key={`${effect.symbol}-${effect.delta}`} className="flex items-center justify-between rounded-control border border-line px-3 py-3">
              <span className="font-medium">{effect.symbol}</span>
              <span className={`text-right tabular-nums ${effect.delta < 0 ? "text-danger" : "text-accent"}`}>
                {effect.delta > 0 ? "+" : ""}
                {formatAmt(effect.delta, 4)}
                <span className="mt-0.5 block text-xs text-muted">{formatUsd(effect.usd)}</span>
              </span>
            </div>
          ))
        )}
      </div>

      {intent.kind === "message" ? (
        <p className="mt-3 rounded-control bg-bg px-3 py-3 font-mono text-xs break-all text-muted">{intent.message}</p>
      ) : null}

      {intent.authorities.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {intent.authorities.map((item) => (
            <li key={item.title} className="rounded-control border border-line px-3 py-3">
              <p className={`text-sm font-medium ${item.level === "critical" ? "text-danger" : "text-fg"}`}>{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-pretty text-muted">{item.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {intent.warnings.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {intent.warnings.map((item) => (
            <li key={item.title} className="text-sm">
              <span className={item.level === "info" ? "text-fg" : "text-danger"}>{item.title}. </span>
              <span className="text-muted">{item.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-muted">
        Network fee {formatAmt(intent.networkFeeSol, 6)} SOL · {priority === "protect" ? "Protected" : priority === "fast" ? "Fast" : "Standard"}
        {blocked ? ` · ${blocked}` : ""}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <GhostButton onClick={reject}>Reject</GhostButton>
        {critical ? (
          <DangerButton disabled={Boolean(blocked) && intent.kind !== "drain"} onClick={() => approve(intent)}>
            Approve anyway
          </DangerButton>
        ) : (
          <PrimaryButton disabled={Boolean(blocked)} onClick={() => approve(intent)}>
            Approve
          </PrimaryButton>
        )}
      </div>
    </Overlay>
  );
}

function ReceiveSheet() {
  const wallet = useVela((state) => state.wallet);
  const receiveNft = useVela((state) => state.receiveNft);
  const setSheet = useVela((state) => state.setSheet);
  const setToast = useVela((state) => state.setToast);
  const address = wallet?.address ?? "";
  return (
    <Overlay label="Receive" onClose={() => setSheet(null)}>
      <h2 className="text-xl font-semibold">Receive</h2>
      <div className="mt-3 rounded-control border border-danger px-3 py-3 text-sm text-danger">
        Simulated address. Sending real SOL here burns it. Nobody has the key.
      </div>
      <div className="mt-4 grid grid-cols-8 gap-1 rounded-card bg-fg p-3">
        {Array.from({ length: 64 }, (_, index) => {
          const code = address.charCodeAt(index % Math.max(address.length, 1)) || 0;
          const on = (code + index) % 3 !== 0;
          return <span key={index} className={`h-4 ${on ? "bg-bg" : "bg-transparent"}`} />;
        })}
      </div>
      <p className="mt-3 font-mono text-xs break-all text-muted">{address}</p>
      <div className="mt-4">
        <PrimaryButton
          onClick={() => {
            void navigator.clipboard?.writeText(address);
            setToast("Copied a simulated address. Do not fund it.");
            setSheet(null);
          }}
        >
          Copy address
        </PrimaryButton>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Works for SOL, tokens and NFTs.</p>
      <div className="mt-2">
        <GhostButton onClick={receiveNft}>Simulate a friend sending you an NFT</GhostButton>
      </div>
    </Overlay>
  );
}

function SendSheet() {
  const holdings = useVela((state) => state.holdings);
  const setMore = useVela((state) => state.setMore);
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const [symbol, setSymbol] = useState("SOL");
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");
  const token = tokenBySymbol(symbol);
  const value = Number(amount);
  const fee = priorityFeeSol(priority);
  const enough = value > 0 && value <= (holdings[symbol] ?? 0) && (symbol === "SOL" ? value + fee <= (holdings.SOL ?? 0) : fee <= (holdings.SOL ?? 0));

  function review() {
    const intent: TxIntent = {
      kind: "send",
      origin: "https://solportal.wallet",
      site: "SolPortal Send",
      verified: true,
      title: `Send ${symbol}`,
      symbol,
      amount: value,
      to: to.trim() || "Unknown address",
      networkFeeSol: fee,
      effects: [{ symbol, delta: -value, usd: -value * token.priceUsd }],
      authorities: [],
      warnings: to.trim().length < 32 ? [{ level: "warn", title: "Address looks short", detail: "A real Solana address is 32 bytes, base58." }] : [],
    };
    setSheet({ kind: "sign", intent });
  }

  return (
    <Overlay label="Send" onClose={() => setSheet(null)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">Send</h2>
        <button
          type="button"
          className="text-sm text-accent"
          onClick={() => {
            setSheet(null);
            setMore("collectibles");
          }}
        >
          Send an NFT
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {walletTokens().filter((item) => (holdings[item.symbol] ?? 0) > 0).map((item) => (
          <button
            key={item.symbol}
            onClick={() => setSymbol(item.symbol)}
            className={`h-10 shrink-0 rounded-full border px-3 text-sm ${symbol === item.symbol ? "border-accent bg-accent text-on-accent" : "border-line"}`}
          >
            {item.symbol}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <TokenMark symbol={symbol} />
        <input
          inputMode="decimal"
          value={amount}
          placeholder="0"
          onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-transparent text-3xl font-semibold tabular-nums outline-none"
        />
      </div>
      <p className="text-xs text-muted">Balance {formatAmt(holdings[symbol] ?? 0)}</p>
      <input
        value={to}
        onChange={(event) => setTo(event.target.value)}
        placeholder="Destination address"
        className="mt-3 h-12 w-full rounded-control border border-line bg-bg px-3 font-mono text-xs outline-none"
      />
      <div className="mt-4">
        <PrimaryButton disabled={!enough} onClick={review}>
          Review send
        </PrimaryButton>
      </div>
    </Overlay>
  );
}

function UrlSheet() {
  const setSheet = useVela((state) => state.setSheet);
  const openDapp = useVela((state) => state.openDapp);
  const openExternal = useVela((state) => state.openExternal);
  const [value, setValue] = useState("");

  function go() {
    const host = normalizeHost(value);
    const known = host ? dappByHost(host) : undefined;
    setSheet(null);
    if (known) openDapp(known.id);
    else openExternal(value || "https://unknown.example");
  }

  return (
    <Overlay label="Open link" onClose={() => setSheet(null)}>
      <h2 className="text-xl font-semibold">Open a link</h2>
      <p className="mt-2 text-sm text-muted">Only http and https links. Directory hosts open the sandbox preview; anything else stops on a warning. You can open the real site in a new tab from there — the sandbox wallet cannot connect to it.</p>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="https://"
        className="mt-4 h-12 w-full rounded-control border border-line bg-bg px-3 text-sm outline-none"
      />
      <div className="mt-4">
        <PrimaryButton onClick={go}>Open</PrimaryButton>
      </div>
    </Overlay>
  );
}

function ConnectSheet({ dappId, next }: { dappId: string; next: TxIntent | { redirect: "swap" } | null }) {
  const dapp = dappById(dappId);
  const wallet = useVela((state) => state.wallet);
  const connectSite = useVela((state) => state.connectSite);
  const setSheet = useVela((state) => state.setSheet);
  const setTab = useVela((state) => state.setTab);
  const closeBrowser = useVela((state) => state.closeBrowser);
  if (!dapp) return null;

  return (
    <Overlay label="Connect" onClose={() => setSheet(null)}>
      <p className="font-mono text-xs tracking-widest text-muted uppercase">Connect</p>
      <h2 className="mt-1 text-2xl font-semibold">{dapp.name}</h2>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
        The site can request transactions. SolPortal simulates each one. The site never receives the key, only a public address ({wallet ? shortAddr(wallet.address) : "—"}).
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <GhostButton onClick={() => setSheet(null)}>Reject</GhostButton>
        <PrimaryButton
          onClick={() => {
            connectSite(dapp.id);
            if (next && "redirect" in next) {
              closeBrowser();
              setTab("swap");
              setSheet(null);
              return;
            }
            if (next) setSheet({ kind: "sign", intent: next });
            else setSheet(null);
          }}
        >
          Connect
        </PrimaryButton>
      </div>
    </Overlay>
  );
}

export function NftArt({ nft, className }: { nft: { image?: string | null; pattern?: string }; className?: string }) {
  return nft.image ? (
    <img src={nft.image} alt="" className={`border border-line object-cover ${className ?? ""}`} />
  ) : (
    <div className={`border border-line ${nft.pattern ?? "bg-surface-2"} ${className ?? ""}`} />
  );
}

function NftSheet({ id }: { id: string }) {
  const nft = useVela((state) => state.nfts.find((item) => item.id === id) ?? null);
  const watching = useVela((state) => Boolean(state.watchAddress));
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  if (!nft) {
    return (
      <Overlay label="Collectible" onClose={() => setSheet(null)}>
        <p className="text-sm text-muted">This NFT is no longer in the wallet.</p>
      </Overlay>
    );
  }
  const address = to.trim();
  function review() {
    if (!nft) return;
    const intent: TxIntent = {
      kind: "send-nft",
      origin: "https://solportal.wallet",
      site: "SolPortal Send",
      verified: true,
      title: `Send ${nft.name}`,
      nft,
      to: address || "Unknown address",
      networkFeeSol: priorityFeeSol(priority),
      effects: [],
      authorities: [],
      warnings:
        address.length < 32
          ? [{ level: "warn", title: "Address looks short", detail: "A real Solana address is 32 bytes, base58." }]
          : [{ level: "info", title: "NFT transfers are final", detail: "Double-check the address. Nobody can reverse it." }],
    };
    setSheet({ kind: "sign", intent });
  }
  return (
    <Overlay label={nft.name} onClose={() => setSheet(null)}>
      <NftArt nft={nft} className="aspect-square w-full rounded-card" />
      <h2 className="mt-4 text-xl font-semibold">{nft.name}</h2>
      <p className="text-sm text-muted">{nft.collection}</p>
      {watching ? null : sending ? (
        <div className="mt-4">
          <input
            value={to}
            autoFocus
            onChange={(event) => setTo(event.target.value)}
            placeholder="Destination address"
            className="h-12 w-full rounded-control border border-line bg-bg px-3 font-mono text-xs outline-none"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <GhostButton onClick={() => setSending(false)}>Cancel</GhostButton>
            <PrimaryButton disabled={!address} onClick={review}>
              Review
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <PrimaryButton onClick={() => setSending(true)}>Send</PrimaryButton>
          <GhostButton onClick={() => setSheet({ kind: "receive" })}>Receive</GhostButton>
        </div>
      )}
    </Overlay>
  );
}
