import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Send } from "lucide-react";
import { isUrgent, looksLikePhrase, matchSupport, SUPPORT_ARTICLES } from "@/lib/vela/support-kb";
import { useVela } from "@/lib/vela/store";
import { PrimaryButton } from "@/components/vela/ui";

type Msg = { id: number; from: "bot" | "user"; text: string };
type Mode = "chat" | "helped" | "escalate" | "sent";

const QUICK = ["fees", "swap", "phrase", "wallets", "missing", "stake"];

let nextId = 1;
const bot = (text: string): Msg => ({ id: nextId++, from: "bot", text });
const user = (text: string): Msg => ({ id: nextId++, from: "user", text });

export function SupportChat() {
  const activeAddress = useVela((state) => state.watchAddress ?? state.wallet?.address ?? "");
  const [messages, setMessages] = useState<Msg[]>(() => [
    bot("Hi! I'm the SolPortal help bot. Ask me anything, or pick a topic. If it's something I can't solve, I'll pass it to the team."),
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [misses, setMisses] = useState(0);
  const [lastQuestion, setLastQuestion] = useState("");
  const [topic, setTopic] = useState("General");
  const [question, setQuestion] = useState("");
  const [contact, setContact] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, mode]);

  function say(...items: Msg[]) {
    setMessages((prev) => [...prev, ...items]);
  }

  function escalate(text: string, why: string) {
    setQuestion(text);
    setError("");
    setMode("escalate");
    say(bot(why));
  }

  function ask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setInput("");
    if (looksLikePhrase(text)) {
      say(bot("That looks like a recovery phrase, so I didn't keep it. Never share your phrase with anyone, including support. If someone else has seen it, move your funds to a new wallet now."));
      return;
    }
    say(user(text));
    const combined = lastQuestion && misses > 0 ? `${lastQuestion}. ${text}` : text;
    setLastQuestion(combined);

    if (isUrgent(text)) {
      const match = matchSupport(text);
      setTopic(match?.article.title ?? "Urgent");
      escalate(combined, "That sounds important, so I'll send it straight to the team. Add any details below, like the coin, amount, and roughly when it happened, plus how to reach you.");
      return;
    }

    const match = matchSupport(text);
    if (match) {
      setTopic(match.article.title);
      setMisses(0);
      say(bot(match.article.answer), bot("Did that answer your question?"));
      setMode("helped");
      return;
    }

    if (misses >= 1) {
      setTopic("General");
      escalate(combined, "I don't have a good answer for that one. I'll send it to the team so a person can help.");
      return;
    }
    setMisses(misses + 1);
    say(bot("I want to get this right. What were you trying to do: swap, send, stake, buy, or something else? And what happened instead?"));
  }

  async function submit() {
    if (sending) return;
    if (looksLikePhrase(question)) {
      setError("That looks like a recovery phrase. Remove it, never share it.");
      return;
    }
    if (question.trim().length < 5) {
      setError("Tell us a little about the issue.");
      return;
    }
    setSending(true);
    setError("");
    const transcript = messages.map((m) => `${m.from === "bot" ? "Bot" : "User"}: ${m.text}`).join("\n");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, contact, topic, wallet: activeAddress, transcript, website: honeypot }),
      });
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) throw new Error(out.error || "Couldn't send. Try again shortly.");
      setMode("sent");
      say(
        bot(
          contact
            ? "Sent to the SolPortal team. They'll get back to you at the contact you gave."
            : "Sent to the SolPortal team. You didn't leave a contact, so check back here or send another message with one.",
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send. Try again shortly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      <div className="flex-1 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed text-pretty ${
                m.from === "user" ? "bg-accent text-on-accent" : "border border-line bg-surface"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}

        {mode === "chat" && messages.length === 1 ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {QUICK.map((id) => {
              const article = SUPPORT_ARTICLES.find((a) => a.id === id)!;
              return (
                <button key={id} type="button" className="h-9 rounded-full border border-line px-3 text-xs" onClick={() => ask(article.title)}>
                  {article.title}
                </button>
              );
            })}
          </div>
        ) : null}

        {mode === "helped" ? (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="h-9 rounded-full border border-line px-4 text-xs"
              onClick={() => {
                say(user("Yes, thanks"), bot("Glad that helped. Anything else?"));
                setLastQuestion("");
                setMode("chat");
              }}
            >
              Yes, thanks
            </button>
            <button
              type="button"
              className="h-9 rounded-full border border-line px-4 text-xs"
              onClick={() => {
                say(user("Not really"));
                escalate(lastQuestion, "Sorry about that. I'll pass this to the team. Add any details that would help below.");
              }}
            >
              Not really
            </button>
          </div>
        ) : null}

        {mode === "escalate" ? (
          <form
            className="mt-2 space-y-2 rounded-card border border-line bg-surface p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <LifeBuoy className="size-4 text-accent" /> Contact support
            </p>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={2000}
              className="h-24 w-full resize-none rounded-control border border-line bg-bg px-3 py-2 text-sm outline-none"
              placeholder="What happened?"
            />
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              maxLength={200}
              autoCapitalize="off"
              className="h-10 w-full rounded-control border border-line bg-bg px-3 text-sm outline-none"
              placeholder="Your email or X handle (so we can reply)"
            />
            <input
              tabIndex={-1}
              aria-hidden="true"
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
              className="hidden"
              name="website"
            />
            <p className="text-xs text-muted">Never include your recovery phrase. Support will never ask for it.</p>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <PrimaryButton type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send to support"}
            </PrimaryButton>
            <button type="button" className="h-9 w-full text-xs text-muted" onClick={() => setMode("chat")}>
              Keep chatting instead
            </button>
          </form>
        ) : null}
        <div ref={endRef} />
      </div>

      {mode !== "escalate" ? (
        <form
          className="sticky bottom-0 mt-4 flex items-center gap-2 bg-bg pt-2 pb-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode !== "chat") setMode("chat");
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={500}
            placeholder="Ask a question"
            className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none"
          />
          <button type="submit" aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
            <Send className="size-4" />
          </button>
        </form>
      ) : null}
      {mode === "sent" || mode === "chat" ? (
        <button type="button" className="mt-2 h-9 text-xs text-muted" onClick={() => escalate(lastQuestion, "Sure. Tell the team what's going on below.")}>
          Talk to the team
        </button>
      ) : null}
    </div>
  );
}
