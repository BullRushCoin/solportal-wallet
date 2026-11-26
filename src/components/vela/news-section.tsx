import { useState } from "react";
import { hostOf } from "@/lib/vela/explore-search";
import { initialsOf } from "@/lib/vela/discover";
import { formatWhen } from "@/lib/vela/format";
import type { Headline, NewsSnapshot } from "@/lib/vela/social";
import { useVela } from "@/lib/vela/store";
import { SectionHeader } from "@/components/vela/explore-ui";

export function NewsSection({ news, failed }: { news: NewsSnapshot | null; failed: boolean }) {
  const [all, setAll] = useState(false);
  const headlines = news?.headlines ?? [];
  const shown = all ? headlines : headlines.slice(0, 4);
  return (
    <section className="mt-7 px-5">
      <SectionHeader
        title="News"
        onMore={headlines.length > 4 ? () => setAll((value) => !value) : undefined}
        right={
          headlines.length > 4 ? (
            <button type="button" onClick={() => setAll((value) => !value)} className="h-10 text-sm font-medium text-accent">
              {all ? "Show less" : "See all"}
            </button>
          ) : null
        }
      />
      <div className="mt-2 rounded-card border border-line bg-surface">
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{!news && !failed ? "Loading news…" : "No headlines right now."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((item) => (
              <li key={item.url}>
                <NewsRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NewsRow({ item }: { item: Headline }) {
  return (
    <button
      type="button"
      onClick={() => useVela.getState().openExternal(item.url)}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="line-clamp-3 text-sm leading-snug font-medium text-pretty">{item.title}</span>
        <span className="mt-1.5 block truncate text-xs text-muted">
          {item.source}
          {item.publishedAt ? ` · ${formatWhen(item.publishedAt)}` : ""}
        </span>
      </span>
      <NewsThumb item={item} />
    </button>
  );
}

/** Article image, then the source's favicon, then initials. */
function NewsThumb({ item }: { item: Headline }) {
  const host = hostOf(item.url);
  const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : null;
  const candidates = [item.image ?? null, favicon].filter((src): src is string => Boolean(src));
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];
  const isFavicon = src !== undefined && src === favicon;
  return (
    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface-2">
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={isFavicon ? "size-8 rounded-md" : "size-full object-cover"}
          onError={() => setAttempt((value) => value + 1)}
        />
      ) : (
        <span className="text-xs font-semibold text-accent">{initialsOf(item.source)}</span>
      )}
    </span>
  );
}
