"use server";

import { revalidatePath } from "next/cache";
import { getActivities } from "@/lib/intervals";
import { createClient } from "@/lib/supabase/server";

export type SyncState = { ok: boolean; message: string } | undefined;

const SYNC_DAYS = 90;

// Pobiera aktywności z intervals.icu i zapisuje je w tabeli activities.
// Istniejące wpisy są aktualizowane (upsert), więc nie powstają duplikaty.
export async function syncActivities(): Promise<SyncState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return { ok: false, message: "Musisz być zalogowany." };
  }

  let activities;
  try {
    activities = await getActivities(SYNC_DAYS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    return { ok: false, message: `Błąd pobierania z intervals.icu: ${msg}` };
  }

  const now = new Date().toISOString();
  const rows = activities
    .filter((a) => a.start_date_local)
    .map((a) => ({
      id: String(a.id),
      start_date_local: a.start_date_local,
      type: a.type ?? null,
      name: a.name ?? null,
      raw: a,
      synced_at: now,
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("activities")
      .upsert(rows, { onConflict: "id" });
    if (error) {
      return { ok: false, message: `Błąd zapisu w bazie: ${error.message}` };
    }
  }

  revalidatePath("/treningi");
  return {
    ok: true,
    message: `Zsynchronizowano ${rows.length} aktywności z ostatnich ${SYNC_DAYS} dni.`,
  };
}
