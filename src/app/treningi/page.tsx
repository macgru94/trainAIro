import Link from "next/link";
import { hasFeelings, isCycling, type IntervalsActivity } from "@/lib/intervals";
import { formatDate, formatDistance, formatDuration } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { SyncButton } from "@/components/sync-button";

// Przypominamy o odczuciach tylko dla jazd z ostatnich 14 dni –
// starszych treningów i tak trudno wiarygodnie ocenić z pamięci.
const FEELINGS_REMINDER_DAYS = 14;

function needsFeelings(a: IntervalsActivity) {
  if (!isCycling(a) || hasFeelings(a) || !a.start_date_local) return false;
  const ageMs = Date.now() - new Date(a.start_date_local).getTime();
  return ageMs < FEELINGS_REMINDER_DAYS * 24 * 60 * 60 * 1000;
}

export default async function TreningiPage(props: PageProps<"/treningi">) {
  const { typ } = await props.searchParams;
  const showAll = typ === "wszystkie";

  // Czytamy z naszej bazy (RLS zwraca tylko wiersze zalogowanego użytkownika).
  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("activities")
    .select("raw")
    .order("start_date_local", { ascending: false })
    .limit(200);

  const error = dbError?.message ?? null;
  let activities = (data ?? []).map((row) => row.raw as IntervalsActivity);

  if (!showAll) {
    activities = activities.filter(isCycling);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Strona główna
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Treningi</h1>
          <p className="mt-1 text-sm text-zinc-500">Zapisane w bazie</p>
        </div>
        <SyncButton />
      </div>

      <div className="mt-4 inline-flex rounded-lg bg-zinc-100 p-1 text-sm">
        <FilterLink href="/treningi" active={!showAll}>
          Rower
        </FilterLink>
        <FilterLink href="/treningi?typ=wszystkie" active={showAll}>
          Wszystkie
        </FilterLink>
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Nie udało się pobrać treningów: {error}
        </p>
      )}

      {!error && activities.length === 0 && (
        <p className="mt-6 text-zinc-500">
          {showAll ? "Brak treningów" : "Brak jazd na rowerze"} w bazie. Kliknij
          „Synchronizuj”, aby pobrać dane z intervals.icu.
        </p>
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
                ) : null}
                {a.name && needsFeelings(a) && (
                  <p className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Uzupełnij odczucia
                  </p>
                )}
                {!a.name && (
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

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-1.5 transition ${
        active ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
      }`}
    >
      {children}
    </Link>
  );
}
