import { useState } from "react";
import type { NewsSnapshot } from "@/lib/vela/social";
import { useVisiblePoll } from "@/lib/vela/use-live";

export type NewsState = { news: NewsSnapshot | null; failed: boolean };

/** /api/news (RSS headlines + Jupiter 1h trending), polled every 5 minutes while visible. */
export function useNews(ms = 5 * 60_000): NewsState {
  const [state, setState] = useState<NewsState>({ news: null, failed: false });
  useVisiblePoll(() => {
    void fetch("/api/news")
      .then((res) => (res.ok ? (res.json() as Promise<NewsSnapshot>) : Promise.reject(new Error("news"))))
      .then((news) => setState({ news, failed: false }))
      .catch(() => setState((prev) => ({ ...prev, failed: true })));
  }, ms);
  return state;
}
