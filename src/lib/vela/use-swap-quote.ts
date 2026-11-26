import { useCallback, useEffect, useRef, useState } from "react";
import type { JupiterQuote } from "@/lib/vela/jupiter";
import { mapJupiterQuote, QUOTE_REFRESH_MS, uiToRaw, type SwapQuoteView, type SwapSide } from "@/lib/vela/swap-quote";

export type QuoteStatus = "idle" | "loading" | "live" | "estimated";

const DEBOUNCE_MS = 400;

/**
 * Live Jupiter quote for the Swap tab. Debounces typing, refreshes every 10 s while the page is
 * visible, and falls back to `fallback()` (the local estimate) only when the live quote fails.
 */
export function useSwapQuote(args: {
  input: SwapSide | null;
  output: SwapSide | null;
  amountText: string;
  slippageBps: number;
  fallback: () => SwapQuoteView | null;
}) {
  const { input, output, amountText, slippageBps } = args;
  const fallbackRef = useRef(args.fallback);
  fallbackRef.current = args.fallback;

  const [debounced, setDebounced] = useState(amountText);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(amountText), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [amountText]);

  const raw = input ? uiToRaw(debounced, input.decimals) : null;
  const key = input && output && raw && input.mint !== output.mint ? `${input.mint}|${output.mint}|${raw}|${slippageBps}` : null;

  const [quote, setQuote] = useState<SwapQuoteView | null>(null);
  const [status, setStatus] = useState<QuoteStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nextAt, setNextAtState] = useState<number | null>(null);
  const nextAtRef = useRef<number | null>(null);
  const setNextAt = useCallback((value: number | null) => {
    nextAtRef.current = value;
    setNextAtState(value);
  }, []);
  const [now, setNow] = useState(() => Date.now());
  const controller = useRef<AbortController | null>(null);
  const sides = useRef({ input, output });
  sides.current = { input, output };

  const run = useCallback(async () => {
    if (!key) return;
    const [inputMint, outputMint, amount, slippage] = key.split("|");
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setStatus((prev) => (prev === "idle" ? "loading" : prev));
    setNextAt(Date.now() + QUOTE_REFRESH_MS);
    try {
      const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: slippage });
      const res = await fetch(`/api/quote?${params.toString()}`, { signal: ctrl.signal, cache: "no-store" });
      const body = (await res.json().catch(() => null)) as { quote?: JupiterQuote; error?: string } | null;
      if (ctrl.signal.aborted) return;
      const { input: inSide, output: outSide } = sides.current;
      if (!res.ok || !body?.quote || !inSide || !outSide) throw new Error(body?.error ?? "Quote unavailable");
      setQuote(mapJupiterQuote(body.quote, inSide, outSide));
      setStatus("live");
      setError(null);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const estimate = fallbackRef.current();
      setQuote(estimate);
      setStatus(estimate ? "estimated" : "idle");
      setError(err instanceof Error ? err.message : "Quote unavailable");
    }
  }, [key, setNextAt]);

  // New pair, amount or slippage: drop the old quote and fetch right away.
  useEffect(() => {
    controller.current?.abort();
    setQuote(null);
    setError(null);
    if (!key) {
      setStatus("idle");
      setNextAt(null);
      return;
    }
    setStatus("loading");
    void run();
  }, [key, run, setNextAt]);

  // 1 s clock for the countdown; refresh when due and the page is visible.
  useEffect(() => {
    if (!key) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (document.visibilityState !== "visible") return;
      const due = nextAtRef.current;
      if (due !== null && t >= due) void run();
    };
    const timer = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key, run]);

  useEffect(() => () => controller.current?.abort(), []);

  const secondsLeft = nextAt === null ? null : Math.max(0, Math.ceil((nextAt - now) / 1000));
  const pending = amountText !== debounced;
  return { quote, status, error, secondsLeft, refresh: run, pending };
}
