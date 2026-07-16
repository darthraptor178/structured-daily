-- Run after telegram_bot_token, project_url, and publishable_key exist in Vault.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'telegram-task-reminders') then
    perform cron.unschedule('telegram-task-reminders');
  end if;
end $$;

select cron.schedule(
  'telegram-task-reminders',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/telegram-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := jsonb_build_object('scheduled_at', now())
    );
  $$
);
