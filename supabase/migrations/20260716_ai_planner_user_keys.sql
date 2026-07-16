-- Store each user's Gemini key in Vault under gemini_api_key_<auth user id>.
-- Secret values are intentionally excluded from migration history.
create or replace function public.planner_api_key(p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'gemini_api_key_' || p_user_id::text
  limit 1
$$;

revoke all on function public.planner_api_key(uuid) from public, anon, authenticated;
grant execute on function public.planner_api_key(uuid) to service_role;
