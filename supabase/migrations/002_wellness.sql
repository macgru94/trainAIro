-- Dane dzienne (wellness) z intervals.icu: forma, sen, HRV, tętno spoczynkowe...
-- (uruchomione ręcznie w Supabase → SQL Editor)
create table public.wellness (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  date date not null,
  raw jsonb not null,                      -- wszystkie dane dnia z intervals.icu
  synced_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.wellness enable row level security;

create policy "Odczyt własnego wellness"
  on public.wellness for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Dodawanie własnego wellness"
  on public.wellness for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Aktualizacja własnego wellness"
  on public.wellness for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
