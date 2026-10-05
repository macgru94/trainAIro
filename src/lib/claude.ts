import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Klient Claude – działa wyłącznie na serwerze.
// Klucz jest czytany automatycznie ze zmiennej ANTHROPIC_API_KEY (.env.local).
const anthropic = new Anthropic();

// Model dla każdego poziomu analizy: im wyższy poziom, tym mądrzejszy (i droższy)
// model – ale pracuje na krótkich podsumowaniach z poziomu niżej.
export const MODELS = {
  daily: "claude-haiku-4-5", // analiza pojedynczego treningu
  weekly: "claude-sonnet-5-5", // podsumowanie tygodnia
  chat: "claude-sonnet-5-5", // rozmowa na stronie „Trener”
  cycle: "claude-opus-5-5", // plan cyklu, planów tygodni i ich poprawki
} as const;

export type CoachModel = (typeof MODELS)[keyof typeof MODELS];

type AskOptions<T extends z.ZodType> = {
  model: CoachModel;
  system: string;
  prompt: string;
  schema: T;
  maxTokens?: number;
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
export function streamCoachChat(system: string, messages: Anthropic.Beta.BetaMessageParam[]) {
  return anthropic.beta.messages.stream({
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
  prompt,
  schema,
  maxTokens = 16000,
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

  const response = await anthropic.beta.messages.parse({
    model,
    max_tokens: maxTokens,
    ...extra,
    output_config: { format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: prompt }],
  });

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
