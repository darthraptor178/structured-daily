-- Telegram reminders: task delivery fields, per-user destination, and scheduler.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.tasks add column if not exists telegram_reminder_min int check (telegram_reminder_min between 0 and 1440);
alter table public.tasks add column if not exists telegram_remind_at bigint;
alter table public.tasks add column if not exists telegram_reminder_sent_at bigint;

create table if not exists public.telegram_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.telegram_settings enable row level security;
drop policy if exists "manage own telegram settings" on public.telegram_settings;
create policy "manage own telegram settings" on public.telegram_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Only the service-role Edge Function can read the bot token from Vault.
create or replace function public.telegram_bot_token()
returns text
language sql
security definer
set search_path = public, vault
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1 $$;
revoke all on function public.telegram_bot_token() from public, anon, authenticated;
grant execute on function public.telegram_bot_token() to service_role;

-- Apply the separate enable migration only after the BotFather token is in Vault.
