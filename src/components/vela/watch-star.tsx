import { Star } from "lucide-react";
import { useVela, type WatchItem } from "@/lib/vela/store";

/** Star toggle for the shared watchlist. Stops the click so it can sit inside a tappable row. */
export function WatchStar({ item, size = "md" }: { item: Omit<WatchItem, "addedAt">; size?: "sm" | "md" }) {
  const starred = useVela((state) => state.watchlist.some((entry) => entry.mint === item.mint));
  const toggleWatch = useVela((state) => state.toggleWatch);
  const box = size === "sm" ? "size-9" : "size-11";
  return (
    <button
      type="button"
      aria-label={starred ? `Remove ${item.symbol} from watchlist` : `Add ${item.symbol} to watchlist`}
      aria-pressed={starred}
      onClick={(event) => {
        event.stopPropagation();
        toggleWatch(item);
      }}
      className={`grid ${box} shrink-0 place-items-center rounded-full ${starred ? "text-accent" : "text-muted"}`}
    >
      <Star className="size-5" fill={starred ? "currentColor" : "none"} />
    </button>
  );
}
