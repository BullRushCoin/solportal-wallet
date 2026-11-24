export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.01 ? 4 : 2;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

export function formatChangePct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Compact USD for TVL, volume, and open interest ($1.2B, $270.4M, $80.5K). */
export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1000) return `${sign}${formatUsd(abs)}`;
  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [unit, suffix] of units) {
    if (abs >= unit) {
      const scaled = abs / unit;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      const body = scaled.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      });
      return `${sign}$${body}${suffix}`;
    }
  }
  return `${sign}${formatUsd(abs)}`;
}

export function formatAmt(value: number, maxDigits = 4): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (abs < 0.0001) return value.toExponential(2);
  return value.toLocaleString("en-US", { maximumFractionDigits: maxDigits });
}

export function shortAddr(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatWhen(ts: number): string {
  const delta = Date.now() - ts;
  const min = Math.round(delta / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function uid(): string {
  return crypto.randomUUID();
}
