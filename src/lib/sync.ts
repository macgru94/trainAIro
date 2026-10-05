"use server";

import { revalidatePath } from "next/cache";
import { getActivities, getWellness } from "@/lib/intervals";
import { createClient } from "@/lib/supabase/server";

export type SyncState = { ok: boolean; message: string } | undefined;

const SYNC_DAYS = 365;

// Pobiera aktywności i dane dzienne (wellness) z intervals.icu i zapisuje je w bazie.
// Istniejące wpisy są aktualizowane (upsert), więc nie powstają duplikaty.
export async function syncActivities(): Promise<SyncState> {
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return { ok: false, message: "Musisz być zalogowany." };
  }

  let activities, wellness;
  try {
    [activities, wellness] = await Promise.all([
      getActivities(SYNC_DAYS),
      getWellness(SYNC_DAYS),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    return { ok: false, message: `Błąd pobierania z intervals.icu: ${msg}` };
  }

  const now = new Date().toISOString();

  const activityRows = activities
    .filter((a) => a.start_date_local)
    .map((a) => ({
      id: String(a.id),
      user_id: userId,
      start_date_local: a.start_date_local,
      type: a.type ?? null,
      name: a.name ?? null,
      raw: a,
      synced_at: now,
    }));

  const wellnessRows = wellness.map((w) => ({
    user_id: userId,
    date: w.id,
    raw: w,
    synced_at: now,
  }));

  if (activityRows.length > 0) {
    const { error } = await supabase
      .from("activities")
      .upsert(activityRows, { onConflict: "id" });
    if (error) {
      return { ok: false, message: `Błąd zapisu treningów: ${error.message}` };
    }
  }

  if (wellnessRows.length > 0) {
    const { error } = await supabase
      .from("wellness")
      .upsert(wellnessRows, { onConflict: "user_id,date" });
    if (error) {
      return { ok: false, message: `Błąd zapisu wellness: ${error.message}` };
    }
  }

  revalidatePath("/treningi");
  revalidatePath("/forma");
  return {
    ok: true,
    message: `Zsynchronizowano ${activityRows.length} aktywności i ${wellnessRows.length} dni wellness (ostatnie ${SYNC_DAYS} dni).`,
  };
}
