import "server-only";
import { z } from "zod";
import { VERDICTS } from "@/lib/verdicts";

// Format odpowiedzi analizy dziennej (Claude musi zwrócić dokładnie taki JSON).
export const DailyAnalysisSchema = z.object({
  podsumowanie: z
    .string()
    .describe("2–3 zdania: jaki to był trening, jaki miał cel i czy cel został osiągnięty."),
  mocne_strony: z
    .array(z.string())
    .describe("1–4 konkretne obserwacje z liczbami: co poszło dobrze."),
  slabe_strony: z
    .array(z.string())
    .describe("0–4 konkretne obserwacje z liczbami: co poszło gorzej lub na co uważać."),
  odczucia: z
    .string()
    .describe(
      "Ocena RPE, samopoczucia i notatki w zestawieniu z danymi (czy odczucia pasują do obciążenia). Jeśli odczuć brak – krótka prośba o ich uzupełnienie i co przez to pozostaje niewiadome.",
    ),
  werdykt: z
    .enum(VERDICTS)
    .describe(
      "Czy zmieniać coś w bieżącym tygodniu: bez_zmian, drobna_korekta (np. lżej/krócej następny trening), zmiana_planu (przebudowa kolejnych dni), odpoczynek (dzień wolny lub regeneracja).",
    ),
  rekomendacja: z
    .string()
    .describe(
      "1–3 zdania: co konkretnie zrobić w najbliższych dniach. Jeśli jest plan na kolejne dni – odnieś się do konkretnych zaplanowanych treningów.",
    ),
});

export type DailyAnalysis = z.infer<typeof DailyAnalysisSchema>;
