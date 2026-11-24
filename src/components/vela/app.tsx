import { useEffect } from "react";
import { Clock, Compass, Ellipsis, ArrowLeftRight, Wallet } from "lucide-react";
import { ActivityView } from "@/components/vela/activity-view";
import { Blueprint } from "@/components/vela/blueprint";
import { BrowserView } from "@/components/vela/browser-view";
import { ExploreView } from "@/components/vela/explore-view";
import { HomeView } from "@/components/vela/home";
import { MoreView } from "@/components/vela/more-view";
import { Onboarding } from "@/components/vela/onboarding";
import { Sheets } from "@/components/vela/sheets";
import { SwapView } from "@/components/vela/swap-view";
import { useVela, type Tab } from "@/lib/vela/store";

const TABS: Array<{ id: Tab; label: string; icon: typeof Wallet }> = [
  { id: "home", label: "Home", icon: Wallet },
  { id: "explore", label: "Explore", icon: Compass },
  { id: "swap", label: "Swap", icon: ArrowLeftRight },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "more", label: "More", icon: Ellipsis },
];

export function VelaApp() {
  const wallet = useVela((state) => state.wallet);
  const watchAddress = useVela((state) => state.watchAddress);
  const tab = useVela((state) => state.tab);
  const setTab = useVela((state) => state.setTab);
  const toast = useVela((state) => state.toast);
  const setToast = useVela((state) => state.setToast);
  const browser = useVela((state) => state.browser);

  useEffect(() => {
    void useVela.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [setToast, toast]);

  return (
    <div className="min-h-dvh bg-bg text-fg lg:flex lg:h-dvh lg:overflow-hidden">
      <section className="relative mx-auto flex h-dvh w-full max-w-lg flex-col border-line lg:mx-0 lg:w-112 lg:max-w-none lg:shrink-0 lg:border-r">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {wallet || watchAddress ? <WalletBody tab={tab} /> : <Onboarding />}
        </div>
        {(wallet || watchAddress) && !browser ? <Nav tab={tab} onTab={setTab} /> : null}
        <Sheets />
        {wallet || watchAddress ? <BrowserView /> : null}
        {toast ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-24 z-50 rounded-control border border-line bg-surface px-4 py-3 text-sm">
            {toast}
          </div>
        ) : null}
      </section>
      <aside className="hidden min-h-0 flex-1 overflow-y-auto lg:block">
        <Blueprint />
      </aside>
    </div>
  );
}

function WalletBody({ tab }: { tab: Tab }) {
  if (tab === "home") return <HomeView />;
  if (tab === "explore") return <ExploreView />;
  if (tab === "swap") return <SwapView />;
  if (tab === "activity") return <ActivityView />;
  return <MoreView />;
}

function Nav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  return (
    <nav className="nav-safe grid grid-cols-5 border-t border-line bg-bg px-1">
      {TABS.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        const swap = item.id === "swap";
        return (
          <button
            key={item.id}
            onClick={() => onTab(item.id)}
            aria-label={item.label}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-fg" : "text-muted"}`}
          >
            <span className={swap ? "grid size-10 place-items-center rounded-full bg-accent text-on-accent" : ""}>
              <Icon className="size-5" />
            </span>
            {swap ? null : item.label}
          </button>
        );
      })}
    </nav>
  );
}
