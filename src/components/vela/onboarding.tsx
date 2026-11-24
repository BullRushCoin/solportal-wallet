import { useMemo, useState } from "react";
import { Fingerprint, KeyRound, ShieldAlert } from "lucide-react";
import { WORDLIST, generatePhrase, parseSandboxPhrase } from "@/lib/vela/crypto";
import { useVela, type WalletMode } from "@/lib/vela/store";
import { GhostButton, Mark, PrimaryButton, SectionLabel } from "@/components/vela/ui";
import { WatchAddressForm } from "@/components/vela/watch-address";

type Step = "intro" | "phrase" | "verify" | "import" | "passkey" | "watch";

export function Onboarding() {
  const createWallet = useVela((state) => state.createWallet);
  const [step, setStep] = useState<Step>("intro");
  const [phrase, setPhrase] = useState<string[]>(() => generatePhrase());
  const [checks, setChecks] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [importText, setImportText] = useState("");
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const quiz = useMemo(() => {
    return checks.map((index) => {
      const answer = phrase[index] ?? "keel";
      const decoys = WORDLIST.filter((word) => word !== answer).slice(index, index + 3);
      const options = [answer, ...decoys].slice(0, 4);
      return { index, answer, options: hashOrder(options, index) };
    });
  }, [checks, phrase]);

  async function finish(mode: WalletMode, words: string[] | null) {
    setBusy(true);
    setError("");
    try {
      await createWallet(mode, words);
    } catch {
      setError("Could not create the sandbox wallet.");
      setBusy(false);
    }
  }

  function startCreate() {
    const next = generatePhrase();
    const positions = [2, 6, 10];
    setPhrase(next);
    setChecks(positions);
    setRound(0);
    setAck(false);
    setStep("phrase");
  }

  function pick(option: string) {
    const current = quiz[round];
    if (!current) return;
    if (option !== current.answer) {
      setError(`Word ${current.index + 1} does not match. Check the phrase.`);
      return;
    }
    setError("");
    if (round + 1 >= quiz.length) {
      void finish("seed", phrase);
      return;
    }
    setRound(round + 1);
  }

  function submitImport() {
    const result = parseSandboxPhrase(importText, ack);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    void finish("imported", result.words);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-5 pt-8 pb-8">
      <div className="mb-8 flex items-center gap-3">
        <Mark className="size-11" />
        <div>
          <p className="text-sm font-semibold tracking-widest">SOLPORTAL</p>
          <p className="font-mono text-xs text-muted">Non-custodial · sandbox</p>
        </div>
      </div>

      {step === "intro" ? (
        <>
          <h1 className="max-w-xs text-4xl font-semibold tracking-tight text-balance">
            Keys stay on this device.
          </h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-pretty text-muted">
            A Solana wallet with Jupiter swaps, liquid staking, and an Explore browser that simulates every signature before you approve it.
          </p>
          <div className="mt-8 rounded-card border border-line bg-surface p-4">
            <div className="flex gap-3">
              <ShieldAlert className="size-5 shrink-0 text-danger" />
              <p className="text-sm leading-relaxed text-pretty text-fg">
                This preview does not broadcast transactions or create a real key. Do not send funds to any address it shows.
              </p>
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-8">
            <PrimaryButton onClick={startCreate}>
              <KeyRound className="mr-2 size-4" />
              Create with a seed phrase
            </PrimaryButton>
            <GhostButton onClick={() => setStep("passkey")}>
              <Fingerprint className="mr-2 size-4" />
              Use a passkey wallet
            </GhostButton>
            <button className="h-11 text-sm text-muted" onClick={() => setStep("import")}>
              Import a sandbox phrase
            </button>
            <button className="h-11 text-sm text-muted" onClick={() => setStep("watch")}>
              Watch a public address
            </button>
          </div>
        </>
      ) : null}

      {step === "phrase" ? (
        <>
          <SectionLabel>Write it down</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">12 sandbox words</h1>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
            Not a valid BIP39 phrase and not a Solana derivation. It only unlocks this demo on this device.
          </p>
          <ol className="mt-5 grid grid-cols-2 gap-2">
            {phrase.map((word, index) => (
              <li key={`${word}-${index}`} className="flex items-baseline gap-2 rounded-control border border-line bg-surface px-3 py-2">
                <span className="font-mono text-xs text-muted">{index + 1}</span>
                <span className="font-medium">{word}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-3">
            <PrimaryButton
              onClick={() => {
                setRound(0);
                setError("");
                setStep("verify");
              }}
            >
              I wrote it down
            </PrimaryButton>
            <GhostButton onClick={() => setStep("intro")}>Back</GhostButton>
          </div>
        </>
      ) : null}

      {step === "verify" && quiz[round] ? (
        <>
          <SectionLabel>Confirm</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
            Select word {quiz[round].index + 1}
          </h1>
          <p className="mt-3 text-sm text-muted">
            Check {round + 1} of {quiz.length}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {quiz[round].options.map((option) => (
              <button
                key={option}
                className="h-12 rounded-control border border-line bg-surface font-medium"
                onClick={() => pick(option)}
                disabled={busy}
              >
                {option}
              </button>
            ))}
          </div>
          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        </>
      ) : null}

      {step === "import" ? (
        <>
          <SectionLabel>Import</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Sandbox phrase only</h1>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-danger">
            Do not paste a real recovery phrase. Words are stored in this browser so the demo can reopen. They are not encrypted and they do not control funds.
          </p>
          <textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder="twelve sandbox words"
            className="mt-4 h-28 w-full resize-none rounded-card border border-line bg-bg px-3 py-3 text-sm text-fg outline-none"
          />
          <label className="mt-4 flex items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={ack}
              onChange={(event) => setAck(event.target.checked)}
              className="mt-1 size-4 accent-accent"
            />
            I am not entering a real seed phrase.
          </label>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-3">
            <PrimaryButton disabled={busy} onClick={submitImport}>
              Import sandbox wallet
            </PrimaryButton>
            <GhostButton onClick={() => setStep("intro")}>Back</GhostButton>
          </div>
        </>
      ) : null}

      {step === "passkey" ? (
        <>
          <SectionLabel>Embedded wallet</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Passkey, no phrase</h1>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
            Production wraps the key with a WebAuthn PRF secret so a server can store ciphertext and still never see the key. This sandbox only mints a device-bound label.
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            <li className="rounded-control border border-line bg-surface px-3 py-3">Add a second device later by unwrapping with the same passkey.</li>
            <li className="rounded-control border border-line bg-surface px-3 py-3">There is no seed to screenshot, and no seed to phish.</li>
          </ul>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <div className="mt-6 flex flex-col gap-3">
            <PrimaryButton disabled={busy} onClick={() => void finish("passkey", null)}>
              Create passkey wallet
            </PrimaryButton>
            <GhostButton onClick={() => setStep("intro")}>Back</GhostButton>
          </div>
        </>
      ) : null}

      {step === "watch" ? (
        <>
          <SectionLabel>Read only</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">Watch a public address</h1>
          <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">
            See live holdings, logos, and NFT images for any Solana address. No keys are created or used, and nothing is signed or broadcast.
          </p>
          <WatchAddressForm />
          <div className="mt-6">
            <GhostButton onClick={() => setStep("intro")}>Back</GhostButton>
          </div>
        </>
      ) : null}
    </div>
  );
}

function hashOrder(words: string[], salt: number): string[] {
  return [...words].sort((a, b) => ((a.charCodeAt(0) + salt) % 7) - ((b.charCodeAt(0) + salt) % 7));
}
