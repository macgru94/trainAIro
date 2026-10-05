"use client";

import { useActionState } from "react";
import { sendWeekToIntervals } from "./actions";

export function SendWeekButton({ weekId, alreadySent }: { weekId: string; alreadySent: boolean }) {
  const [state, formAction, pending] = useActionState(
    sendWeekToIntervals.bind(null, weekId),
    undefined,
  );

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        const question = alreadySent
          ? "Zastąpić treningi tego tygodnia w intervals.icu nową wersją planu?"
          : "Wysłać treningi tego tygodnia do kalendarza intervals.icu?";
        if (!confirm(question)) e.preventDefault();
      }}
      className="mt-3 flex flex-col gap-1"
    >
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending
          ? "Wysyłam…"
          : alreadySent
            ? "Zaktualizuj w intervals.icu"
            : "Wyślij do intervals.icu"}
      </button>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
