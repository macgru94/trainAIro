import Link from "next/link";
import { SyncButton } from "@/components/sync-button";
import { formatDuration } from "@/lib/format";
import type { IntervalsWellness } from "@/lib/intervals";
import { createClient } from "@/lib/supabase/server";

const DAYS_SHOWN = 30;

function formatDay(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("pl-PL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// TSB (świeżość) = CTL − ATL. Ujemne = zmęczenie, dodatnie = wypoczęcie.
function tsb(w?: IntervalsWellness) {
  if (w?.ctl == null || w?.atl == null) return null;
  return Math.round(w.ctl - w.atl);
}

function tsbLabel(value: number | null) {
  if (value == null) return "";
  if (value < -30) return "bardzo duże zmęczenie";
  if (value < -10) return "trening budujący formę";
  if (value <= 5) return "neutralnie";
  if (value <= 25) return "świeżość – dobry moment na start";
  return "długi odpoczynek – forma może spadać";
}

// Najnowsza niepusta wartość danego pola (np. HRV nie zawsze jest dzisiaj).
function latest<K extends keyof IntervalsWellness>(days: IntervalsWellness[], key: K) {
  const day = days.find((d) => d[key] != null);
  return day ? { value: day[key], date: day.id } : null;
}

export default async function FormaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wellness")
    .select("raw")
    .order("date", { ascending: false })
    .limit(DAYS_SHOWN);

  const days = (data ?? []).map((row) => row.raw as IntervalsWellness);
  const today = days[0];
  const todayTsb = tsb(today);
  const hrv = latest(days, "hrv");
  const rhr = latest(days, "restingHR");
  const sleep = latest(days, "sleepSecs");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Strona główna
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Forma</h1>
          <p className="mt-1 text-sm text-zinc-500">Dane dzienne z intervals.icu i Garmina</p>
        </div>
        <SyncButton />
      </div>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Nie udało się pobrać danych: {error.message}
        </p>
      )}

      {!error && days.length === 0 && (
        <p className="mt-6 text-zinc-500">
          Brak danych w bazie. Kliknij „Synchronizuj”, aby pobrać dane z intervals.icu.
        </p>
      )}

      {today && (
        <>
          <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <h2 className="font-semibold text-zinc-900">Dziś ({formatDay(today.id)})</h2>
            <dl className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Fitness (CTL)" value={today.ctl != null ? Math.round(today.ctl) : null} />
              <Stat label="Zmęczenie (ATL)" value={today.atl != null ? Math.round(today.atl) : null} />
              <Stat label="Świeżość (TSB)" value={todayTsb} />
            </dl>
            {todayTsb != null && (
              <p className="mt-2 text-sm text-zinc-600">{tsbLabel(todayTsb)}</p>
            )}
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-4">
              <Stat label="HRV" value={hrv ? `${hrv.value} ms` : null} hint={hrv && hrv.date !== today.id ? formatDay(hrv.date) : undefined} />
              <Stat label="Tętno spocz." value={rhr ? `${rhr.value} bpm` : null} hint={rhr && rhr.date !== today.id ? formatDay(rhr.date) : undefined} />
              <Stat label="Sen" value={sleep ? formatDuration(sleep.value as number) : null} hint={sleep && sleep.date !== today.id ? formatDay(sleep.date) : undefined} />
            </dl>
          </section>

          <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-3 font-semibold text-zinc-900">Ostatnie {DAYS_SHOWN} dni</h2>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="py-2 font-normal">Dzień</th>
                    <th className="py-2 font-normal">CTL</th>
                    <th className="py-2 font-normal">ATL</th>
                    <th className="py-2 font-normal">TSB</th>
                    <th className="py-2 font-normal">HRV</th>
                    <th className="py-2 font-normal">Tętno</th>
                    <th className="py-2 font-normal">Sen</th>
                    <th className="py-2 font-normal">Waga</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800">
                  {days.map((d) => {
                    const t = tsb(d);
                    return (
                      <tr key={d.id} className="border-t border-zinc-100">
                        <td className="py-2 text-zinc-500">{formatDay(d.id)}</td>
                        <td className="py-2">{d.ctl != null ? Math.round(d.ctl) : "–"}</td>
                        <td className="py-2">{d.atl != null ? Math.round(d.atl) : "–"}</td>
                        <td className={`py-2 ${t != null && t < -10 ? "text-amber-700" : ""}`}>{t ?? "–"}</td>
                        <td className="py-2">{d.hrv ?? "–"}</td>
                        <td className="py-2">{d.restingHR ?? "–"}</td>
                        <td className="py-2">{d.sleepSecs ? formatDuration(d.sleepSecs) : "–"}</td>
                        <td className="py-2">{d.weight ?? "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value ?? "–"}</dd>
      {hint && <dd className="text-xs text-zinc-400">{hint}</dd>}
    </div>
  );
}
