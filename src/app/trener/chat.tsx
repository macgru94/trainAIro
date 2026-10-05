"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { refreshTrener } from "./actions";

export type ChatMessage = { role: "user" | "assistant"; text: string };

type Props = {
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
};

const SUGGESTIONS = [
  "Zaplanujmy pierwszy cykl od poniedziałku",
  "Jak oceniasz moją formę w ostatnich tygodniach?",
  "Kiedy powinienem zrobić test FTP?",
];

export function Chat({ initialConversationId, initialMessages }: Props) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setInput("");
    setPending(true);
    setMessages((m) => [...m, { role: "user", text: message }, { role: "assistant", text: "" }]);

    const appendToReply = (chunk: string) =>
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, text: last.text + chunk };
        return copy;
      });

    try {
      const res = await fetch("/api/trener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      if (!res.ok || !res.body) {
        appendToReply(`⚠️ ${await res.text()}`);
        return;
      }
      setConversationId(res.headers.get("X-Conversation-Id"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToReply(decoder.decode(value, { stream: true }));
      }
    } catch {
      appendToReply("\n\n⚠️ Połączenie przerwane – spróbuj ponownie.");
    } finally {
      setPending(false);
      // Odświeżamy karty planu nad rozmową (trener mógł zapisać nowy plan).
      // Akcja serwerowa zwraca od razu świeże dane strony.
      await refreshTrener().catch(() => {});
    }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={newConversation}
          disabled={pending || messages.length === 0}
          className="text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-40"
        >
          + Nowa rozmowa
        </button>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-4">
        {messages.length === 0 && (
          <div className="rounded-xl bg-white p-4 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
            <p>
              Cześć! Znam Twoje treningi, formę i analizy z ostatnich 4 tygodni. Możemy
              zaplanować cykl, omówić tydzień albo porozmawiać o formie.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-lg px-3 py-2 text-left ring-1 ring-zinc-200 transition hover:ring-zinc-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm text-white">
              {m.text}
            </div>
          ) : (
            <div
              key={i}
              className="max-w-[95%] self-start rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-zinc-800 shadow-sm ring-1 ring-zinc-200 [&_h2]:mt-3 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_p:first-child]:mt-0 [&_strong]:text-zinc-900 [&_ul]:list-disc [&_ul]:pl-5"
            >
              {m.text ? (
                <ReactMarkdown>{m.text}</ReactMarkdown>
              ) : (
                <span className="text-zinc-400">Trener myśli…</span>
              )}
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 mt-4 flex gap-2 bg-zinc-50 py-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder="Napisz do trenera…"
          className="flex-1 resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="self-end rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          Wyślij
        </button>
      </form>
    </div>
  );
}
