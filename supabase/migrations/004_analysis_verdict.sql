-- Analiza dzienna w stałym formacie: werdykt + pełna odpowiedź JSON
-- (uruchomione ręcznie w Supabase → SQL Editor)
alter table public.activity_analyses
  add column verdict text,   -- bez_zmian | drobna_korekta | zmiana_planu | odpoczynek
  add column data jsonb;     -- pełna odpowiedź Claude (podsumowanie, mocne/słabe strony…)
