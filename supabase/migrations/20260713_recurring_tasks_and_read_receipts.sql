-- Run once in the Supabase SQL editor for an existing Structured Daily project.
alter table public.tasks add column if not exists recurrence jsonb;
alter table public.tasks add column if not exists recurrence_parent_id text references public.tasks (id) on delete cascade;
alter table public.messages add column if not exists read_at bigint;

revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
drop policy if exists "mark received messages read" on public.messages;
create policy "mark received messages read"
  on public.messages for update to authenticated
  using (sender <> auth.uid()) with check (sender <> auth.uid());
