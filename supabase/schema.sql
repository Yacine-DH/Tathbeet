-- Tathbeet sync schema.
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- One row per account holding that account's whole app state as JSON. Row Level
-- Security is what makes the public anon key safe: every statement is scoped to
-- auth.uid(), so a signed-in user can only ever touch their own row.

create table if not exists public.states (
  user_id    uuid primary key references auth.users on delete cascade,
  state      jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.states enable row level security;

-- Drop first so the script can be re-run safely.
drop policy if exists "read own state"   on public.states;
drop policy if exists "insert own state" on public.states;
drop policy if exists "update own state" on public.states;
drop policy if exists "delete own state" on public.states;

create policy "read own state"
  on public.states for select
  using (auth.uid() = user_id);

create policy "insert own state"
  on public.states for insert
  with check (auth.uid() = user_id);

create policy "update own state"
  on public.states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own state"
  on public.states for delete
  using (auth.uid() = user_id);
