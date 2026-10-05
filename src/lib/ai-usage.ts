import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cennik (USD za milion tokenów). Zapis do cache = 1,25 × cena wejścia.
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// Szacowany koszt jednego zapytania.
export function estimateCost(model: string, usage: Usage) {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  const p = key ? PRICES[key] : PRICES["claude-opus-5-5"];
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (
    (usage.input_tokens * p.input +
      cacheWrite * p.input * 1.25 +
      cacheRead * p.cacheRead +
      usage.output_tokens * p.output) /
    1_000_000
  );
}

// Zapisuje zużycie w tabeli ai_usage. Błąd zapisu nie przerywa działania aplikacji.
export async function logUsage(
  supabase: SupabaseClient,
  operation: string,
  model: string,
  usage: Usage,
) {
  await supabase
    .from("ai_usage")
    .insert({
      operation,
      model,
      input_tokens: usage.input_tokens,
      cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      output_tokens: usage.output_tokens,
      cost_usd: estimateCost(model, usage),
    })
    .then(
      () => undefined,
      () => undefined,
    );
}
