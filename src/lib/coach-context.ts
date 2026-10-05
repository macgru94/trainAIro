import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEEL_LABELS } from "@/lib/feelings";
import {
  getActivity,
  getActivityMessages,
  getEvents,
  hasFeelings,
  type IntervalsActivity,
  type IntervalsActivityDetail,
  type IntervalsEvent,
  type IntervalsWellness,
} from "@/lib/intervals";

// Zbiera dane treningowe w zwięzłą „teczkę” dla trenera AI.
// Wysyłamy tylko potrzebne pola – mniej tekstu = taniej i bardziej konkretnie.

const round = (v: number | null | undefined, digits = 0) =>
  v == null ? undefined : Number(v.toFixed(digits));

const minutes = (secs?: number | null) => (secs ? Math.round(secs / 60) : undefined);

function feelLabel(feel?: number | null) {
  return feel ? FEEL_LABELS[feel] : undefined;
}

function activitySummary(a: IntervalsActivity | IntervalsActivityDetail) {
  const d = a as IntervalsActivityDetail;
  return {
    data: a.start_date_local,
    typ: a.type,
    nazwa: a.name,
    czas_min: minutes(a.moving_time),
    dystans_km: round(a.distance ? a.distance / 1000 : null, 1),
    obciazenie_tss: a.icu_training_load,
    if: round(d.icu_intensity != null ? d.icu_intensity / 100 : null, 2),
    np_w: round(a.icu_weighted_avg_watts),
    sr_moc_w: round(a.icu_average_watts),
    sr_tetno: round(a.average_heartrate),
    rpe: a.icu_rpe ?? undefined,
    samopoczucie: feelLabel(a.feel),
    notatka: a.description?.trim() ? a.description.trim().slice(0, 300) : undefined,
  };
}

function activityDetailSummary(a: IntervalsActivityDetail) {
  const powerZones = (a.icu_zone_times ?? [])
    .filter((z) => z.secs > 0)
    .map((z) => `${z.id}: ${minutes(z.secs) ?? 0} min`)
    .join(", ");
  const hrZones = (a.icu_hr_zone_times ?? [])
    .map((secs, i) => (secs > 0 ? `Z${i + 1}: ${minutes(secs) ?? 0} min` : null))
    .filter(Boolean)
    .join(", ");
  const work = (a.icu_intervals ?? [])
    .filter((i) => i.type === "WORK")
    .slice(0, 60)
    .map((i) => ({
      czas_s: i.moving_time ?? i.elapsed_time,
      sr_w: round(i.average_watts),
      np_w: round(i.weighted_average_watts),
      max_w: round(i.max_watts),
      tetno: round(i.average_heartrate),
      max_tetno: round(i.max_heartrate),
      kadencja: round(i.average_cadence),
    }));

  return {
    ...activitySummary(a),
    przewyzszenie_m: round(a.total_elevation_gain),
    maks_tetno: round(a.max_heartrate),
    sr_kadencja: round(a.average_cadence),
    vi: round(a.icu_variability_index, 2),
    ef: round(a.icu_efficiency_factor, 2),
    decoupling_proc: round(a.decoupling, 1),
    praca_kj: round(a.icu_joules ? a.icu_joules / 1000 : null),
    ftp_w: a.icu_ftp,
    lthr: a.lthr,
    waga_kg: a.icu_weight,
    granice_stref_mocy_proc_ftp: a.icu_power_zones,
    granice_stref_tetna_bpm: a.icu_hr_zones,
    czas_w_strefach_mocy: powerZones || undefined,
    czas_w_strefach_tetna: hrZones || undefined,
    interwaly_robocze: work.length ? work : undefined,
  };
}

function wellnessSummary(w: IntervalsWellness) {
  return {
    dzien: w.id,
    ctl: round(w.ctl),
    atl: round(w.atl),
    tsb: w.ctl != null && w.atl != null ? Math.round(w.ctl - w.atl) : undefined,
    hrv: w.hrv ?? undefined,
    tetno_spocz: w.restingHR ?? undefined,
    sen_h: round(w.sleepSecs ? w.sleepSecs / 3600 : null, 1),
    ocena_snu: w.sleepScore ?? undefined,
    waga: w.weight ?? undefined,
    bolesnosc: w.soreness ?? undefined,
    zmeczenie: w.fatigue ?? undefined,
    stres: w.stress ?? undefined,
    nastroj: w.mood ?? undefined,
    motywacja: w.motivation ?? undefined,
    komentarz: w.comments ?? undefined,
  };
}

function plannedSummary(e: IntervalsEvent) {
  return {
    data: e.start_date_local?.slice(0, 10),
    nazwa: e.name,
    typ: e.type,
    czas_min: minutes(e.moving_time),
    obciazenie_tss: e.icu_training_load,
    w_domu: e.indoor,
    opis: e.description?.trim() ? e.description.trim().slice(0, 400) : undefined,
  };
}

// JSON bez pustych pól, jeden obiekt na linię – czytelny i oszczędny.
function lines(items: object[]) {
  return items.map((i) => JSON.stringify(i)).join("\n");
}

// Data RRRR-MM-DD przesunięta o podaną liczbę dni (ujemna = wstecz).
function shiftDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw" });
}

// Najbliższy poniedziałek (jeśli dziś poniedziałek – za tydzień).
export function nextMonday(fromIso = todayIso()) {
  const d = new Date(`${fromIso}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = niedziela
  d.setUTCDate(d.getUTCDate() + (((8 - day) % 7) || 7));
  return d.toISOString().slice(0, 10);
}

// „Teczka” dla trenera w rozmowie: profil, 4 tygodnie danych z analizami, kalendarz.
export async function buildCoachSnapshot(supabase: SupabaseClient) {
  const today = todayIso();
  const from = shiftDays(today, -28);

  const [{ data: wellnessRows }, { data: activityRows }, { data: analysisRows }, events] =
    await Promise.all([
      supabase
        .from("wellness")
        .select("raw")
        .gte("date", from)
        .order("date", { ascending: true }),
      supabase
        .from("activities")
        .select("id, raw")
        .gte("start_date_local", from)
        .order("start_date_local", { ascending: true }),
      supabase.from("activity_analyses").select("activity_id, verdict, data"),
      getEvents(today, shiftDays(today, 14)),
    ]);

  const analyses = new Map(
    (analysisRows ?? []).map((r) => [r.activity_id as string, r]),
  );
  const activities = (activityRows ?? []).map((r) => {
    const raw = r.raw as IntervalsActivity;
    const analysis = analyses.get(r.id as string);
    return {
      ...activitySummary(raw),
      werdykt_analizy: analysis?.verdict ?? undefined,
      wniosek_analizy: (analysis?.data as { podsumowanie?: string } | null)?.podsumowanie,
    };
  });

  // Aktualny profil zawodnika bierzemy z ostatniej jazdy z mocą.
  const lastRide = [...(activityRows ?? [])]
    .reverse()
    .map((r) => r.raw as IntervalsActivityDetail)
    .find((a) => a.icu_ftp);
  const profile = lastRide
    ? {
        ftp_w: lastRide.icu_ftp,
        waga_kg: lastRide.icu_weight,
        lthr: lastRide.lthr,
        granice_stref_mocy_proc_ftp: lastRide.icu_power_zones,
        granice_stref_tetna_bpm: lastRide.icu_hr_zones,
      }
    : null;

  const planned = events.filter((e) => e.category === "WORKOUT").map(plannedSummary);
  const wellness = (wellnessRows ?? []).map((r) => wellnessSummary(r.raw as IntervalsWellness));

  return `# Dane zawodnika (stan na ${today})

## Profil
${profile ? JSON.stringify(profile) : "brak danych o FTP"}

## Wellness – ostatnie 4 tygodnie (CTL = fitness, ATL = zmęczenie, TSB = świeżość)
${lines(wellness) || "brak danych"}

## Aktywności – ostatnie 4 tygodnie (z werdyktem analizy dziennej, jeśli była)
${lines(activities) || "brak"}

## Kalendarz intervals.icu – zaplanowane treningi na 14 dni
${lines(planned) || "brak zaplanowanych treningów"}

## Cykl treningowy
Brak aktywnego cyklu. Pierwszy 4-tygodniowy cykl ma się zacząć w poniedziałek ${nextMonday(today)}.`;
}

export async function buildActivityAnalysisContext(
  supabase: SupabaseClient,
  activityId: string,
) {
  const [activity, messages] = await Promise.all([
    getActivity(activityId),
    getActivityMessages(activityId),
  ]);

  const activityDate = (activity.start_date_local ?? new Date().toISOString()).slice(0, 10);

  // Kontekst: 21 dni wellness i 28 dni aktywności przed tym treningiem (z naszej bazy)
  // oraz zaplanowane treningi na 7 dni po nim (z kalendarza intervals.icu).
  const [{ data: wellnessRows }, { data: recentRows }, events] = await Promise.all([
    supabase
      .from("wellness")
      .select("raw")
      .gte("date", shiftDays(activityDate, -21))
      .lte("date", activityDate)
      .order("date", { ascending: true }),
    supabase
      .from("activities")
      .select("raw")
      .gte("start_date_local", shiftDays(activityDate, -28))
      .lt("start_date_local", activity.start_date_local ?? `${activityDate}T23:59:59`)
      .neq("id", activityId)
      .order("start_date_local", { ascending: true }),
    getEvents(shiftDays(activityDate, 1), shiftDays(activityDate, 7)),
  ]);

  const planned = events
    .filter((e) => e.category === "WORKOUT")
    .map(plannedSummary);

  const wellness = (wellnessRows ?? []).map((r) => wellnessSummary(r.raw as IntervalsWellness));
  const recent = (recentRows ?? []).map((r) => activitySummary(r.raw as IntervalsActivity));
  const comments = messages
    .filter((m) => m.content)
    .map((m) => `${m.name ?? "?"}: ${m.content}`)
    .join("\n");

  const text = `# Analizowany trening
${JSON.stringify(activityDetailSummary(activity))}

# Komentarze do treningu w intervals.icu
${comments || "brak"}

# Wellness – ostatnie dni (CTL = fitness, ATL = zmęczenie, TSB = świeżość)
${lines(wellness) || "brak danych"}

# Wcześniejsze aktywności – ostatnie 4 tygodnie
${lines(recent) || "brak"}

# Zaplanowane treningi na 7 dni po tym treningu
${lines(planned) || "brak zaplanowanych treningów"}`;

  return { text, feelingsMissing: !hasFeelings(activity) };
}
