"use server";

import { revalidatePath } from "next/cache";
import type { WeekPlan } from "@/lib/analysis-schemas";
import {
  createEvents,
  deleteEvent,
  type IntervalsActivityDetail,
  type NewWorkoutEvent,
} from "@/lib/intervals";
import { dayDate } from "@/lib/planning";
import { createClient } from "@/lib/supabase/server";
import { toIntervalsDescription } from "@/lib/workout-format";

export type SendState = { ok: boolean; message: string } | undefined;

// Przeładowanie danych strony „Trener” (karty planu) po odpowiedzi trenera.
export async function refreshTrener() {
  revalidatePath("/trener");
}

// Wysyła tydzień do kalendarza intervals.icu jako zaplanowane treningi.
// Jeśli tydzień był już wysłany, poprzednie treningi są najpierw usuwane (bez duplikatów).
export async function sendWeekToIntervals(weekId: string): Promise<SendState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return { ok: false, message: "Musisz być zalogowany." };

  const { data: week } = await supabase
    .from("planned_weeks")
    .select("id, week_start, plan, intervals_event_ids")
    .eq("id", weekId)
    .maybeSingle();
  if (!week) return { ok: false, message: "Nie znaleziono planu tygodnia." };

  // FTP do komentarzy z watami (struktura w intervals.icu jest w % FTP).
  const { data: rides } = await supabase
    .from("activities")
    .select("raw")
    .order("start_date_local", { ascending: false })
    .limit(20);
  const ftp =
    (rides ?? []).map((r) => (r.raw as IntervalsActivityDetail).icu_ftp).find((v) => v != null) ?? null;

  const plan = week.plan as WeekPlan;
  const events: NewWorkoutEvent[] = plan.dni
    .filter((d) => d.rodzaj === "trening" && d.bloki.length > 0)
    .map((d) => ({
      category: "WORKOUT",
      start_date_local: `${dayDate(week.week_start, d.dzien)}T00:00:00`,
      type: d.w_domu ? "VirtualRide" : "Ride",
      name: d.nazwa,
      description: toIntervalsDescription(d, ftp),
      moving_time: d.czas_min * 60,
      indoor: d.w_domu,
    }));

  try {
    for (const id of (week.intervals_event_ids as number[] | null) ?? []) {
      await deleteEvent(id);
    }
    const created = events.length > 0 ? await createEvents(events) : [];

    const { error } = await supabase
      .from("planned_weeks")
      .update({
        status: "sent",
        intervals_event_ids: created.map((e) => e.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", week.id);
    if (error) {
      return { ok: false, message: `Wysłano, ale nie udało się zapisać statusu: ${error.message}` };
    }

    revalidatePath("/trener");
    return { ok: true, message: `Wysłano ${created.length} treningów do intervals.icu.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    return { ok: false, message: `Nie udało się wysłać: ${msg}` };
  }
}
