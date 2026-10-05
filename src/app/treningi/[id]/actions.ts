"use server";

import { revalidatePath } from "next/cache";
import { DailyAnalysisSchema, type DailyAnalysis } from "@/lib/analysis-schemas";
import { askCoach, MODELS } from "@/lib/claude";
import { buildActivityAnalysisContext } from "@/lib/coach-context";
import { updateActivityFeelings, type ActivityFeelings } from "@/lib/intervals";
import { COACH_SYSTEM, dailyAnalysisPrompt } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";
import { VERDICT_LABELS } from "@/lib/verdicts";

export type FeelingsState = { ok: boolean; message: string } | undefined;
export type AnalysisState = { ok: boolean; message: string } | undefined;

// Wersja tekstowa analizy – czytelna dla człowieka i jako wejście dla analizy tygodniowej.
function dailyAnalysisToText(a: DailyAnalysis) {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n") || "- brak";
  return `Werdykt: ${VERDICT_LABELS[a.werdykt]}
${a.podsumowanie}

Mocne strony:
${list(a.mocne_strony)}

Słabe strony:
${list(a.slabe_strony)}

Odczucia: ${a.odczucia}

Rekomendacja: ${a.rekomendacja}`;
}

// Analiza dzienna (Haiku): ocena treningu + werdykt, czy zmieniać bieżący tydzień.
// Zapisywana w bazie (nadpisuje poprzednią) – później korzysta z niej analiza tygodniowa.
export async function analyzeActivity(activityId: string): Promise<AnalysisState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    return { ok: false, message: "Musisz być zalogowany." };
  }

  try {
    const { text: context, feelingsMissing } = await buildActivityAnalysisContext(
      supabase,
      activityId,
    );
    const today = new Date().toLocaleDateString("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const answer = await askCoach({
      model: MODELS.daily,
      system: COACH_SYSTEM,
      prompt: dailyAnalysisPrompt(context, feelingsMissing, today),
      schema: DailyAnalysisSchema,
      maxTokens: 4000,
    });

    const { error } = await supabase.from("activity_analyses").upsert(
      {
        activity_id: activityId,
        user_id: auth.claims.sub,
        content: dailyAnalysisToText(answer.data),
        verdict: answer.data.werdykt,
        data: answer.data,
        model: answer.model,
        input_tokens: answer.inputTokens,
        output_tokens: answer.outputTokens,
        created_at: new Date().toISOString(),
      },
      { onConflict: "activity_id" },
    );
    if (error) {
      return { ok: false, message: `Analiza gotowa, ale nie udało się jej zapisać: ${error.message}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Nieznany błąd";
    return { ok: false, message: `Nie udało się przygotować analizy: ${msg}` };
  }

  revalidatePath(`/treningi/${activityId}`);
  return { ok: true, message: "Analiza gotowa." };
}

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
