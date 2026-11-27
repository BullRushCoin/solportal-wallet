import { useCallback, useEffect, useState } from "react";
import type { Keypair } from "@solana/web3.js";
import { Copy, Droplets, ExternalLink, Flame, FlaskConical, ImagePlus, RefreshCw, Send } from "lucide-react";
import {
  airdrop,
  balanceSol,
  createKeypair,
  explorerAccount,
  explorerTx,
  incinerate,
  makeJunk,
  scanJunk,
  type JunkAccount,
  faucetEnabled,
  PUBLIC_FAUCET,
  isValidAddress,
  listNfts,
  loadKeypair,
  mintTestNft,
  recentTxs,
  resetKeypair,
  sendNft,
  sendSol,
  type DevnetNft,
  type DevnetTx,
} from "@/lib/vela/devnet";
import { formatAmt, shortAddr } from "@/lib/vela/format";
import { incineratorFeeBps } from "@/lib/vela/incinerator";
import { feeWalletAddress } from "@/lib/vela/fee-wallet";
import { useVela } from "@/lib/vela/store";
import { PageBar } from "@/components/vela/more-ui";
import { DangerButton, GhostButton, PrimaryButton, SectionLabel } from "@/components/vela/ui";

const NETWORK_FEE = 0.000005;

type Busy = null | "airdrop" | "send" | "mint" | "nft" | "junk" | "burn";

function errText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/cooldown/i.test(message)) return "You already got free SOL this hour. Try faucet.solana.com for more.";
  if (/faucet|airdrop|429/i.test(message)) return "The in-app faucet is unavailable right now. Use faucet.solana.com with your copied address.";
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(message))
    return "Connection dropped. Pull to refresh and try again; nothing was sent.";
  if (/insufficient|prior credit|0x1\b|lamports/i.test(message)) return "Not enough devnet SOL. Tap Get SOL first.";
  return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}

export default function DevnetPage() {
  const setToast = useVela((state) => state.setToast);
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [nfts, setNfts] = useState<DevnetNft[]>([]);
  const [txs, setTxs] = useState<DevnetTx[]>([]);
  const [junk, setJunk] = useState<JunkAccount[]>([]);
  const [burnAsk, setBurnAsk] = useState(false);
  const [burnResult, setBurnResult] = useState<string | null>(null);
  const [pickedNfts, setPickedNfts] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "send" | { nft: DevnetNft }>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [resetAsk, setResetAsk] = useState(false);
  const [inAppFaucet, setInAppFaucet] = useState(false);
  const [faucetHint, setFaucetHint] = useState(false);

  useEffect(() => {
    setKeypair(loadKeypair());
    setReady(true);
    void faucetEnabled().then(setInAppFaucet);
  }, []);

  const refresh = useCallback(async (kp: Keypair) => {
    try {
      const [bal, list, recent, dust] = await Promise.all([
        balanceSol(kp.publicKey),
        listNfts(kp.publicKey),
        recentTxs(kp.publicKey),
        scanJunk(kp.publicKey),
      ]);
      setBalance(bal);
      setJunk(dust);
      setNfts(list);
      setTxs(recent);
    } catch (e) {
      setError(errText(e));
    }
  }, []);

  useEffect(() => {
    if (keypair) void refresh(keypair);
  }, [keypair, refresh]);

  async function run(kind: Busy, job: () => Promise<string>, done: string) {
    if (!keypair) return;
    setBusy(kind);
    setError(null);
    try {
      const signature = await job();
      setLastSig(signature);
      setToast(done);
      setMode(null);
      setConfirming(false);
      setTo("");
      setAmount("");
      await refresh(keypair);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <PageBar title="Devnet" />;

  if (!keypair) {
    return (
      <div>
        <PageBar title="Devnet" />
        <div className="px-5 pt-6 pb-10">
          <div className="grid size-14 place-items-center rounded-full border border-line bg-surface">
            <FlaskConical className="size-6 text-accent" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-balance">Try SolPortal on a real network</h2>
          <p className="mt-2 text-sm text-pretty text-muted">
            Devnet is Solana's public test network. You get a real key, real signatures and real transactions you can check on Solscan, but
            the SOL is free play money.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>• Get free devnet SOL</li>
            <li>• Send and receive SOL</li>
            <li>• Mint a test NFT and send it to a friend</li>
          </ul>
          <p className="mt-4 rounded-control border border-line px-3 py-3 text-xs text-muted">
            The devnet key is stored in this browser only. Never send real (mainnet) SOL to it.
          </p>
          <div className="mt-5">
            <PrimaryButton onClick={() => setKeypair(createKeypair())}>Create devnet wallet</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  const address = keypair.publicKey.toBase58();
  const value = Number(amount);
  const canSend = isValidAddress(to) && value > 0 && balance !== null && value + NETWORK_FEE <= balance;
  const nftTarget = mode && typeof mode === "object" ? mode.nft : null;
  const feeBps = incineratorFeeBps();

  return (
    <div>
      <PageBar
        title="Devnet"
        right={
          <button type="button" aria-label="Refresh" onClick={() => void refresh(keypair)} className="grid size-10 place-items-center text-muted">
            <RefreshCw className="size-4" />
          </button>
        }
      />
      <div className="px-5 pt-4 pb-10">
        <div className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-accent/50 px-2 py-0.5 font-mono text-[10px] tracking-widest text-accent uppercase">Devnet · live</span>
            <a href={explorerAccount(address)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted">
              Solscan <ExternalLink className="size-3" />
            </a>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{balance === null ? "…" : `${formatAmt(balance, 4)} SOL`}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(address).catch(() => {});
              setToast("Devnet address copied");
            }}
            className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted"
          >
            {shortAddr(address)} <Copy className="size-3" />
          </button>
          <div className="mt-4 grid grid-cols-3 gap-2 whitespace-nowrap">
            <GhostButton
              disabled={busy !== null}
              onClick={() => {
                if (inAppFaucet) {
                  void run("airdrop", () => airdrop(keypair.publicKey), "Free devnet SOL received");
                  return;
                }
                navigator.clipboard?.writeText(address).catch(() => {});
                window.open(PUBLIC_FAUCET, "_blank", "noopener");
                setFaucetHint(true);
                setToast("Address copied. Paste it on the Solana faucet.");
              }}
            >
              <Droplets className="mr-1 size-4" /> {busy === "airdrop" ? "…" : "Get SOL"}
            </GhostButton>
            <GhostButton disabled={busy !== null} onClick={() => { setMode("send"); setConfirming(false); }}>
              <Send className="mr-1 size-4" /> Send
            </GhostButton>
            <GhostButton
              onClick={() => {
                navigator.clipboard?.writeText(address).catch(() => {});
                setToast("Address copied. Share it to receive SOL or NFTs.");
              }}
            >
              <Copy className="mr-1 size-4" /> Receive
            </GhostButton>
          </div>
        </div>

        {faucetHint ? (
          <div className="mt-3 rounded-control border border-line px-3 py-3 text-sm">
            <p>Paste your copied address on faucet.solana.com, pick Devnet, and request SOL. Then tap refresh here.</p>
            <div className="mt-2 flex gap-3 text-xs">
              <a href={PUBLIC_FAUCET} target="_blank" rel="noreferrer" className="text-accent">Open faucet</a>
              <button type="button" className="text-muted" onClick={() => { void refresh(keypair); setFaucetHint(false); }}>I've got it, refresh</button>
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-control border border-danger px-3 py-2 text-sm text-danger">{error}</p> : null}
        {lastSig ? (
          <a href={explorerTx(lastSig)} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between rounded-control border border-accent/50 px-3 py-2 text-sm">
            <span>Confirmed on devnet · {shortAddr(lastSig)}</span>
            <span className="flex items-center gap-1 text-accent">View <ExternalLink className="size-3" /></span>
          </a>
        ) : null}

        {mode ? (
          <div className="mt-4 rounded-card border border-line p-4">
            <h3 className="font-semibold">{nftTarget ? `Send ${nftTarget.name}` : "Send devnet SOL"}</h3>
            {!confirming ? (
              <>
                <input
                  value={to}
                  autoFocus
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="Destination devnet address"
                  className="mt-3 h-12 w-full rounded-control border border-line bg-bg px-3 font-mono text-xs outline-none"
                />
                {nftTarget ? null : (
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Amount in SOL"
                    className="mt-2 h-12 w-full rounded-control border border-line bg-bg px-3 text-sm tabular-nums outline-none"
                  />
                )}
                {to && !isValidAddress(to) ? <p className="mt-2 text-xs text-danger">That isn't a valid Solana address.</p> : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <GhostButton onClick={() => setMode(null)}>Cancel</GhostButton>
                  <PrimaryButton disabled={nftTarget ? !isValidAddress(to) : !canSend} onClick={() => setConfirming(true)}>
                    Review
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <>
                <div className="mt-3 space-y-1 rounded-control bg-bg px-3 py-3 text-sm">
                  <p>{nftTarget ? `${nftTarget.name} (1 NFT)` : `${formatAmt(value, 6)} SOL`}</p>
                  <p className="font-mono text-xs break-all text-muted">To {to.trim()}</p>
                  <p className="text-xs text-muted">Network fee about {NETWORK_FEE} SOL · devnet · final once confirmed</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <GhostButton disabled={busy !== null} onClick={() => setConfirming(false)}>Back</GhostButton>
                  <PrimaryButton
                    disabled={busy !== null}
                    onClick={() =>
                      nftTarget
                        ? void run("nft", () => sendNft(keypair, nftTarget.mint, to), `Sent ${nftTarget.name}`)
                        : void run("send", () => sendSol(keypair, to, value), `Sent ${formatAmt(value, 4)} SOL`)
                    }
                  >
                    {busy ? "Signing…" : "Sign & send"}
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        ) : null}

        <IncineratorSection
          junk={junk}
          picked={pickedNfts}
          onPick={(account) =>
            setPickedNfts((current) => (current.includes(account) ? current.filter((a) => a !== account) : [...current, account]))
          }
          busy={busy}
          ask={burnAsk}
          result={burnResult}
          onAsk={setBurnAsk}
          onMakeJunk={() => void run("junk", () => makeJunk(keypair), "3 junk tokens and 1 spam NFT created")}
          onBurn={() =>
            void run(
              "burn",
              async () => {
                const targets = junk.filter((item) => !item.isNft || pickedNfts.includes(item.account));
                const res = await incinerate(keypair, targets, feeBps, feeWalletAddress());
                setBurnAsk(false);
                setPickedNfts([]);
                setBurnResult(
                  `Reclaimed ${formatAmt(res.reclaimedSol, 6)} SOL` +
                    (res.feeSkipped ? " · fee skipped on devnet" : res.feeSol > 0 ? ` · ${formatAmt(res.feeSol, 6)} SOL fee to SolPortal` : ""),
                );
                return res.signatures[res.signatures.length - 1]!;
              },
              "Incinerated. Rent is back in your wallet.",
            )
          }
        />

        <div className="mt-8 flex items-center justify-between">
          <SectionLabel>Devnet NFTs</SectionLabel>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("mint", async () => (await mintTestNft(keypair)).signature, "Test NFT minted")}
            className="flex items-center gap-1 text-sm text-accent disabled:opacity-50"
          >
            <ImagePlus className="size-4" /> {busy === "mint" ? "Minting…" : "Mint a test NFT"}
          </button>
        </div>
        {nfts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No NFTs yet. Mint one (needs a little devnet SOL), or have a friend send you one.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {nfts.map((nft) => (
              <li key={nft.mint}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setMode({ nft });
                    setConfirming(false);
                    setTo("");
                  }}
                >
                  {nft.image ? (
                    <img src={nft.image} alt="" className="aspect-square w-full rounded-card border border-line object-cover" />
                  ) : (
                    <div className="nft-night aspect-square w-full rounded-card border border-line" />
                  )}
                  <p className="mt-2 truncate text-sm font-medium">{nft.name}</p>
                  <p className="text-xs text-muted">Tap to send</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8">
          <SectionLabel>Recent devnet transactions</SectionLabel>
          {txs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-control border border-line">
              {txs.map((tx) => (
                <li key={tx.signature}>
                  <a href={explorerTx(tx.signature)} target="_blank" rel="noreferrer" className="flex items-center justify-between px-3 py-3 text-sm">
                    <span className="font-mono text-xs">{shortAddr(tx.signature)}</span>
                    <span className={`text-xs ${tx.ok ? "text-muted" : "text-danger"}`}>
                      {tx.ok ? (tx.at ? new Date(tx.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Confirmed") : "Failed"}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-10">
          {resetAsk ? (
            <div className="grid grid-cols-2 gap-2">
              <GhostButton onClick={() => setResetAsk(false)}>Keep it</GhostButton>
              <DangerButton
                onClick={() => {
                  resetKeypair();
                  setKeypair(null);
                  setBalance(null);
                  setNfts([]);
                  setTxs([]);
                  setResetAsk(false);
                }}
              >
                Delete devnet key
              </DangerButton>
            </div>
          ) : (
            <button type="button" onClick={() => setResetAsk(true)} className="w-full text-center text-xs text-muted">
              Reset devnet wallet
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function IncineratorSection({
  junk,
  picked,
  onPick,
  busy,
  ask,
  result,
  onAsk,
  onMakeJunk,
  onBurn,
}: {
  junk: JunkAccount[];
  picked: string[];
  onPick: (account: string) => void;
  busy: Busy;
  ask: boolean;
  result: string | null;
  onAsk: (value: boolean) => void;
  onMakeJunk: () => void;
  onBurn: () => void;
}) {
  const feeBps = incineratorFeeBps();
  const tokens = junk.filter((item) => !item.isNft);
  const nfts = [...junk.filter((item) => item.isNft)].sort((a, b) => Number(b.spam) - Number(a.spam));
  const chosenNfts = nfts.filter((item) => picked.includes(item.account));
  const targets = [...tokens, ...chosenNfts];
  const rentSol = targets.reduce((sum, item) => sum + item.rentLamports, 0) / 1e9;
  const feeSol = (rentSol * feeBps) / 10_000;
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <SectionLabel>Devnet Incinerator</SectionLabel>
        <button type="button" disabled={busy !== null} onClick={onMakeJunk} className="text-sm text-accent disabled:opacity-50">
          {busy === "junk" ? "Creating…" : "Make junk"}
        </button>
      </div>
      <div className="mt-3 rounded-card border border-line bg-surface p-4">
        {junk.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing to burn. Tap Make junk to create dust, an empty account and a spam NFT, then burn them for real.
          </p>
        ) : (
          <>
            {tokens.length > 0 ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Tokens · always included</p>
                <ul className="mt-1 divide-y divide-line">
                  {tokens.map((item) => (
                    <li key={item.account} className="flex items-center justify-between py-2 text-sm">
                      <span className="font-medium">{item.symbol}</span>
                      <span className="text-xs text-muted tabular-nums">
                        {item.amountRaw === "0" ? "Empty account" : `${formatAmt(item.uiAmount, 2)} dust`} · {formatAmt(item.rentLamports / 1e9, 5)} SOL
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {nfts.length > 0 ? (
              <>
                <p className={`text-xs font-medium uppercase tracking-wide text-muted ${tokens.length ? "mt-4" : ""}`}>NFTs · tap to include</p>
                <ul className="mt-1 divide-y divide-line">
                  {nfts.map((item) => {
                    const on = picked.includes(item.account);
                    return (
                      <li key={item.account}>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => onPick(item.account)}
                          className="flex w-full items-center gap-3 py-2 text-left text-sm"
                        >
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded border ${on ? "border-red-500 bg-red-500 text-white" : "border-line"}`}
                          >
                            {on ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{item.symbol}</span>
                            <span className={`text-xs ${item.spam ? "text-amber-500" : "text-muted"}`}>
                              {item.spam ? "Likely spam" : "Yours"} · No floor
                            </span>
                          </span>
                          <span className="text-xs text-muted tabular-nums">{formatAmt(item.rentLamports / 1e9, 5)} SOL</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            {targets.length > 0 ? (
              <>
                <div className="mt-3 space-y-0.5 text-sm">
                  <p>Rent locked {formatAmt(rentSol, 6)} SOL</p>
                  <p className="text-muted">Fee {formatAmt(feeSol, 6)} SOL ({feeBps / 100}%) to SolPortal</p>
                  <p className="font-medium text-accent">You get back about {formatAmt(rentSol - feeSol, 6)} SOL</p>
                </div>
                {ask ? (
                  <div className="mt-3">
                    <p className="text-xs text-muted">
                      Closes {targets.length} account{targets.length === 1 ? "" : "s"} on devnet
                      {chosenNfts.length ? `, including ${chosenNfts.length} NFT${chosenNfts.length === 1 ? "" : "s"} gone for good` : ""}. This is final.
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <GhostButton disabled={busy !== null} onClick={() => onAsk(false)}>Cancel</GhostButton>
                      <DangerButton disabled={busy !== null} onClick={onBurn}>
                        {busy === "burn" ? "Burning…" : "Sign & burn"}
                      </DangerButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <PrimaryButton disabled={busy !== null} onClick={() => onAsk(true)}>
                      <Flame className="mr-1.5 size-4" /> Incinerate {targets.length} account{targets.length === 1 ? "" : "s"}
                    </PrimaryButton>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-3 text-xs text-muted">Tap an NFT to include it.</p>
            )}
          </>
        )}
        {result ? <p className="mt-3 text-sm text-accent">{result}</p> : null}
      </div>
    </div>
  );
}
