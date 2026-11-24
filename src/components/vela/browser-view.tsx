import { Bookmark, ChevronLeft, ExternalLink, Lock, ShieldAlert } from "lucide-react";
import { dappById, intentForAction, type Dapp } from "@/lib/vela/dapps";
import { formatAmt, formatUsd } from "@/lib/vela/format";
import { openSafeHttpUrl } from "@/lib/vela/open-url";
import { priorityFeeSol, useVela } from "@/lib/vela/store";
import { tokenBySymbol } from "@/lib/vela/tokens";
import { GhostButton, PrimaryButton } from "@/components/vela/ui";

export function BrowserView() {
  const browser = useVela((state) => state.browser);
  const closeBrowser = useVela((state) => state.closeBrowser);
  const acceptGate = useVela((state) => state.acceptGate);
  const bookmarks = useVela((state) => state.bookmarks);
  const toggleBookmark = useVela((state) => state.toggleBookmark);
  const connected = useVela((state) => state.connected);
  const holdings = useVela((state) => state.holdings);
  const priority = useVela((state) => state.priority);
  const setSheet = useVela((state) => state.setSheet);
  const setTab = useVela((state) => state.setTab);
  const setToast = useVela((state) => state.setToast);

  function openRealSite(url: string) {
    if (!openSafeHttpUrl(url)) setToast("Only http and https links can open.");
  }

  if (!browser) return null;
  const dapp = browser.dappId === "external" ? null : dappById(browser.dappId);
  const saved = dapp ? bookmarks.some((bookmark) => bookmark.dappId === dapp.id) : false;
  const linked = dapp ? connected.some((site) => site.origin === dapp.origin) : false;

  function act(target: Dapp) {
    const next = intentForAction(target, holdings, priorityFeeSol(priority));
    if ("redirect" in next) {
      closeBrowser();
      setTab("swap");
      return;
    }
    if (!connected.some((site) => site.origin === target.origin)) {
      setSheet({ kind: "connect", dappId: target.id, next });
      return;
    }
    setSheet({ kind: "sign", intent: next });
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button aria-label="Close browser" className="grid size-11 place-items-center" onClick={closeBrowser}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1 rounded-full border border-line bg-surface px-3 py-2">
          <p className="flex items-center gap-1 font-mono text-xs">
            {dapp?.verified ? <Lock className="size-3 text-accent" /> : <ShieldAlert className="size-3 text-danger" />}
            <span className="truncate">{dapp?.host ?? browser.url.replace(/^https?:\/\//, "")}</span>
          </p>
        </div>
        {dapp?.listed ? (
          <button aria-label="Bookmark" className="grid size-11 place-items-center" onClick={() => toggleBookmark(dapp.id)}>
            <Bookmark className={`size-4 ${saved ? "fill-accent text-accent" : "text-muted"}`} />
          </button>
        ) : (
          <span className="w-11" />
        )}
      </header>

      {browser.stage === "gate" ? (
        <div className="flex flex-1 flex-col px-5 pt-8">
          <ShieldAlert className="size-8 text-danger" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance">Unverified site</h2>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
            {dapp?.host ?? browser.url} is not a verified SolPortal listing. You can open the real site in a new tab, or continue into a clearly labeled sandbox preview. The sandbox wallet cannot connect to real sites.
          </p>
          <RealSiteNote />
          <div className="mt-auto flex flex-col gap-3 pb-6">
            <PrimaryButton onClick={() => openRealSite(dapp?.origin ?? browser.url)}>
              <ExternalLink className="mr-2 size-4" />
              Open real site in new tab
            </PrimaryButton>
            <GhostButton onClick={acceptGate}>Continue to sandbox preview</GhostButton>
            <GhostButton onClick={closeBrowser}>Go back</GhostButton>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8">
          <div className="mb-5 rounded-card border border-line bg-surface p-4">
            <p className="font-mono text-xs tracking-widest text-accent uppercase">Sandbox preview · simulated</p>
            <RealSiteNote compact />
            <div className="mt-3">
              <GhostButton onClick={() => openRealSite(dapp?.origin ?? browser.url)}>
                <ExternalLink className="mr-2 size-4" />
                Open real site in new tab
              </GhostButton>
            </div>
          </div>
          {dapp ? <Site dapp={dapp} linked={linked} onAct={() => act(dapp)} /> : <UnknownSite url={browser.url} />}
        </div>
      )}
    </div>
  );
}

function Site({ dapp, linked, onAct }: { dapp: Dapp; linked: boolean; onAct: () => void }) {
  const cta = linked ? actionLabel(dapp) : "Connect wallet";
  return (
    <div>
      <p className="font-mono text-xs tracking-widest text-muted uppercase">{dapp.category}</p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight">{dapp.name}</h2>
      <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">{dapp.blurb}</p>
      <div className="mt-6 rounded-card border border-line bg-surface p-4">
        <SiteBody dapp={dapp} />
        <div className="mt-4">
          <PrimaryButton onClick={onAct}>{cta}</PrimaryButton>
        </div>
      </div>
      <p className="mt-4 text-xs text-pretty text-muted">
        This is a sandbox simulation, not the live site. A production wallet would inject a provider here. The sandbox wallet cannot connect to real sites.
      </p>
    </div>
  );
}

function SiteBody({ dapp }: { dapp: Dapp }) {
  if (dapp.action === "perps") {
    return (
      <>
        <p className="text-xs text-muted">SOL-PERP</p>
        <p className="text-3xl font-semibold tabular-nums">{formatUsd(tokenBySymbol("SOL").priceUsd)}</p>
        <p className="mt-1 text-sm text-muted">5x long · escrows 0.50 SOL</p>
      </>
    );
  }
  if (dapp.action === "lend") {
    return (
      <>
        <p className="text-xs text-muted">USDC supply</p>
        <p className="text-3xl font-semibold tabular-nums">6.4%</p>
        <p className="mt-1 text-sm text-muted">Illustrative vault APY · supply up to 500 USDC</p>
      </>
    );
  }
  if (dapp.action === "nft-buy") {
    return (
      <>
        <div className="nft-night h-36 rounded-control border border-line" />
        <p className="mt-3 font-medium">Night Market #88</p>
        <p className="text-sm text-muted">120 USDC</p>
      </>
    );
  }
  if (dapp.action === "nft-list") {
    return (
      <>
        <div className="nft-keel h-36 rounded-control border border-line" />
        <p className="mt-3 font-medium">List Keel Pass #128</p>
        <p className="text-sm text-muted">Grants a marketplace delegate. No sale yet.</p>
      </>
    );
  }
  if (dapp.action === "tip") {
    return (
      <>
        <p className="font-medium">Tip the thread</p>
        <p className="mt-1 text-sm text-muted">0.05 SOL to the creator. You will see the debit before it signs.</p>
      </>
    );
  }
  if (dapp.action === "play") {
    return (
      <>
        <p className="font-medium">Session ticket</p>
        <p className="mt-1 text-sm text-muted">A message signature. Tokens do not move.</p>
      </>
    );
  }
  if (dapp.action === "drain") {
    return (
      <>
        <p className="font-medium">Bonus unlocked</p>
        <p className="mt-1 text-sm text-muted">Claim says 2 SOL. The simulation shows what the transaction actually does.</p>
      </>
    );
  }
  if (dapp.action === "stake-marinade" || dapp.action === "stake-jito") {
    const symbol = dapp.action === "stake-marinade" ? "mSOL" : dapp.id === "blaze" ? "bSOL" : "JitoSOL";
    return (
      <>
        <p className="text-xs text-muted">Deposit</p>
        <p className="text-3xl font-semibold">1 SOL</p>
        <p className="mt-1 text-sm text-muted">Receipt token {symbol}</p>
      </>
    );
  }
  return (
    <>
      <p className="font-medium">Trade on {dapp.name}</p>
      <p className="mt-1 text-sm text-muted">Hands you back to the native Jupiter swap, where the platform fee is attached.</p>
    </>
  );
}

function UnknownSite({ url }: { url: string }) {
  const setSheet = useVela((state) => state.setSheet);
  const priority = useVela((state) => state.priority);
  return (
    <div>
      <h2 className="text-3xl font-semibold tracking-tight text-balance">No adapter for this host</h2>
      <p className="mt-3 font-mono text-xs break-all text-muted">{url}</p>
      <p className="mt-3 text-sm text-pretty text-muted">
        A production webview would still load it sandboxed. Connection stays off until you accept a prompt. This preview can only request a sign-in message.
      </p>
      <div className="mt-6">
        <PrimaryButton
          onClick={() =>
            setSheet({
              kind: "sign",
              intent: {
                kind: "message",
                origin: url,
                site: url,
                verified: false,
                title: "Sign in",
                message: `Sign in to ${url}`,
                effects: [],
                authorities: [],
                networkFeeSol: priorityFeeSol(priority),
                warnings: [
                  {
                    level: "warn",
                    title: "Unverified domain",
                    detail: "Check every character of the host before you sign.",
                  },
                ],
              },
            })
          }
        >
          Request sign-in
        </PrimaryButton>
      </div>
    </div>
  );
}

function actionLabel(dapp: Dapp): string {
  if (dapp.action === "perps") return "Open long";
  if (dapp.action === "lend") return "Supply USDC";
  if (dapp.action === "nft-buy") return "Buy NFT";
  if (dapp.action === "nft-list") return "List NFT";
  if (dapp.action === "tip") return `Tip ${formatAmt(0.05)} SOL`;
  if (dapp.action === "play") return "Sign ticket";
  if (dapp.action === "drain") return "Claim bonus";
  if (dapp.action === "open-swap") return "Open SolPortal Swap";
  return "Stake 1 SOL";
}

function RealSiteNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`${compact ? "mt-2" : "mt-4"} text-sm leading-relaxed text-pretty text-muted`}>
      The real site opens in a separate browser tab. This sandbox wallet cannot connect to real sites, and nothing here signs or broadcasts a real transaction.
    </p>
  );
}
