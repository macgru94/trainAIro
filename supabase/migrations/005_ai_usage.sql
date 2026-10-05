-- Licznik kosztów AI: zużycie tokenów i szacowany koszt każdego zapytania do Claude
-- (uruchomione ręcznie w Supabase → SQL Editor)
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  operation text not null,
  model text not null,
  input_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  created_at timestamptz not null default now()
);

create index on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

create policy "Własne zużycie AI" on public.ai_usage for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
