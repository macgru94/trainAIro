"use server";

import { revalidatePath } from "next/cache";
import { updateActivityFeelings, type ActivityFeelings } from "@/lib/intervals";
import { createClient } from "@/lib/supabase/server";

export type FeelingsState = { ok: boolean; message: string } | undefined;

function parseScale(value: FormDataEntryValue | null, min: number, max: number) {
  const n = Number(value);
  return value && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// Zapisuje odczucia: najpierw w intervals.icu, potem w naszej bazie.
export async function saveFeelings(
  activityId: string,
  _prevState: FeelingsState,
  formData: FormData,
): Promise<FeelingsState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return { ok: false, message: "Musisz być zalogowany." };
  }

  const description = String(formData.get("description") ?? "").trim().slice(0, 5000);
  const feelings: ActivityFeelings = {
    icu_rpe: parseScale(formData.get("icu_rpe"), 1, 10),
    feel: parseScale(formData.get("feel"), 1, 5),
    description: description || null,
  };

  try {
    await updateActivityFeelings(activityId, feelings);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    return { ok: false, message: `Nie udało się zapisać w intervals.icu: ${msg}` };
  }

  // Aktualizujemy kopię w bazie, jeśli trening był już zsynchronizowany.
  const { data: row } = await supabase
    .from("activities")
    .select("raw")
    .eq("id", activityId)
    .maybeSingle();

  if (row) {
    const { error } = await supabase
      .from("activities")
      .update({ raw: { ...row.raw, ...feelings } })
      .eq("id", activityId);
    if (error) {
      return {
        ok: false,
        message: `Zapisano w intervals.icu, ale nie w bazie: ${error.message}`,
      };
    }
  }

  revalidatePath(`/treningi/${activityId}`);
  revalidatePath("/treningi");
  return { ok: true, message: "Zapisano odczucia." };
}
