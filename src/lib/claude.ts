import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { logUsage, type Usage } from "@/lib/ai-usage";

// Klient Claude – działa wyłącznie na serwerze.
// Klucz jest czytany automatycznie ze zmiennej ANTHROPIC_API_KEY (.env.local).
const anthropic = new Anthropic();

// Model dla każdego zadania: Opus tylko do dużych zadań (pełny tydzień, cykl),
// proste rzeczy robią tańsze modele.
export const MODELS = {
  daily: "claude-haiku-4-5", // analiza pojedynczego treningu
  weekly: "claude-sonnet-5-5", // podsumowanie tygodnia
  chat: "claude-sonnet-5-5", // rozmowa na stronie „Trener”
  edit: "claude-sonnet-5-5", // proste poprawki planu tygodnia
  cycle: "claude-opus-5-5", // plan cyklu i pełne plany tygodni
} as const;

export type CoachModel = (typeof MODELS)[keyof typeof MODELS];

type AskOptions<T extends z.ZodType> = {
  model: CoachModel;
  system: string;
  // Duża, powtarzalna część danych (np. „teczka” zawodnika) – zapamiętywana w cache,
  // więc kolejne zapytania w ciągu kilku minut płacą za nią ok. 10% ceny.
  context?: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
  effort?: "low" | "medium" | "high"; // tylko Sonnet / Opus
  // Zapis zużycia do licznika kosztów (tabela ai_usage).
  log?: { supabase: SupabaseClient; operation: string };
};

export type CoachAnswer<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

// Rozmowa z trenerem (Sonnet 5.5) – odpowiedź przesyłana na bieżąco (streaming).
// `messages` to cała dotychczasowa rozmowa: wiadomości odtwarzamy dokładnie w takiej
// postaci, w jakiej je zapisaliśmy (bez edycji) – tego wymaga model z myśleniem.
export function streamCoachChat(
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
  tools: Anthropic.Beta.BetaTool[] = [],
) {
  return anthropic.beta.messages.stream({
    tools,
    model: MODELS.chat,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    // Zapamiętuje (cache) dotychczasową rozmowę na kilka minut – kolejne
    // wiadomości są wtedy dużo tańsze.
    cache_control: { type: "ephemeral" },
    system,
    messages,
  });
}

// Pytanie do trenera AI z odpowiedzią w stałym formacie (JSON zgodny ze schematem).
export async function askCoach<T extends z.ZodType>({
  model,
  system,
  context,
  prompt,
  schema,
  maxTokens = 16000,
  effort = "medium",
  log,
}: AskOptions<T>): Promise<CoachAnswer<z.infer<T>>> {
  // Haiku 4.5: bez myślenia i bez modelu zapasowego – szybko i tanio.
  // Sonnet / Opus: myślenie adaptacyjne + zapasowy model, gdyby model
  // przez pomyłkę odmówił odpowiedzi.
  const extra =
    model === MODELS.daily
      ? {}
      : {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
          thinking: { type: "adaptive" as const },
        };
  const outputConfig =
    model === MODELS.daily
      ? { format: zodOutputFormat(schema) }
      : { format: zodOutputFormat(schema), effort };

  const content: Anthropic.Beta.BetaContentBlockParam[] = context
    ? [
        { type: "text", text: context, cache_control: { type: "ephemeral" } },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  const response = await anthropic.beta.messages.parse({
    model,
    max_tokens: maxTokens,
    ...extra,
    output_config: outputConfig,
    system,
    messages: [{ role: "user", content }],
  });

  if (log) await logUsage(log.supabase, log.operation, response.model, response.usage as Usage);

  if (response.stop_reason === "refusal") {
    throw new Error("Claude odmówił odpowiedzi na to zapytanie.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("Odpowiedź Claude była niepełna – spróbuj ponownie.");
  }

  return {
    data: response.parsed_output as z.infer<T>,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
