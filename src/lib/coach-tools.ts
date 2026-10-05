import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { planCycle, planWeek, reviseWeek } from "@/lib/planning";

// Narzędzia, które trener (Sonnet) może wywołać w rozmowie.
// Każde z nich zleca pracę Opus 5.5 i zapisuje wynik w bazie.

export const COACH_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "zaplanuj_cykl",
    description:
      "Zleca ułożenie zarysu nowego 4-tygodniowego cyklu (start w najbliższy poniedziałek). Nowy cykl zastępuje poprzedni. Użyj po wywiadzie o celu i ogólnej dostępności, gdy nie ma aktywnego cyklu albo zawodnik chce zacząć nowy.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        cel: { type: "string", description: "Cel zawodnika na ten cykl." },
        wymagania: {
          type: "string",
          description:
            "Wszystko z rozmowy, co ważne dla planu: typowa dostępność w tygodniu, jazdy na dworze/trenażer, ograniczenia, samopoczucie, preferencje.",
        },
      },
      required: ["cel", "wymagania"],
      additionalProperties: false,
    },
  },
  {
    name: "zaplanuj_tydzien",
    description:
      "Zleca rozpisanie konkretnych treningów na wskazany tydzień aktywnego cyklu. Użyj po ustaleniu dostępności na ten tydzień. Nadpisuje istniejący plan tego tygodnia.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        numer_tygodnia: { type: "integer", description: "Numer tygodnia w cyklu (1–4)." },
        dostepnosc: {
          type: "string",
          description:
            "Dostępność dzień po dniu, np. „pon: wolne, wt: 60 min trenażer, …, sob: 3 h na dworze z grupą”.",
        },
        uwagi: { type: "string", description: "Inne uwagi zawodnika (samopoczucie, preferencje) albo pusty tekst." },
      },
      required: ["numer_tygodnia", "dostepnosc", "uwagi"],
      additionalProperties: false,
    },
  },
  {
    name: "popraw_tydzien",
    description:
      "Zleca poprawienie istniejącego planu tygodnia według prośby zawodnika (np. przesunięcie treningu, krótszy dzień, inny akcent).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        numer_tygodnia: { type: "integer", description: "Numer tygodnia w cyklu (1–4)." },
        zmiany: { type: "string", description: "Dokładny opis zmian, o które prosi zawodnik." },
      },
      required: ["numer_tygodnia", "zmiany"],
      additionalProperties: false,
    },
  },
];

// Komunikat dla zawodnika, gdy narzędzie rusza (Opus potrzebuje chwili).
export const TOOL_STATUS: Record<string, string> = {
  zaplanuj_cykl: "⏳ Opus układa zarys cyklu… (do 2 minut)",
  zaplanuj_tydzien: "⏳ Opus rozpisuje plan tygodnia… (do 2 minut)",
  popraw_tydzien: "⏳ Opus poprawia plan tygodnia… (do 2 minut)",
};

const CycleInput = z.object({ cel: z.string().min(1), wymagania: z.string() });
const WeekInput = z.object({
  numer_tygodnia: z.number().int(),
  dostepnosc: z.string(),
  uwagi: z.string(),
});
const ReviseInput = z.object({ numer_tygodnia: z.number().int(), zmiany: z.string().min(1) });

export async function runCoachTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> {
  try {
    switch (name) {
      case "zaplanuj_cykl":
        return { content: await planCycle(supabase, userId, CycleInput.parse(input)), isError: false };
      case "zaplanuj_tydzien":
        return { content: await planWeek(supabase, userId, WeekInput.parse(input)), isError: false };
      case "popraw_tydzien":
        return { content: await reviseWeek(supabase, userId, ReviseInput.parse(input)), isError: false };
      default:
        return { content: `Nieznane narzędzie: ${name}`, isError: true };
    }
  } catch (e) {
    return { content: e instanceof Error ? e.message : "Nieznany błąd", isError: true };
  }
}
