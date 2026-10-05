import Link from "next/link";
import {
  getActivity,
  getActivityMessages,
  hasFeelings,
  type IntervalsActivityDetail,
  type IntervalsMessage,
} from "@/lib/intervals";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/server";
import { isVerdict, VERDICT_LABELS, VERDICT_STYLES } from "@/lib/verdicts";
import { AnalyzeButton } from "./analyze-button";
import { FeelingsForm } from "./feelings-form";
import {
  formatClock,
  formatDate,
  formatDistance,
  formatDuration,
} from "@/lib/format";

type DailyAnalysisData = {
  podsumowanie: string;
  mocne_strony: string[];
  slabe_strony: string[];
  odczucia: string;
  werdykt: string;
  rekomendacja: string;
};

type Analysis = {
  content: string;
  created_at: string;
  model: string | null;
  verdict: string | null;
  data: DailyAnalysisData | null;
};

const POWER_ZONE_NAMES: Record<string, string> = {
  Z1: "Regeneracja",
  Z2: "Wytrzymałość",
  Z3: "Tempo",
  Z4: "Próg",
  Z5: "VO2max",
  Z6: "Beztlenowa",
  Z7: "Neuromięśniowa",
  SS: "Sweet Spot",
};

const round = (v?: number | null, digits = 0) =>
  v == null ? null : Number(v.toFixed(digits));

export default async function TreningPage(props: PageProps<"/treningi/[id]">) {
  const { id } = await props.params;

  let activity: IntervalsActivityDetail | null = null;
  let messages: IntervalsMessage[] = [];
  let error: string | null = null;

  const supabase = await createClient();
  const analysisQuery = supabase
    .from("activity_analyses")
    .select("content, created_at, model, verdict, data")
    .eq("activity_id", id)
    .maybeSingle();

  try {
    [activity, messages] = await Promise.all([
      getActivity(id),
      getActivityMessages(id),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Nieznany błąd";
  }

  const { data: analysis } = await analysisQuery;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/treningi" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Wszystkie treningi
      </Link>

      {error || !activity ? (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Nie udało się pobrać treningu: {error}
        </p>
      ) : (
        <ActivityDetail activity={activity} messages={messages} analysis={analysis} />
      )}
    </main>
  );
}

function ActivityDetail({
  activity: a,
  messages,
  analysis,
}: {
  activity: IntervalsActivityDetail;
  messages: IntervalsMessage[];
  analysis: Analysis | null;
}) {
  const workIntervals = (a.icu_intervals ?? []).filter((i) => i.type === "WORK");

  return (
    <>
      <header className="mt-4">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {a.name ?? "Trening bez nazwy"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {a.type} · {formatDate(a.start_date_local, true)}
        </p>
        <a
          href={`https://intervals.icu/activities/${a.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-zinc-500 underline hover:text-zinc-900"
        >
          Otwórz w intervals.icu ↗
        </a>
      </header>

      <Section title="Podsumowanie">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Czas jazdy" value={formatDuration(a.moving_time)} />
          <Stat label="Dystans" value={formatDistance(a.distance)} />
          <Stat label="Przewyższenie" value={a.total_elevation_gain ? `${Math.round(a.total_elevation_gain)} m` : null} />
          <Stat label="Śr. prędkość" value={a.average_speed ? `${(a.average_speed * 3.6).toFixed(1)} km/h` : null} />
          <Stat label="Śr. moc" value={a.icu_average_watts ? `${Math.round(a.icu_average_watts)} W` : null} />
          <Stat label="NP (moc znormalizowana)" value={a.icu_weighted_avg_watts ? `${Math.round(a.icu_weighted_avg_watts)} W` : null} />
          <Stat label="IF (intensywność)" value={round(a.icu_intensity != null ? a.icu_intensity / 100 : null, 2)} />
          <Stat label="Obciążenie (TSS)" value={a.icu_training_load} />
          <Stat label="VI (zmienność)" value={round(a.icu_variability_index, 2)} />
          <Stat label="Śr. tętno" value={a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : null} />
          <Stat label="Maks. tętno" value={a.max_heartrate ? `${Math.round(a.max_heartrate)} bpm` : null} />
          <Stat label="Śr. kadencja" value={a.average_cadence ? `${Math.round(a.average_cadence)} rpm` : null} />
          <Stat label="EF (efektywność)" value={round(a.icu_efficiency_factor, 2)} />
          <Stat label="Decoupling" value={a.decoupling != null ? `${a.decoupling.toFixed(1)}%` : null} />
          <Stat label="Praca" value={a.icu_joules ? `${Math.round(a.icu_joules / 1000)} kJ` : null} />
          <Stat label="Kalorie" value={a.calories ? `${a.calories} kcal` : null} />
          <Stat label="FTP" value={a.icu_ftp ? `${a.icu_ftp} W` : null} />
          <Stat label="Waga" value={a.icu_weight ? `${a.icu_weight} kg` : null} />
        </dl>
      </Section>

      <Section title="Odczucia">
        {!hasFeelings(a) && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Nie uzupełniono odczuć. Dodaj RPE i samopoczucie – bez nich analiza
            treningu będzie mniej trafna.
          </p>
        )}
        <FeelingsForm
          activityId={String(a.id)}
          initialRpe={a.icu_rpe ?? null}
          initialFeel={a.feel ?? null}
          initialDescription={a.description ?? ""}
        />
      </Section>

      <Section title="Analiza trenera">
        {analysis ? (
          <>
            {analysis.data ? (
              <DailyAnalysisView data={analysis.data} />
            ) : (
              // Starsze analizy (sprzed zmiany formatu) były zwykłym tekstem Markdown.
              <div className="text-sm leading-relaxed text-zinc-800 [&_blockquote]:my-3 [&_blockquote]:rounded-lg [&_blockquote]:bg-amber-50 [&_blockquote]:p-3 [&_blockquote]:text-amber-900 [&_h2]:mt-4 [&_h2]:mb-1 [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_li]:mt-1 [&_p]:mt-2 [&_strong]:text-zinc-900 [&_ul]:list-disc [&_ul]:pl-5">
                <ReactMarkdown>{analysis.content}</ReactMarkdown>
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-400">
              {formatDate(analysis.created_at)} · {analysis.model}
            </p>
            <div className="mt-3">
              <AnalyzeButton activityId={String(a.id)} label="Przygotuj nową analizę" secondary />
            </div>
          </>
        ) : hasFeelings(a) ? (
          <AnalyzeButton activityId={String(a.id)} label="Analizuj trening" />
        ) : (
          <>
            <p className="mb-3 text-sm text-zinc-600">
              Najpierw uzupełnij odczucia powyżej – z nimi analiza będzie dużo trafniejsza.
            </p>
            <AnalyzeButton activityId={String(a.id)} label="Analizuj mimo to" secondary />
          </>
        )}
      </Section>

      <PowerZones activity={a} />
      <HeartRateZones activity={a} />

      <Section title={`Interwały (${workIntervals.length})`}>
        {workIntervals.length === 0 ? (
          <p className="text-sm text-zinc-500">Brak interwałów roboczych.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-2 font-normal">#</th>
                  <th className="py-2 font-normal">Czas</th>
                  <th className="py-2 font-normal">Śr. moc</th>
                  <th className="py-2 font-normal">NP</th>
                  <th className="py-2 font-normal">Maks.</th>
                  <th className="py-2 font-normal">Tętno</th>
                  <th className="py-2 font-normal">Kadencja</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800">
                {workIntervals.map((i, idx) => (
                  <tr key={i.id} className="border-t border-zinc-100">
                    <td className="py-2 text-zinc-500">{i.label || idx + 1}</td>
                    <td className="py-2">{formatClock(i.moving_time ?? i.elapsed_time)}</td>
                    <td className="py-2">{i.average_watts ? `${Math.round(i.average_watts)} W` : "–"}</td>
                    <td className="py-2">{i.weighted_average_watts ? `${Math.round(i.weighted_average_watts)} W` : "–"}</td>
                    <td className="py-2">{i.max_watts ? `${Math.round(i.max_watts)} W` : "–"}</td>
                    <td className="py-2">{i.average_heartrate ? Math.round(i.average_heartrate) : "–"}</td>
                    <td className="py-2">{i.average_cadence ? Math.round(i.average_cadence) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Komentarze (${messages.length})`}>
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">Brak komentarzy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className="text-sm">
                <p className="text-xs text-zinc-500">
                  {m.name} · {formatDate(m.created)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-zinc-800">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function DailyAnalysisView({ data }: { data: DailyAnalysisData }) {
  const verdict = isVerdict(data.werdykt) ? data.werdykt : null;
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-zinc-800">
      {verdict && (
        <p className={`self-start rounded-full px-3 py-1 text-sm font-medium ${VERDICT_STYLES[verdict]}`}>
          {VERDICT_LABELS[verdict]}
        </p>
      )}
      <p>{data.podsumowanie}</p>
      <AnalysisList title="Mocne strony" items={data.mocne_strony} marker="✓" />
      <AnalysisList title="Słabe strony" items={data.slabe_strony} marker="!" />
      <div>
        <p className="font-medium text-zinc-900">Odczucia</p>
        <p className="mt-1">{data.odczucia}</p>
      </div>
      <div className="rounded-lg bg-zinc-50 p-3">
        <p className="font-medium text-zinc-900">Co dalej</p>
        <p className="mt-1">{data.rekomendacja}</p>
      </div>
    </div>
  );
}

function AnalysisList({ title, items, marker }: { title: string; items: string[]; marker: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-medium text-zinc-900">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-zinc-400">{marker}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-3 font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-900">{value ?? "–"}</dd>
    </div>
  );
}

type ZoneRow = { id: string; name: string; range: string | null; secs: number };

function ZoneBars({ rows }: { rows: ZoneRow[] }) {
  const total = rows.reduce((sum, r) => sum + r.secs, 0);
  if (total === 0) return <p className="text-sm text-zinc-500">Brak danych.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const pct = (r.secs / total) * 100;
        return (
          <li key={r.id} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-zinc-800">
                <span className="font-medium">{r.id}</span> {r.name}
                {r.range && <span className="text-zinc-500"> · {r.range}</span>}
              </span>
              <span className="shrink-0 text-zinc-600">
                {formatClock(r.secs)} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100">
              <div className="h-2 rounded-full bg-zinc-800" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PowerZones({ activity: a }: { activity: IntervalsActivityDetail }) {
  if (!a.icu_zone_times?.length) return null;

  // icu_power_zones to górne granice stref w % FTP, np. [55, 75, 90, ...].
  const bounds = a.icu_power_zones ?? [];
  const ftp = a.icu_ftp;
  const rows: ZoneRow[] = a.icu_zone_times.map((z) => {
    const n = Number(z.id.replace("Z", ""));
    let range: string | null = null;
    if (ftp && !Number.isNaN(n) && bounds[n - 1] != null) {
      const low = n > 1 ? Math.round((bounds[n - 2] / 100) * ftp) + 1 : 0;
      range =
        n === bounds.length
          ? `> ${low - 1} W`
          : `${low}–${Math.round((bounds[n - 1] / 100) * ftp)} W`;
    }
    return { id: z.id, name: POWER_ZONE_NAMES[z.id] ?? "", range, secs: z.secs };
  });

  return (
    <Section title="Strefy mocy">
      <ZoneBars rows={rows} />
    </Section>
  );
}

function HeartRateZones({ activity: a }: { activity: IntervalsActivityDetail }) {
  if (!a.icu_hr_zone_times?.length) return null;

  // icu_hr_zones to górne granice stref w bpm.
  const bounds = a.icu_hr_zones ?? [];
  const rows: ZoneRow[] = a.icu_hr_zone_times.map((secs, idx) => {
    let range: string | null = null;
    if (bounds[idx] != null) {
      const low = idx > 0 ? bounds[idx - 1] + 1 : 0;
      range = idx === bounds.length - 1 ? `> ${low - 1} bpm` : `${low}–${bounds[idx]} bpm`;
    }
    return { id: `Z${idx + 1}`, name: "", range, secs };
  });

  return (
    <Section title="Strefy tętna">
      <ZoneBars rows={rows} />
    </Section>
  );
}
