-- Structured Daily — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run

-- ── Tasks ────────────────────────────────────────────────────
create table public.tasks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  icon text not null default '📝',
  color text not null default '#6C5CE7',
  date text,                -- ISO "2026-07-05", null = inbox
  start_min int,            -- minutes from midnight, null = all-day
  duration_min int not null default 30,
  notes text not null default '',
  subtasks jsonb not null default '[]',
  done boolean not null default false,
  created_at bigint not null
);

alter table public.tasks enable row level security;

-- Both users can see everything (full mutual visibility, by design)
create policy "tasks readable by any signed-in user"
  on public.tasks for select to authenticated using (true);

-- But each user can only write their own rows
create policy "insert own tasks"
  on public.tasks for insert to authenticated with check (user_id = auth.uid());
create policy "update own tasks"
  on public.tasks for update to authenticated using (user_id = auth.uid());
create policy "delete own tasks"
  on public.tasks for delete to authenticated using (user_id = auth.uid());

-- ── Chat messages ────────────────────────────────────────────
create table public.messages (
  id text primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  text text not null,
  at bigint not null
);

alter table public.messages enable row level security;

create policy "messages readable by any signed-in user"
  on public.messages for select to authenticated using (true);
create policy "send as yourself"
  on public.messages for insert to authenticated with check (sender = auth.uid());

-- ── Realtime ─────────────────────────────────────────────────
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.messages;
