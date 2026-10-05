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

// Zarys 4-tygodniowego cyklu treningowego (Opus).
export const CycleOutlineSchema = z.object({
  cel: z.string().describe("Cel cyklu jednym zdaniem."),
  opis: z
    .string()
    .describe("2–4 zdania: założenia cyklu, jak rozłożone jest obciążenie i dlaczego."),
  tygodnie: z
    .array(
      z.object({
        numer: z.number().int().describe("Numer tygodnia w cyklu: 1–4."),
        akcent: z.string().describe("Krótko, np. „Baza tlenowa”, „Budowanie progu”, „Regeneracja + test”."),
        opis: z.string().describe("1–2 zdania: co robimy w tym tygodniu."),
        docelowe_tss: z.number().int().describe("Planowane łączne obciążenie tygodnia (TSS)."),
        liczba_treningow: z.number().int(),
        test: z
          .string()
          .nullable()
          .describe("Jeśli w tym tygodniu jest test – jaki (np. „Ramp test”); inaczej null."),
      }),
    )
    .describe("Dokładnie 4 tygodnie."),
});

export type CycleOutline = z.infer<typeof CycleOutlineSchema>;

export const WEEKDAYS = ["pon", "wt", "sr", "czw", "pt", "sob", "nd"] as const;

// Jeden dzień planu (trening z segmentami albo odpoczynek).
export const DaySchema = z.object({
  dzien: z.enum(WEEKDAYS),
  rodzaj: z.enum(["trening", "odpoczynek"]),
  nazwa: z.string().describe("Krótka nazwa, np. „Sweet Spot 3×12”, „Długa jazda Z2”, „Odpoczynek”."),
  w_domu: z.boolean().describe("true = trenażer, false = jazda na dworze."),
  czas_min: z.number().int().describe("Łączny czas treningu w minutach (0 dla odpoczynku)."),
  cel: z.string().describe("1–2 zdania: po co ten trening i na co uważać (kadencja, odczucia…)."),
  bloki: z
    .array(
      z.object({
        powtorzenia: z.number().int().describe("Ile razy powtórzyć segmenty bloku (1 = bez powtórzeń)."),
        segmenty: z.array(
          z.object({
            nazwa: z
              .string()
              .describe("Nazwa segmentu, 1–3 słowa, bez cyfr, np. „Rozgrzewka”, „Sweet Spot”, „Przerwa”, „Schłodzenie”."),
            czas_s: z.number().int().describe("Czas segmentu w sekundach."),
            moc_od_proc_ftp: z.number().int().describe("Dolna granica mocy w % FTP."),
            moc_do_proc_ftp: z.number().int().describe("Górna granica mocy w % FTP (równa dolnej = stała moc)."),
            narastajaco: z
              .boolean()
              .describe("true = moc rośnie płynnie od dolnej do górnej (np. rozgrzewka)."),
            kadencja_od: z.number().int().describe("Dolna granica docelowej kadencji (rpm)."),
            kadencja_do: z.number().int().describe("Górna granica docelowej kadencji (rpm)."),
            odczucia: z
              .string()
              .describe(
                "Jak organizm powinien się czuć w tym segmencie: RPE (1–10), oddech, czy da się swobodnie mówić, czucie w nogach. Jedno–dwa zdania.",
              ),
            wskazowki: z
              .string()
              .describe("Na czym się skupić: technika, pozycja, równe tempo, picie/jedzenie… Jedno zdanie."),
          }),
        ),
      }),
    )
    .describe("Struktura treningu od rozgrzewki do schłodzenia. Pusta lista dla odpoczynku."),
});

export type PlanDay = z.infer<typeof DaySchema>;

// Konkretny plan tygodnia (Opus). Moc w % FTP – zamieniamy ją na waty i na
// format treningu intervals.icu po stronie aplikacji.
export const WeekPlanSchema = z.object({
  akcent: z.string().describe("Akcent tygodnia (zgodny z zarysem cyklu)."),
  uzasadnienie: z
    .string()
    .describe("2–4 zdania: dlaczego tak, z odniesieniem do poprzednich tygodni, formy i dostępności."),
  dni: z.array(DaySchema).describe("Dokładnie 7 dni, od poniedziałku do niedzieli."),
});

export type WeekPlan = z.infer<typeof WeekPlanSchema>;

// Prosta poprawka tygodnia (Sonnet): tylko dni, które się zmieniają.
export const WeekEditSchema = z.object({
  opis_zmian: z.string().describe("1–2 zdania: co zmieniono i dlaczego."),
  dni: z
    .array(DaySchema)
    .describe("Tylko zmienione dni – każdy w pełnej postaci. Dni bez zmian pomiń."),
});

export type WeekEdit = z.infer<typeof WeekEditSchema>;
