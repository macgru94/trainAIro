import Link from "next/link";
import { getActivities, type IntervalsActivity } from "@/lib/intervals";
import { formatDate, formatDistance, formatDuration } from "@/lib/format";

export default async function TreningiPage() {
  let activities: IntervalsActivity[] = [];
  let error: string | null = null;

  try {
    activities = await getActivities(30);
  } catch (e) {
    error = e instanceof Error ? e.message : "Nieznany błąd";
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Treningi</h1>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← Strona główna
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Ostatnie 30 dni z intervals.icu</p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Nie udało się pobrać treningów: {error}
        </p>
      )}

      {!error && activities.length === 0 && (
        <p className="mt-6 text-zinc-500">Brak treningów w ostatnich 30 dniach.</p>
      )}

      <ul className="mt-6 flex flex-col gap-3">
        {activities.map((a) => {
          const distance = formatDistance(a.distance);
          const power = a.icu_weighted_avg_watts ?? a.icu_average_watts;
          return (
            <li key={a.id}>
              <Link
                href={`/treningi/${a.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 transition hover:ring-zinc-400"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-zinc-900">
                    {a.name ?? "Trening bez nazwy"}
                  </p>
                  <p className="shrink-0 text-xs text-zinc-500">
                    {formatDate(a.start_date_local)}
                  </p>
                </div>
                {a.name ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    {[
                      a.type,
                      formatDuration(a.moving_time),
                      distance,
                      power ? `${Math.round(power)} W` : null,
                      a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : null,
                      a.icu_training_load ? `obciążenie ${a.icu_training_load}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-amber-700">
                    Szczegóły niedostępne przez API{a.source ? ` (źródło: ${a.source})` : ""}.
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
