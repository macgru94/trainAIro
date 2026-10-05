import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CycleOutlineSchema,
  WEEKDAYS,
  WeekEditSchema,
  WeekPlanSchema,
  type CycleOutline,
  type PlanDay,
  type WeekPlan,
} from "@/lib/analysis-schemas";
import { askCoach, MODELS } from "@/lib/claude";
import { buildCoachSnapshot, nextMonday } from "@/lib/coach-context";
import { PLANNER_SYSTEM } from "@/lib/prompts";

// Planowanie cyklu i tygodni przez Opus. Wywoływane przez trenera w rozmowie
// (narzędzia), wynik trafia do tabel training_cycles i planned_weeks.

export type Cycle = {
  id: string;
  start_date: string;
  weeks: number;
  goal: string | null;
  outline: CycleOutline | null;
};

export type PlannedWeek = {
  id: string;
  week_index: number;
  week_start: string;
  plan: WeekPlan;
  status: string; // draft | sent
  intervals_event_ids: number[] | null;
};

const WEEKDAY_NAMES: Record<(typeof WEEKDAYS)[number], string> = {
  pon: "poniedziałek",
  wt: "wtorek",
  sr: "środa",
  czw: "czwartek",
  pt: "piątek",
  sob: "sobota",
  nd: "niedziela",
};

function shiftDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dayDate(weekStart: string, dzien: (typeof WEEKDAYS)[number]) {
  return shiftDays(weekStart, WEEKDAYS.indexOf(dzien));
}

export async function getActiveCycle(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("training_cycles")
    .select("id, start_date, weeks, goal, outline")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as Cycle | null;
}

export async function getCycleWeeks(supabase: SupabaseClient, cycleId: string) {
  const { data } = await supabase
    .from("planned_weeks")
    .select("id, week_index, week_start, plan, status, intervals_event_ids")
    .eq("cycle_id", cycleId)
    .order("week_index", { ascending: true });
  return (data ?? []) as PlannedWeek[];
}

// Krótki opis tygodnia – dla trenera w rozmowie i jako kontekst kolejnych tygodni.
export function weekToText(plan: WeekPlan, weekStart: string) {
  const days = plan.dni
    .map((d) =>
      d.rodzaj === "odpoczynek"
        ? `- ${WEEKDAY_NAMES[d.dzien]} ${dayDate(weekStart, d.dzien)}: odpoczynek`
        : `- ${WEEKDAY_NAMES[d.dzien]} ${dayDate(weekStart, d.dzien)}: ${d.nazwa} (${d.czas_min} min, ${d.w_domu ? "trenażer" : "na dworze"}) – ${d.cel}`,
    )
    .join("\n");
  return `Akcent: ${plan.akcent}\nUzasadnienie: ${plan.uzasadnienie}\n${days}`;
}

function cycleToText(cycle: Cycle) {
  if (!cycle.outline) return "brak zarysu";
  const weeks = cycle.outline.tygodnie
    .map(
      (w) =>
        `- Tydzień ${w.numer} (od ${shiftDays(cycle.start_date, (w.numer - 1) * 7)}): ${w.akcent} – ${w.opis} Docelowo ${w.docelowe_tss} TSS, ${w.liczba_treningow} treningów.${w.test ? ` Test: ${w.test}.` : ""}`,
    )
    .join("\n");
  return `Cel: ${cycle.outline.cel}\n${cycle.outline.opis}\n${weeks}`;
}

async function weeklyReviewsText(supabase: SupabaseClient, from: string) {
  const { data } = await supabase
    .from("weekly_reviews")
    .select("week_start, content")
    .gte("week_start", from)
    .order("week_start", { ascending: true });
  return (data ?? []).map((r) => `## Tydzień od ${r.week_start}\n${r.content}`).join("\n\n");
}

// Stan planowania dla trenera w rozmowie: aktywny cykl i rozpisane tygodnie.
export async function currentPlanText(supabase: SupabaseClient) {
  const cycle = await getActiveCycle(supabase);
  if (!cycle) {
    return `## Cykl treningowy\nBrak aktywnego cyklu. Nowy 4-tygodniowy cykl zacznie się w poniedziałek ${nextMonday()}.`;
  }
  const weeks = await getCycleWeeks(supabase, cycle.id);
  const weeksText = weeks
    .map((w) => `### Tydzień ${w.week_index} (od ${w.week_start}, status: ${w.status})\n${weekToText(w.plan, w.week_start)}`)
    .join("\n\n");
  return `## Aktywny cykl treningowy (start ${cycle.start_date})
${cycleToText(cycle)}

## Rozpisane tygodnie
${weeksText || "żaden tydzień nie jest jeszcze rozpisany"}`;
}

// --- Narzędzia trenera ---

export async function planCycle(
  supabase: SupabaseClient,
  userId: string,
  input: { cel: string; wymagania: string },
) {
  const startDate = nextMonday();
  const snapshot = await buildCoachSnapshot(supabase);
  const reviews = await weeklyReviewsText(supabase, shiftDays(startDate, -35));

  const answer = await askCoach({
    model: MODELS.cycle,
    system: PLANNER_SYSTEM,
    effort: "high",
    schema: CycleOutlineSchema,
    context: snapshot,
    log: { supabase, operation: "plan_cyklu" },
    prompt: `${reviews ? `# Podsumowania ostatnich tygodni\n${reviews}\n` : ""}
# Zadanie
Ułóż zarys nowego 4-tygodniowego cyklu treningowego, który zaczyna się w poniedziałek ${startDate}.

Cel zawodnika: ${input.cel}

Wymagania i informacje z rozmowy z zawodnikiem:
${input.wymagania}`,
  });

  // Nowy cykl zastępuje poprzedni aktywny.
  await supabase.from("training_cycles").update({ status: "archived" }).eq("status", "active");
  const { data, error } = await supabase
    .from("training_cycles")
    .insert({
      user_id: userId,
      start_date: startDate,
      weeks: 4,
      goal: answer.data.cel,
      outline: answer.data,
      status: "active",
    })
    .select("id, start_date, weeks, goal, outline")
    .single();
  if (error || !data) throw new Error(`Nie udało się zapisać cyklu: ${error?.message}`);

  return `Zapisano zarys cyklu (start ${startDate}):\n${cycleToText(data as Cycle)}`;
}

async function saveWeek(
  supabase: SupabaseClient,
  userId: string,
  cycle: Cycle,
  weekIndex: number,
  plan: WeekPlan,
) {
  const weekStart = shiftDays(cycle.start_date, (weekIndex - 1) * 7);
  const { error } = await supabase.from("planned_weeks").upsert(
    {
      user_id: userId,
      cycle_id: cycle.id,
      week_index: weekIndex,
      week_start: weekStart,
      plan,
      status: "draft",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cycle_id,week_index" },
  );
  if (error) throw new Error(`Nie udało się zapisać planu tygodnia: ${error.message}`);
  return weekStart;
}

// Dane do planowania tygodnia: „teczka” (stała, zapamiętywana w cache)
// + cykl i poprzednie tygodnie.
async function weekPlanningContext(supabase: SupabaseClient, cycle: Cycle, weekIndex: number) {
  const [snapshot, weeks, reviews] = await Promise.all([
    buildCoachSnapshot(supabase),
    getCycleWeeks(supabase, cycle.id),
    weeklyReviewsText(supabase, shiftDays(cycle.start_date, -7)),
  ]);
  const previous = weeks
    .filter((w) => w.week_index < weekIndex)
    .map((w) => `## Tydzień ${w.week_index} (od ${w.week_start}) – plan\n${weekToText(w.plan, w.week_start)}`)
    .join("\n\n");

  const details = `# Aktualny cykl (start ${cycle.start_date})
${cycleToText(cycle)}

# Poprzednie tygodnie tego cyklu – plany (porównaj z wykonaniem w aktywnościach)
${previous || "to pierwszy tydzień cyklu"}

${reviews ? `# Podsumowania tygodni\n${reviews}` : ""}`;

  return { snapshot, details };
}

const REST_DAY = (dzien: PlanDay["dzien"]): PlanDay => ({
  dzien,
  rodzaj: "odpoczynek",
  nazwa: "Odpoczynek",
  w_domu: true,
  czas_min: 0,
  cel: "Regeneracja.",
  bloki: [],
});

async function loadWeek(supabase: SupabaseClient, weekIndex: number) {
  const cycle = await getActiveCycle(supabase);
  checkWeekIndex(cycle, weekIndex);
  const weeks = await getCycleWeeks(supabase, cycle.id);
  const current = weeks.find((w) => w.week_index === weekIndex);
  if (!current) throw new Error("Ten tydzień nie ma jeszcze planu – najpierw go zaplanuj.");
  return { cycle, current };
}

function checkWeekIndex(cycle: Cycle | null, weekIndex: number): asserts cycle is Cycle {
  if (!cycle) throw new Error("Brak aktywnego cyklu – najpierw zaplanuj cykl.");
  if (!Number.isInteger(weekIndex) || weekIndex < 1 || weekIndex > cycle.weeks) {
    throw new Error(`Numer tygodnia musi być od 1 do ${cycle.weeks}.`);
  }
}

export async function planWeek(
  supabase: SupabaseClient,
  userId: string,
  input: { numer_tygodnia: number; dostepnosc: string; uwagi: string },
) {
  const cycle = await getActiveCycle(supabase);
  checkWeekIndex(cycle, input.numer_tygodnia);
  const weekStart = shiftDays(cycle.start_date, (input.numer_tygodnia - 1) * 7);
  const { snapshot, details } = await weekPlanningContext(supabase, cycle, input.numer_tygodnia);

  const answer = await askCoach({
    model: MODELS.cycle,
    system: PLANNER_SYSTEM,
    effort: "high",
    schema: WeekPlanSchema,
    context: snapshot,
    log: { supabase, operation: "plan_tygodnia" },
    prompt: `${details}

# Zadanie
Rozpisz tydzień ${input.numer_tygodnia} cyklu (od poniedziałku ${weekStart} do niedzieli ${shiftDays(weekStart, 6)}).

Dostępność zawodnika w tym tygodniu:
${input.dostepnosc}

Dodatkowe uwagi z rozmowy:
${input.uwagi || "brak"}`,
  });

  await saveWeek(supabase, userId, cycle, input.numer_tygodnia, answer.data);
  return `Zapisano plan tygodnia ${input.numer_tygodnia}:\n${weekToText(answer.data, weekStart)}`;
}

// Prosta poprawka treści (Sonnet): odchudzone dane, wraca tylko zmienione dni.
export async function reviseWeek(
  supabase: SupabaseClient,
  userId: string,
  input: { numer_tygodnia: number; zmiany: string },
) {
  const { cycle, current } = await loadWeek(supabase, input.numer_tygodnia);
  const snapshot = await buildCoachSnapshot(supabase, 7);
  const weekOutline = cycle.outline?.tygodnie.find((w) => w.numer === input.numer_tygodnia);

  const answer = await askCoach({
    model: MODELS.edit,
    system: PLANNER_SYSTEM,
    effort: "medium",
    schema: WeekEditSchema,
    log: { supabase, operation: "poprawka_tygodnia" },
    prompt: `${snapshot}

# Założenia tego tygodnia w cyklu
${weekOutline ? `${weekOutline.akcent} – ${weekOutline.opis} Docelowo ok. ${weekOutline.docelowe_tss} TSS.` : "brak"}

# Obecny plan tygodnia ${input.numer_tygodnia} (od ${current.week_start})
${JSON.stringify(current.plan.dni)}

# Zadanie
Popraw plan zgodnie z prośbą zawodnika. Zwróć TYLKO dni, które się zmieniają (każdy w pełnej postaci, z segmentami i komentarzami). Zmieniaj tylko to, co wynika z prośby – i ewentualnie to, co trzeba dostosować, żeby tydzień nadal miał sens.

Prośba zawodnika:
${input.zmiany}`,
  });

  const changed = new Map(answer.data.dni.map((d) => [d.dzien, d]));
  const plan: WeekPlan = {
    ...current.plan,
    dni: current.plan.dni.map((d) => changed.get(d.dzien) ?? d),
  };
  await saveWeek(supabase, userId, cycle, input.numer_tygodnia, plan);
  return `Zapisano poprawkę tygodnia ${input.numer_tygodnia} (${answer.data.opis_zmian}).
Zmienione dni: ${[...changed.keys()].map((d) => WEEKDAY_NAMES[d]).join(", ") || "brak"}.
${weekToText(plan, current.week_start)}`;
}

// Przesunięcie / zamiana / usunięcie treningu – bez AI, za darmo.
export async function moveWorkout(
  supabase: SupabaseClient,
  userId: string,
  input: {
    numer_tygodnia: number;
    operacja: "przesun" | "zamien" | "usun";
    z_dnia: PlanDay["dzien"];
    na_dzien: PlanDay["dzien"] | "brak";
  },
) {
  const { cycle, current } = await loadWeek(supabase, input.numer_tygodnia);
  const days = new Map(current.plan.dni.map((d) => [d.dzien, d]));
  const from = days.get(input.z_dnia) ?? REST_DAY(input.z_dnia);

  if (input.operacja === "usun") {
    days.set(input.z_dnia, REST_DAY(input.z_dnia));
  } else {
    if (input.na_dzien === "brak" || input.na_dzien === input.z_dnia) {
      throw new Error("Podaj inny dzień docelowy.");
    }
    const to = days.get(input.na_dzien) ?? REST_DAY(input.na_dzien);
    // Przesunięcie na dzień z treningiem = zamiana miejscami.
    days.set(input.na_dzien, { ...from, dzien: input.na_dzien });
    days.set(input.z_dnia, { ...to, dzien: input.z_dnia });
  }

  const plan: WeekPlan = {
    ...current.plan,
    dni: WEEKDAYS.map((d) => days.get(d) ?? REST_DAY(d)),
  };
  await saveWeek(supabase, userId, cycle, input.numer_tygodnia, plan);
  return `Zapisano zmianę w tygodniu ${input.numer_tygodnia}.\n${weekToText(plan, current.week_start)}`;
}
