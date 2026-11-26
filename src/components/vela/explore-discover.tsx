import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { dappById } from "@/lib/vela/dapps";
import { DISCOVER_TABS, appsForTab, discoverAppForDapp, type DiscoverApp, type DiscoverTab } from "@/lib/vela/discover";
import { useVela } from "@/lib/vela/store";
import { AppLogo, SectionHeader } from "@/components/vela/explore-ui";

function openApp(app: DiscoverApp) {
  const state = useVela.getState();
  if (app.dappId && dappById(app.dappId)) state.openDapp(app.dappId);
  else state.openExternal(app.url);
}

export function AppRow({ app }: { app: DiscoverApp }) {
  return (
    <button type="button" onClick={() => openApp(app)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
      <AppLogo src={app.logo} name={app.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{app.name}</span>
        <span className="block truncate text-xs text-muted">{app.tagline}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
    </button>
  );
}

export function Discover() {
  const [tab, setTab] = useState<DiscoverTab>("Featured");
  const [all, setAll] = useState(false);
  const apps = appsForTab(tab);
  const shown = all ? apps : apps.slice(0, 6);
  return (
    <section className="mt-7 px-5">
      <SectionHeader title="Discover" onMore={() => setAll((value) => !value)} />
      <div role="tablist" aria-label="App categories" className="mt-2 grid grid-cols-6 rounded-full border border-line bg-surface p-1">
          {DISCOVER_TABS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => {
                setTab(item);
                setAll(false);
              }}
              className={`h-8 min-w-0 rounded-full px-0.5 text-[12px] font-medium tracking-tight transition ${tab === item ? "bg-surface-2 text-fg shadow-[inset_0_0_0_1px_rgb(224_184_106/0.5)]" : "text-muted"}`}
            >
              {item}
            </button>
          ))}
      </div>
      <div className="mt-3 rounded-card border border-line bg-surface">
        <ul className="divide-y divide-line">
          {shown.map((app) => (
            <li key={app.id}>
              <AppRow app={app} />
            </li>
          ))}
        </ul>
        {apps.length > 6 ? (
          <button type="button" onClick={() => setAll((value) => !value)} className="h-11 w-full border-t border-line text-sm font-medium text-accent">
            {all ? "Show less" : `See all ${apps.length}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function Recents() {
  const recents = useVela((state) => state.recents);
  const openDapp = useVela((state) => state.openDapp);
  const items = recents
    .map((id) => {
      const dapp = dappById(id);
      if (!dapp || !dapp.listed) return null;
      return { id, name: dapp.name, logo: discoverAppForDapp(id)?.logo ?? null };
    })
    .filter((item): item is { id: string; name: string; logo: string | null } => item !== null);
  if (items.length === 0) return null;
  return (
    <section className="mt-7">
      <div className="px-5">
        <SectionHeader title="Recents" />
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openDapp(item.id)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface pr-3.5 pl-1.5 text-sm"
          >
            <AppLogo src={item.logo} name={item.name} size="sm" />
            {item.name}
          </button>
        ))}
      </div>
    </section>
  );
}
