import { useState } from "react";
import { isSolanaAddress } from "@/lib/vela/address";
import { useVela } from "@/lib/vela/store";
import { GhostButton, PrimaryButton } from "@/components/vela/ui";

export function WatchAddressForm({
  compact = false,
  onWatched,
}: {
  compact?: boolean;
  onWatched?: () => void;
}) {
  const current = useVela((state) => state.watchAddress);
  const setWatchAddress = useVela((state) => state.setWatchAddress);
  const setToast = useVela((state) => state.setToast);
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState("");

  function submit() {
    const address = value.trim();
    if (!isSolanaAddress(address)) {
      setError("Enter a valid Solana address. Public keys only — never a recovery phrase.");
      return;
    }
    setError("");
    setWatchAddress(address);
    setToast("Viewing a public address. No keys, nothing broadcasts.");
    onWatched?.();
  }

  function clear() {
    setWatchAddress(null);
    setValue("");
    setError("");
    setToast("Back to the sandbox wallet.");
  }

  return (
    <form
      className={compact ? "rounded-card border border-line bg-surface p-4" : "mt-4"}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="block text-xs text-muted" htmlFor="watch-address">
        Watch a public address
      </label>
      <p className="mt-1 text-xs text-pretty text-muted">
        Paste any Solana wallet to see live holdings, logos, and NFT images. Read-only — this app cannot sign or send.
      </p>
      <input
        id="watch-address"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError("");
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Solana address"
        className="mt-3 h-12 w-full rounded-control border border-line bg-bg px-3 font-mono text-sm outline-none"
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <PrimaryButton type="submit">Watch address</PrimaryButton>
        {current ? (
          <GhostButton type="button" onClick={clear}>
            Back to sandbox
          </GhostButton>
        ) : null}
      </div>
    </form>
  );
}
