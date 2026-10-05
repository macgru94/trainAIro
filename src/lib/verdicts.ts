// Werdykt analizy dziennej: czy trzeba coś zmienić w bieżącym tygodniu.
// Wspólne dla serwera (schemat dla Claude) i przeglądarki (znaczki).

export const VERDICTS = ["bez_zmian", "drobna_korekta", "zmiana_planu", "odpoczynek"] as const;

export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_LABELS: Record<Verdict, string> = {
  bez_zmian: "Bez zmian w planie",
  drobna_korekta: "Drobna korekta",
  zmiana_planu: "Zmień plan",
  odpoczynek: "Potrzebny odpoczynek",
};

export const VERDICT_STYLES: Record<Verdict, string> = {
  bez_zmian: "bg-green-50 text-green-800",
  drobna_korekta: "bg-amber-50 text-amber-800",
  zmiana_planu: "bg-orange-100 text-orange-900",
  odpoczynek: "bg-red-50 text-red-800",
};

export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}
