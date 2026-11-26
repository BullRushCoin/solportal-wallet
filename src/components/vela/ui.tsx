import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { customTokenLookup, TOKEN_MAP } from "@/lib/vela/tokens";
import { useMarket } from "@/lib/vela/use-market";

export function Mark({ className }: { className?: string }) {
  return (
    <img src="/solportal-mark.jpg" alt="" className={`rounded-xl object-cover ${className ?? ""}`} />
  );
}

export function TokenMark({ symbol, src, small }: { symbol: string; src?: string | null; small?: boolean }) {
  const box = small ? "size-7 text-[10px]" : "size-10 text-xs";
  const market = useMarket();
  const image = src ?? market.tokens[symbol]?.image ?? customTokenLookup(symbol)?.image ?? null;
  const [failed, setFailed] = useState(false);
  const standard = TOKEN_MAP[symbol]?.standard;
  if (image && !failed) {
    return (
      <span className={`relative grid ${box} shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-2`}>
        <img src={image} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
        {standard === "token-2022" ? <span className="sr-only">Token-2022</span> : null}
      </span>
    );
  }
  return (
    <span className={`grid ${box} shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-accent`}>
      {symbol.slice(0, 1)}
      {standard === "token-2022" ? <span className="sr-only">Token-2022</span> : null}
    </span>
  );
}

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-12 w-full items-center justify-center rounded-control bg-accent px-4 text-base font-semibold text-on-accent disabled:opacity-40 ${className ?? ""}`}
    />
  );
}

export function GhostButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-12 w-full items-center justify-center rounded-control border border-line bg-surface px-4 text-base font-medium text-fg disabled:opacity-40 ${className ?? ""}`}
    />
  );
}

export function DangerButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-12 w-full items-center justify-center rounded-control border border-danger bg-transparent px-4 text-base font-semibold text-danger disabled:opacity-40 ${className ?? ""}`}
    />
  );
}

export function Overlay({
  label,
  children,
  onClose,
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-bg/80" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-label={label}
        className="sheet-body overflow-y-auto rounded-t-card border border-line bg-surface px-5 pt-3 pb-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="w-14 shrink-0" />
          <div className="mx-auto h-1 w-10 rounded-full bg-line" />
          <button
            type="button"
            aria-label="Close"
            className="h-11 shrink-0 px-2 text-sm text-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-xs tracking-widest text-muted uppercase">{children}</p>;
}
