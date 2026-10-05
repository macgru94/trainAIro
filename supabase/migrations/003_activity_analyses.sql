-- Analizy dzienne treningów przygotowane przez Claude (jedna na trening)
-- (uruchomione ręcznie w Supabase → SQL Editor)
create table public.activity_analyses (
  activity_id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  verdict text,          -- bez_zmian | drobna_korekta | zmiana_planu | odpoczynek
  data jsonb,            -- pełna odpowiedź Claude (podsumowanie, mocne/słabe strony…)
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);

alter table public.activity_analyses enable row level security;

create policy "Odczyt własnych analiz" on public.activity_analyses
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Dodawanie własnych analiz" on public.activity_analyses
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Aktualizacja własnych analiz" on public.activity_analyses
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
