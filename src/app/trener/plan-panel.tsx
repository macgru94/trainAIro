import type { Cycle, PlannedWeek } from "@/lib/planning";
import { formatBlock, formatSegment, type Block } from "@/lib/workout-format";
import { SendWeekButton } from "./send-week-button";

const DAY_LABELS: Record<string, string> = {
  pon: "Pon",
  wt: "Wt",
  sr: "Śr",
  czw: "Czw",
  pt: "Pt",
  sob: "Sob",
  nd: "Nd",
};

const DAY_OFFSETS: Record<string, number> = { pon: 0, wt: 1, sr: 2, czw: 3, pt: 4, sob: 5, nd: 6 };

function shortDate(isoDate: string, offset = 0) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" });
}

type Props = { cycle: Cycle | null; weeks: PlannedWeek[]; ftp: number | null };

// Karty nad rozmową: zarys cyklu i rozpisane tygodnie.
export function PlanPanel({ cycle, weeks, ftp }: Props) {
  if (!cycle?.outline) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <details className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <summary className="cursor-pointer font-semibold text-zinc-900">
          Cykl od {shortDate(cycle.start_date)}: {cycle.outline.cel}
        </summary>
        <p className="mt-2 text-sm text-zinc-600">{cycle.outline.opis}</p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {cycle.outline.tygodnie.map((w) => (
            <li key={w.numer} className="rounded-lg bg-zinc-50 p-2">
              <p className="font-medium text-zinc-900">
                Tydzień {w.numer} ({shortDate(cycle.start_date, (w.numer - 1) * 7)}): {w.akcent}
              </p>
              <p className="text-zinc-600">
                {w.opis} · ok. {w.docelowe_tss} TSS · {w.liczba_treningow} treningów
              </p>
              {w.test && <p className="mt-1 text-amber-800">Test: {w.test}</p>}
            </li>
          ))}
        </ul>
      </details>

      {weeks.map((week) => (
        <details key={week.id} open className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <summary className="cursor-pointer font-semibold text-zinc-900">
            Tydzień {week.week_index} ({shortDate(week.week_start)}–{shortDate(week.week_start, 6)}):{" "}
            {week.plan.akcent}
            <WeekStatus week={week} />
          </summary>
          <p className="mt-2 text-sm text-zinc-600">{week.plan.uzasadnienie}</p>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {week.plan.dni.map((d) => (
              <li key={d.dzien} className="rounded-lg bg-zinc-50 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium text-zinc-900">
                    <span className="text-zinc-500">
                      {DAY_LABELS[d.dzien]} {shortDate(week.week_start, DAY_OFFSETS[d.dzien])}
                    </span>{" "}
                    · {d.nazwa}
                  </p>
                  {d.rodzaj === "trening" && (
                    <p className="shrink-0 text-xs text-zinc-500">
                      {d.czas_min} min · {d.w_domu ? "trenażer" : "na dworze"}
                    </p>
                  )}
                </div>
                {d.rodzaj === "trening" && (
                  <>
                    <p className="mt-1 text-zinc-600">{d.cel}</p>
                    {d.bloki.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-0.5 font-mono text-xs text-zinc-700">
                        {d.bloki.map((b, i) => (
                          <li key={i}>{formatBlock(b, ftp)}</li>
                        ))}
                      </ul>
                    )}
                    <SegmentDetails blocks={d.bloki} ftp={ftp} />
                  </>
                )}
              </li>
            ))}
          </ul>
          <SendWeekButton
            key={`${week.id}-${week.status}`}
            weekId={week.id}
            alreadySent={(week.intervals_event_ids ?? []).length > 0}
          />
        </details>
      ))}
    </div>
  );
}

function WeekStatus({ week }: { week: PlannedWeek }) {
  const sentBefore = (week.intervals_event_ids ?? []).length > 0;
  const [label, style] =
    week.status === "sent"
      ? ["w intervals.icu", "bg-green-50 text-green-800"]
      : sentBefore
        ? ["zmieniony – wyślij ponownie", "bg-amber-50 text-amber-800"]
        : ["szkic", "bg-zinc-100 text-zinc-600"];
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}

// Komentarze do segmentów: odczucia i wskazówki (plany sprzed tej zmiany ich nie mają).
function SegmentDetails({ blocks, ftp }: { blocks: Block[]; ftp: number | null }) {
  const withNotes = blocks.some((b) => b.segmenty.some((s) => s.odczucia || s.wskazowki));
  if (!withNotes) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs font-medium text-zinc-500">Jak jechać – szczegóły segmentów</summary>
      <div className="mt-2 flex flex-col gap-2">
        {blocks.map((b, i) => (
          <div key={i} className={b.powtorzenia > 1 ? "rounded-lg border border-zinc-200 p-2" : ""}>
            {b.powtorzenia > 1 && (
              <p className="mb-1 text-xs font-medium text-zinc-500">Powtórz {b.powtorzenia}×</p>
            )}
            {b.segmenty.map((s, j) => (
              <div key={j} className="mt-1 first:mt-0">
                <p className="text-xs font-medium text-zinc-900">
                  {s.nazwa} · <span className="font-mono font-normal text-zinc-600">{formatSegment(s, ftp)}</span>
                </p>
                {s.odczucia && <p className="text-xs text-zinc-600">Odczucia: {s.odczucia}</p>}
                {s.wskazowki && <p className="text-xs text-zinc-600">Wskazówki: {s.wskazowki}</p>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
