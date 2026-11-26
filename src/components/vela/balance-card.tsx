import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronDown, Copy, Palette } from "lucide-react";
import { CARD_SKINS, resolveCardSkin, type CardSkin } from "@/lib/vela/card-skins";
import { shortAddr } from "@/lib/vela/format";
import { useVela } from "@/lib/vela/store";
import type { ChartTheme } from "@/lib/vela/use-portfolio-history";
import { Mark, Overlay } from "@/components/vela/ui";

type SkinColors = {
  fg: string;
  muted: string;
  up: string;
  down: string;
  chip: string;
  chipBorder: string;
  scrim: string;
  /** Soft glow behind the big number so it separates from the engraving. */
  halo: string;
  chart: ChartTheme;
};

const LIGHT: SkinColors = {
  fg: "#121212",
  muted: "rgb(18 18 18 / 0.62)",
  up: "#0b7a3b",
  down: "#b42318",
  chip: "rgb(255 255 255 / 0.55)",
  chipBorder: "rgb(18 18 18 / 0.14)",
  scrim:
    "linear-gradient(0deg, rgb(236 236 232 / 0.72) 0%, rgb(236 236 232 / 0.45) 38%, rgb(236 236 232 / 0) 60%), linear-gradient(90deg, rgb(236 236 232 / 0.95) 0%, rgb(236 236 232 / 0.85) 42%, rgb(236 236 232 / 0.3) 70%, rgb(236 236 232 / 0) 88%)",
  halo: "0 0 14px rgb(236 236 232 / 0.9), 0 0 4px rgb(236 236 232 / 0.9)",
  chart: {
    line: "#6b4a0c",
    fillOpacity: 0.16,
    lineShadow: "drop-shadow(0 0 3px rgb(236 236 232 / 0.95))",
    tabActiveBg: "#1a1408",
    tabActiveFg: "#e0b86a",
    tabBg: "rgb(255 255 255 / 0.55)",
    tabBorder: "rgb(18 18 18 / 0.16)",
    tabFg: "rgb(18 18 18 / 0.7)",
  },
};

const DARK: SkinColors = {
  fg: "#f4efe6",
  muted: "rgb(244 239 230 / 0.68)",
  up: "#4ade80",
  down: "#ff7a5c",
  chip: "rgb(9 9 11 / 0.45)",
  chipBorder: "rgb(244 239 230 / 0.16)",
  halo: "0 1px 12px rgb(9 9 11 / 0.85)",
  chart: {
    line: "#f0cd85",
    fillOpacity: 0.14,
    lineShadow: "drop-shadow(0 0 4px rgb(9 9 11 / 0.9))",
    tabActiveBg: "var(--color-accent)",
    tabActiveFg: "var(--color-on-accent)",
    tabBg: "rgb(9 9 11 / 0.45)",
    tabBorder: "rgb(244 239 230 / 0.18)",
    tabFg: "rgb(244 239 230 / 0.75)",
  },
  scrim:
    "linear-gradient(90deg, rgb(9 9 11 / 0.88) 0%, rgb(9 9 11 / 0.7) 42%, rgb(9 9 11 / 0.12) 70%, rgb(9 9 11 / 0) 88%), linear-gradient(0deg, rgb(9 9 11 / 0.72) 0%, rgb(9 9 11 / 0.45) 38%, rgb(9 9 11 / 0) 60%)",
};

const CLASSIC: SkinColors = {
  ...DARK,
  up: "var(--color-accent)",
  down: "var(--color-danger)",
  chip: "var(--color-surface-2)",
  chipBorder: "var(--color-line)",
  scrim: "",
  halo: "none",
  chart: {
    line: null,
    fillOpacity: 0.22,
    lineShadow: "none",
    tabActiveBg: "var(--color-accent)",
    tabActiveFg: "var(--color-on-accent)",
    tabBg: "transparent",
    tabBorder: "var(--color-line)",
    tabFg: "var(--color-muted)",
  },
};

function paletteFor(skin: CardSkin): SkinColors {
  if (!skin.src) return CLASSIC;
  return skin.tone === "light" ? LIGHT : DARK;
}

function useActiveSkin(): CardSkin {
  const cardSkins = useVela((state) => state.cardSkins);
  const activeAccountId = useVela((state) => state.activeAccountId);
  return resolveCardSkin(cardSkins, activeAccountId);
}

/** Solflare-style balance card with engraved artwork behind the numbers. */
export function BalanceCard({
  label,
  address,
  onCopy,
  amount,
  change,
  chart,
  footer,
}: {
  label: string;
  address: string | null;
  onCopy: () => void;
  amount: ReactNode;
  /** Change line: text plus direction (`null` = neutral/muted). */
  change: { text: string; up: boolean | null } | null;
  /** Chart + range tabs, drawn inside the card with the skin's colors. */
  chart?: (theme: ChartTheme) => ReactNode;
  footer?: ReactNode;
}) {
  const skin = useActiveSkin();
  const colors = paletteFor(skin);
  const setSheet = useVela((state) => state.setSheet);
  const activeAccount = useVela((state) => state.accounts.find((account) => account.id === state.activeAccountId) ?? null);
  const chip: CSSProperties = { background: colors.chip, borderColor: colors.chipBorder, color: colors.fg };

  return (
    <section
      aria-label="Balance"
      data-skin={skin.id}
      className={`relative isolate overflow-hidden rounded-[28px] border ${
        skin.src ? "border-white/10" : "border-line bg-[radial-gradient(120%_90%_at_100%_0%,rgb(224_184_106/0.22),transparent_60%),linear-gradient(160deg,#1a1814,#0f0f11)]"
      }`}
      style={{ color: colors.fg }}
    >
      {skin.src ? (
        <>
          <img
            key={skin.id}
            src={skin.src}
            alt=""
            aria-hidden
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover object-right"
          />
          <div aria-hidden className="absolute inset-0 -z-10" style={{ background: colors.scrim }} />
        </>
      ) : null}

      <div className={`flex flex-col px-5 pt-4 pb-4 ${chart ? "h-[360px]" : "h-[244px]"}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2.5 text-left"
            onClick={() => setSheet({ kind: "wallets" })}
            aria-label="My wallets"
          >
            {activeAccount ? (
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold"
                style={{ borderColor: "var(--color-accent)", background: skin.tone === "light" && skin.src ? "#1a1814" : "var(--color-surface-2)", color: "var(--color-accent)" }}
              >
                {initials(activeAccount.name)}
              </span>
            ) : (
              <Mark className="size-9" />
            )}
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-sm font-semibold tracking-wide">
                <span className="truncate">{activeAccount?.name ?? "SolPortal"}</span>
                <ChevronDown className="size-3.5 shrink-0" style={{ color: colors.muted }} />
              </span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Card style"
            onClick={() => setSheet({ kind: "card-skin" })}
            className="grid size-9 shrink-0 place-items-center rounded-full border backdrop-blur-sm"
            style={chip}
          >
            <Palette className="size-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onCopy}
          disabled={!address}
          aria-label="Copy address"
          className="mt-2 inline-flex h-7 w-fit items-center gap-1.5 rounded-full border px-2.5 font-mono text-[11px] backdrop-blur-sm"
          style={chip}
        >
          {address ? shortAddr(address) : "—"}
          <Copy className="size-3" style={{ color: colors.muted }} />
        </button>

        <div className={chart ? "mt-4" : "mt-auto"}>
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase" style={{ color: colors.muted }}>
            Balance
          </p>
          <div className="mt-0.5 max-w-[78%] truncate text-[38px] leading-[1.08] font-semibold tracking-tight tabular-nums" style={{ textShadow: colors.halo }}>
            {amount}
          </div>
          {change ? (
            <p
              className="mt-1 text-sm font-medium tabular-nums"
              style={{ color: change.up === null ? colors.muted : change.up ? colors.up : colors.down }}
            >
              {change.text}
            </p>
          ) : null}
          {footer}
          {chart ? null : (
            <p className="mt-2 truncate font-mono text-[10px] tracking-wide" style={{ color: colors.muted }}>
              {label}
            </p>
          )}
        </div>
        {chart ? (
          <>
            <div className="mt-auto">{chart(colors.chart)}</div>
            <p className="mt-2 truncate font-mono text-[10px] tracking-wide" style={{ color: colors.muted }}>
              {label}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0]!.slice(0, 2) : `${parts[0]![0]}${parts[1]![0]}`).toUpperCase();
}

/** Bottom sheet with skin thumbnails. Opened from the card's palette button and More → Wallet → Card style. */
export function CardSkinSheet() {
  const setSheet = useVela((state) => state.setSheet);
  const setCardSkin = useVela((state) => state.setCardSkin);
  const active = useActiveSkin();
  return (
    <Overlay label="Card style" onClose={() => setSheet(null)}>
      <h2 className="text-xl font-semibold">Card style</h2>
      <p className="mt-1 text-sm text-muted">Pick the artwork behind your balance.</p>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {CARD_SKINS.map((skin) => {
          const selected = skin.id === active.id;
          return (
            <li key={skin.id}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={skin.name}
                onClick={() => setCardSkin(skin.id)}
                className="block w-full text-left"
              >
                <span
                  className={`relative block aspect-[16/10] overflow-hidden rounded-2xl border-2 ${
                    selected ? "border-accent" : "border-line"
                  }`}
                >
                  {skin.src ? (
                    <img src={skin.src} alt="" loading="lazy" decoding="async" className="size-full object-cover object-right" />
                  ) : (
                    <span className="block size-full bg-[radial-gradient(120%_90%_at_100%_0%,rgb(224_184_106/0.28),transparent_60%),linear-gradient(160deg,#1a1814,#0f0f11)]" />
                  )}
                  <span
                    className="absolute top-2 left-2.5 font-mono text-[11px] font-medium tabular-nums"
                    style={{ color: skin.tone === "light" && skin.src ? "#121212" : "#f4efe6" }}
                  >
                    $1,234
                  </span>
                  {selected ? (
                    <span className="absolute right-2 bottom-2 grid size-6 place-items-center rounded-full bg-accent text-on-accent">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
                <span className={`mt-1.5 block text-sm ${selected ? "font-semibold text-fg" : "text-muted"}`}>{skin.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Overlay>
  );
}
