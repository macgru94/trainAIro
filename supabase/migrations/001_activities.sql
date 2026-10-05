-- Tabela na aktywności z intervals.icu
-- (uruchomione ręcznie w Supabase → SQL Editor)
create table public.activities (
  id text primary key,                     -- numer treningu z intervals.icu
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  start_date_local timestamp not null,
  type text,
  name text,
  raw jsonb not null,                      -- wszystkie dane z intervals.icu
  synced_at timestamptz not null default now()
);

create index activities_user_date_idx
  on public.activities (user_id, start_date_local desc);

-- Row Level Security: każdy widzi tylko swoje wiersze
alter table public.activities enable row level security;

create policy "Odczyt własnych treningów"
  on public.activities for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Dodawanie własnych treningów"
  on public.activities for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Aktualizacja własnych treningów"
  on public.activities for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
