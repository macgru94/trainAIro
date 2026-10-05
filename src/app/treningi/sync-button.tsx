"use client";

import { useActionState } from "react";
import { syncActivities } from "./actions";

export function SyncButton() {
  const [state, formAction, pending] = useActionState(syncActivities, undefined);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Synchronizuję…" : "Synchronizuj"}
      </button>
      {state && (
        <p
          role="status"
          className={`text-xs ${state.ok ? "text-green-700" : "text-red-600"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
