import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CATEGORIES, DIRECTORY, type Category } from "@/lib/vela/dapps";
import { useVela } from "@/lib/vela/store";
import { SectionLabel } from "@/components/vela/ui";

export function ExploreView() {
  const openDapp = useVela((state) => state.openDapp);
  const setSheet = useVela((state) => state.setSheet);
  const bookmarks = useVela((state) => state.bookmarks);
  const recents = useVela((state) => state.recents);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");

  const sponsored = DIRECTORY.filter((dapp) => dapp.sponsored);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DIRECTORY.filter((dapp) => (category === "All" ? true : dapp.category === category))
      .filter((dapp) => (q ? `${dapp.name} ${dapp.blurb} ${dapp.host}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.trending - a.trending);
  }, [category, query]);

  const recentDapps = recents
    .map((id) => DIRECTORY.find((dapp) => dapp.id === id))
    .filter((dapp): dapp is (typeof DIRECTORY)[number] => Boolean(dapp));

  return (
    <div className="px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <button className="h-11 text-sm text-accent" onClick={() => setSheet({ kind: "url" })}>
          Open link
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
        Tapping a dApp opens a sandbox preview. Use Open site there to visit the real page in a new tab. This sandbox wallet cannot connect to real sites.
      </p>
      <label className="mt-4 flex h-12 items-center gap-2 rounded-control border border-line bg-surface px-3">
        <Search className="size-4 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search dApps"
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm ${
              category === item ? "border-accent bg-accent text-on-accent" : "border-line text-muted"
            }`}
          >
            {item === "DEX" ? "DEXs / Perps" : item}
          </button>
        ))}
      </div>

      {bookmarks.length > 0 ? (
        <div className="mt-5">
          <SectionLabel>Bookmarks</SectionLabel>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {bookmarks.map((bookmark) => (
              <button
                key={bookmark.id}
                className="h-10 shrink-0 rounded-full border border-line px-3 text-sm"
                onClick={() => openDapp(bookmark.dappId)}
              >
                {bookmark.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {category === "All" && !query ? (
        <div className="mt-6">
          <SectionLabel>Sponsored</SectionLabel>
          <div className="mt-3 space-y-3">
            {sponsored.map((dapp) => (
              <button
                key={dapp.id}
                onClick={() => openDapp(dapp.id)}
                className="block w-full rounded-card border border-line bg-surface p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-xs tracking-widest text-accent uppercase">Sponsored</p>
                  <p className="text-xs text-muted">{dapp.category}</p>
                </div>
                <p className="mt-2 text-xl font-semibold">{dapp.name}</p>
                <p className="mt-1 text-sm text-pretty text-muted">{dapp.campaign}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {recentDapps.length > 0 && !query ? (
        <div className="mt-6">
          <SectionLabel>Recents</SectionLabel>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {recentDapps.map((dapp) => (
              <button
                key={dapp.id}
                className="h-10 shrink-0 rounded-full border border-line px-3 text-sm"
                onClick={() => openDapp(dapp.id)}
              >
                {dapp.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <SectionLabel>{query ? "Results" : "Trending"}</SectionLabel>
        <ul className="mt-3 divide-y divide-line rounded-card border border-line bg-surface">
          {list.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">Nothing in this category.</li>
          ) : (
            list.map((dapp, index) => (
              <li key={dapp.id}>
                <button className="flex w-full items-center gap-3 px-3 py-3 text-left" onClick={() => openDapp(dapp.id)}>
                  <span className="w-6 font-mono text-xs text-muted">{index + 1}</span>
                  <span className="grid size-10 place-items-center rounded-full bg-surface-2 font-semibold text-accent">
                    {dapp.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{dapp.name}</span>
                      {dapp.sponsored ? <span className="font-mono text-xs text-accent">Ad</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted">{dapp.blurb}</span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
