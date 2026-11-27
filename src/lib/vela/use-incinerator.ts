import { useEffect, useMemo, useState } from "react";
import { sandboxIncineratorInputs, type IncineratorInput, type IncineratorPlan } from "@/lib/vela/incinerator";
import { useVela } from "@/lib/vela/store";

export function useIncinerator(options: { address?: string | null; holdings?: Record<string, number> | null }) {
  const { address, holdings } = options;
  const customTokens = useVela((state) => state.customTokens);
  const [data, setData] = useState<IncineratorPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tokenKey = useMemo(() => {
    if (address) return "";
    if (!holdings) return "";
    return sandboxIncineratorInputs(holdings, customTokens)
      .map((item) => `${item.mint}:${item.amount}`)
      .join("|");
  }, [address, holdings, customTokens]);

  useEffect(() => {
    const controller = new AbortController();
    const inputs: IncineratorInput[] = !address && holdings ? sandboxIncineratorInputs(holdings, customTokens) : [];
    if (!address && inputs.length === 0) {
      setData(null);
      setError(null);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    setError(null);
    const request = address
      ? fetch(`/api/incinerator?address=${encodeURIComponent(address)}`, { signal: controller.signal })
      : fetch("/api/incinerator", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tokens: inputs }),
          signal: controller.signal,
        });
    void request
      .then(async (res) => {
        const body = (await res.json()) as IncineratorPlan & { error?: string };
        if (!res.ok) throw new Error(body.error || "Failed to load incinerator data.");
        return body;
      })
      .then((plan) => {
        if (!controller.signal.aborted) setData(plan);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to load incinerator data.";
        setError(message === "Failed to fetch" ? "Could not reach the incinerator service. Try again." : message);
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [address, tokenKey, holdings, customTokens]);

  return { data, error, loading };
}
