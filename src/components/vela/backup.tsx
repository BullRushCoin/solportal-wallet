import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { WORDLIST } from "@/lib/vela/crypto";
import { useVela } from "@/lib/vela/store";
import { GhostButton, Overlay, PrimaryButton, SectionLabel } from "@/components/vela/ui";

/** Gold SolPortal coin turning slowly on its axis. */
export function SpinningCoin({ size = 200 }: { size?: number }) {
  return (
    <div className="grid place-items-center" style={{ perspective: 900 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <div aria-hidden className="absolute inset-[12%] rounded-full bg-[#e0b86a]/25 blur-3xl" />
        <div className="coin-spin relative size-full">
          <img src="/coin-face.webp" alt="" draggable={false} className="absolute inset-0 size-full [backface-visibility:hidden]" />
          <img
            src="/coin-face.webp"
            alt=""
            draggable={false}
            className="absolute inset-0 size-full [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
          />
        </div>
      </div>
    </div>
  );
}

/** "Keep your funds safe" screen shown right after a seed wallet is generated. */
export function BackupPrompt({ onBackup, onSkip, busy }: { onBackup: () => void; onSkip: () => void; busy?: boolean }) {
  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex flex-1 items-center justify-center py-8">
        <SpinningCoin />
      </div>
      <h1 className="text-center text-2xl font-semibold tracking-tight">Keep your funds safe</h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-relaxed text-pretty text-muted">
        If you get logged out, only your recovery phrase can restore your wallet. Write it down now and don't risk losing everything.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <PrimaryButton onClick={onBackup} disabled={busy}>
          Backup now
        </PrimaryButton>
        <GhostButton onClick={onSkip} disabled={busy}>
          Skip for now
        </GhostButton>
      </div>
    </div>
  );
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pickChecks(length: number): number[] {
  return shuffle(Array.from({ length }, (_, i) => i))
    .slice(0, 3)
    .sort((a, b) => a - b);
}

/** Show the phrase, then check 3 words. Wrong picks flash red and reshuffle. */
export function BackupFlow({ phrase, onDone, onCancel }: { phrase: string[]; onDone: () => void; onCancel: () => void }) {
  const [stage, setStage] = useState<"phrase" | "verify">("phrase");
  const [checks, setChecks] = useState(() => pickChecks(phrase.length));
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const [error, setError] = useState("");

  const current = useMemo(() => {
    const index = checks[round];
    if (index === undefined) return null;
    const answer = phrase[index]!;
    const pool = WORDLIST.filter((word) => !phrase.includes(word));
    return { index, answer, options: shuffle([answer, ...shuffle(pool).slice(0, 3)]) };
    // attempt reshuffles the options after a wrong pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks, round, phrase, attempt]);

  function pick(option: string) {
    if (!current || wrong) return;
    if (option !== current.answer) {
      setError(`Word ${current.index + 1} does not match. Try again, or go back to check your phrase.`);
      setWrong(option);
      window.setTimeout(() => {
        setWrong(null);
        setAttempt((value) => value + 1);
      }, 700);
      return;
    }
    setError("");
    if (round + 1 >= checks.length) onDone();
    else setRound(round + 1);
  }

  if (stage === "phrase") {
    return (
      <div>
        <SectionLabel>Write it down</SectionLabel>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Your recovery phrase</h2>
        <p className="mt-2 flex gap-2 text-sm leading-relaxed text-muted">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          Sandbox words for this demo only. Never share a real phrase with anyone.
        </p>
        <ol className="mt-4 grid grid-cols-2 gap-2">
          {phrase.map((word, index) => (
            <li key={`${word}-${index}`} className="flex items-baseline gap-2 rounded-control border border-line bg-surface-2 px-3 py-2">
              <span className="font-mono text-xs text-muted">{index + 1}</span>
              <span className="font-medium">{word}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-3">
          <PrimaryButton
            onClick={() => {
              setChecks(pickChecks(phrase.length));
              setRound(0);
              setError("");
              setStage("verify");
            }}
          >
            I wrote it down
          </PrimaryButton>
          <GhostButton onClick={onCancel}>Later</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Confirm</SectionLabel>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Select word {current ? current.index + 1 : ""}</h2>
      <p className="mt-2 text-sm text-muted">
        Check {round + 1} of {checks.length}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {current?.options.map((option) => (
          <button
            key={`${attempt}-${option}`}
            type="button"
            className={`h-12 rounded-control border font-medium transition-colors ${
              wrong === option ? "animate-pulse border-danger bg-danger/15 text-danger" : "border-line bg-surface-2"
            }`}
            onClick={() => pick(option)}
            disabled={Boolean(wrong)}
          >
            {option}
          </button>
        ))}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <button
        type="button"
        className="mt-4 text-sm text-accent"
        onClick={() => {
          setError("");
          setStage("phrase");
        }}
      >
        Show my phrase again
      </button>
    </div>
  );
}

export function BackupSheet() {
  const setSheet = useVela((state) => state.setSheet);
  const markBackedUp = useVela((state) => state.markBackedUp);
  const phrase = useVela((state) => state.wallet?.phrase ?? null);
  const close = () => setSheet(null);
  return (
    <Overlay label="Back up wallet" onClose={close}>
      {phrase ? (
        <BackupFlow phrase={phrase} onDone={markBackedUp} onCancel={close} />
      ) : (
        <p className="text-sm text-muted">This wallet has no recovery phrase to back up.</p>
      )}
    </Overlay>
  );
}

/** Home reminder shown until a skipped backup is completed. */
export function BackupNudge() {
  const needs = useVela((state) => state.wallet?.mode === "seed" && state.wallet.backedUp === false && !state.watchAddress);
  const setSheet = useVela((state) => state.setSheet);
  if (!needs) return null;
  return (
    <button
      type="button"
      onClick={() => setSheet({ kind: "backup" })}
      className="mt-4 flex w-full items-center gap-3 rounded-card border border-danger/40 bg-danger/10 p-3 text-left"
    >
      <img src="/coin-face.webp" alt="" className="size-10 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Back up your wallet</span>
        <span className="block truncate text-xs text-muted">Without your phrase, a logout means losing it all.</span>
      </span>
      <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent">Back up</span>
    </button>
  );
}
