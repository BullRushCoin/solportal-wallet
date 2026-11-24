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
