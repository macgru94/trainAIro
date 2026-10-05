"use client";

import { useActionState } from "react";
import { analyzeActivity } from "./actions";

type Props = {
  activityId: string;
  label: string;
  secondary?: boolean;
};

export function AnalyzeButton({ activityId, label, secondary = false }: Props) {
  const [state, formAction, pending] = useActionState(
    analyzeActivity.bind(null, activityId),
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className={`self-start rounded-lg px-4 py-2.5 font-medium transition disabled:opacity-50 ${
          secondary
            ? "border border-zinc-300 text-zinc-900 hover:bg-zinc-100"
            : "bg-zinc-900 text-white hover:bg-zinc-700"
        }`}
      >
        {pending ? "Trener analizuje… (do minuty)" : label}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
    </form>
  );
}
