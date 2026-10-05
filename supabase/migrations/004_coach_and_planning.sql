-- Rozmowy z trenerem, cykle treningowe, plany tygodni, podsumowania tygodni
-- (uruchomione ręcznie w Supabase → SQL Editor)
create table public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.coach_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null,
  content jsonb not null,
  display_text text,
  created_at timestamptz not null default now()
);

create table public.training_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  weeks integer not null default 4,
  goal text,
  outline jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.planned_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cycle_id uuid not null references public.training_cycles (id) on delete cascade,
  week_index integer not null,
  week_start date not null,
  plan jsonb not null,
  status text not null default 'draft',
  intervals_event_ids jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, week_index)
);

create table public.weekly_reviews (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  content text not null,
  data jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index on public.coach_messages (conversation_id, id);

alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.training_cycles enable row level security;
alter table public.planned_weeks enable row level security;
alter table public.weekly_reviews enable row level security;

create policy "Własne rozmowy" on public.coach_conversations for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Własne wiadomości" on public.coach_messages for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Własne cykle" on public.training_cycles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Własne plany tygodni" on public.planned_weeks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Własne podsumowania tygodni" on public.weekly_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
