import type { ComponentType, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useVela } from "@/lib/vela/store";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** Soft tile colors. Each is a background + foreground pair for a rounded-square icon. */
const TONES = {
  gold: "bg-[#e0b86a]/15 text-[#e0b86a]",
  emerald: "bg-emerald-400/15 text-emerald-300",
  sky: "bg-sky-400/15 text-sky-300",
  rose: "bg-rose-400/15 text-rose-300",
  amber: "bg-amber-400/15 text-amber-300",
  cyan: "bg-cyan-400/15 text-cyan-300",
  blue: "bg-blue-400/15 text-blue-300",
  orange: "bg-orange-400/15 text-orange-300",
  lime: "bg-lime-400/15 text-lime-300",
  teal: "bg-teal-400/15 text-teal-300",
  slate: "bg-slate-300/12 text-slate-300",
  red: "bg-danger/15 text-danger",
} as const;

export type Tone = keyof typeof TONES;

export function IconTile({ icon: Icon, tone, size = "md" }: { icon: IconType; tone: Tone; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "size-12 rounded-2xl" : "size-8 rounded-[10px]";
  const glyph = size === "lg" ? "size-[22px]" : "size-[17px]";
  return (
    <span className={`grid ${dims} shrink-0 place-items-center ${TONES[tone]}`}>
      <Icon className={glyph} aria-hidden />
    </span>
  );
}

/** Sticky back bar shared by every More sub-page. */
export function PageBar({ title, right }: { title: string; right?: ReactNode }) {
  const setMore = useVela((state) => state.setMore);
  return (
    <div className="sticky top-0 z-20 grid h-14 grid-cols-[3rem_1fr_3rem] items-center border-b border-line/60 bg-bg/85 px-2 backdrop-blur-md">
      <button
        type="button"
        aria-label="Back"
        onClick={() => setMore("root")}
        className="grid size-11 place-items-center rounded-full text-fg/90 active:bg-surface-2"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <h1 className="truncate text-center text-[17px] font-semibold tracking-tight">{title}</h1>
      <span className="flex justify-end">{right}</span>
    </div>
  );
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">{title}</h2>
      <ul className="overflow-hidden rounded-card border border-line/70 bg-surface/90">{children}</ul>
    </section>
  );
}

export function SettingsRow({
  icon,
  tone,
  title,
  subtitle,
  value,
  onClick,
  danger,
  chevron = true,
}: {
  icon: IconType;
  tone: Tone;
  title: string;
  subtitle?: string;
  value?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-surface-2"
      >
        <IconTile icon={icon} tone={tone} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] leading-tight font-medium ${danger ? "text-danger" : ""}`}>{title}</span>
          {subtitle ? <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span> : null}
        </span>
        {value !== undefined && value !== null ? (
          <span className="max-w-[40%] shrink-0 truncate text-sm text-muted tabular-nums">{value}</span>
        ) : null}
        {chevron ? <ChevronRight className="size-4 shrink-0 text-muted/70" aria-hidden /> : null}
      </button>
      <span aria-hidden className="absolute right-0 bottom-0 left-[3.75rem] h-px bg-line/70 group-last:hidden" />
    </li>
  );
}
