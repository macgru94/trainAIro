"use client";

import { useActionState, useState } from "react";
import { FEEL_LABELS, RPE_LABELS } from "@/lib/feelings";
import { saveFeelings } from "./actions";

type Props = {
  activityId: string;
  initialRpe: number | null;
  initialFeel: number | null;
  initialDescription: string;
};

export function FeelingsForm({ activityId, initialRpe, initialFeel, initialDescription }: Props) {
  const [state, formAction, pending] = useActionState(
    saveFeelings.bind(null, activityId),
    undefined,
  );
  const [rpe, setRpe] = useState<number | null>(initialRpe);
  const [feel, setFeel] = useState<number | null>(initialFeel);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="icu_rpe" value={rpe ?? ""} />
      <input type="hidden" name="feel" value={feel ?? ""} />

      <fieldset>
        <legend className="text-xs text-zinc-500">
          RPE – jak ciężki był wysiłek (1–10)
          {rpe && <span className="ml-1 font-medium text-zinc-900">· {RPE_LABELS[rpe]}</span>}
        </legend>
        <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <ChoiceButton key={n} selected={rpe === n} onClick={() => setRpe(rpe === n ? null : n)}>
              {n}
            </ChoiceButton>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs text-zinc-500">Samopoczucie</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Object.entries(FEEL_LABELS).map(([value, label]) => {
            const n = Number(value);
            return (
              <ChoiceButton key={n} selected={feel === n} onClick={() => setFeel(feel === n ? null : n)}>
                {label}
              </ChoiceButton>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Notatka – jak się jechało, co bolało, co poszło dobrze
        <textarea
          name="description"
          defaultValue={initialDescription}
          rows={4}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Zapisuję…" : "Zapisz"}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg px-2 py-2.5 text-sm font-medium ring-1 transition ${
        selected
          ? "bg-zinc-900 text-white ring-zinc-900"
          : "bg-white text-zinc-700 ring-zinc-300 hover:ring-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
