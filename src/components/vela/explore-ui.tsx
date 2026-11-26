import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { initialsOf } from "@/lib/vela/discover";

/** "Title >" header. The whole title is the tap target when `onMore` is set. */
export function SectionHeader({ title, onMore, right }: { title: string; onMore?: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {onMore ? (
        <button type="button" onClick={onMore} className="-ml-1 inline-flex h-10 items-center gap-0.5 rounded-full px-1 text-left">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <ChevronRight className="size-5 text-muted" aria-hidden />
        </button>
      ) : (
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      )}
      {right}
    </div>
  );
}

/** Rounded-square app logo with an initials fallback when the image fails. */
export function AppLogo({ src, name, size = "md" }: { src?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "size-6 rounded-md text-[9px]" : size === "lg" ? "size-16 rounded-2xl text-base" : "size-11 rounded-xl text-xs";
  if (src && !failed) {
    return (
      <span className={`grid ${box} shrink-0 place-items-center overflow-hidden border border-line bg-surface-2`}>
        <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className={`grid ${box} shrink-0 place-items-center border border-line bg-surface-2 font-semibold text-accent`} aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

/** Round token image with a letter fallback. */
export function CoinImage({ src, symbol, small }: { src?: string | null; symbol: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const box = small ? "size-9" : "size-10";
  if (src && !failed) {
    return (
      <span className={`grid ${box} shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2`}>
        <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    );
  }
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-xs text-accent`} aria-hidden>
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Signed % in green or red, or "—" when unknown. */
export function ChangeText({ pct, className }: { pct: number | null | undefined; className?: string }) {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return <span className={`text-muted ${className ?? ""}`}>—</span>;
  return (
    <span className={`tabular-nums ${pct >= 0 ? "text-emerald-400" : "text-danger"} ${className ?? ""}`}>
      {pct > 0 ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}
