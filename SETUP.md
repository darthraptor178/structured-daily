# Going Live — your 10-minute checklist

The site auto-deploys to GitHub Pages on every push. Until you finish the Supabase
steps below, the live site runs in **local demo mode** (everything works, but no
login/sync/chat between devices).

## 1. Create the Supabase project (~3 min)

1. Go to [supabase.com](https://supabase.com) → Sign in with GitHub (free, no card).
2. **New project** → name it `structured-daily`, pick a strong DB password (save it
   somewhere), region `South Asia (Mumbai)` → **Create**.
3. Wait ~1 minute for provisioning.

## 2. Create the tables (~1 min)

1. Left sidebar → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   You should see "Success. No rows returned".

### Updating an existing project

If you created the tables before the recurring-task and chat-read-receipt update,
run [`supabase/migrations/20260713_recurring_tasks_and_read_receipts.sql`](supabase/migrations/20260713_recurring_tasks_and_read_receipts.sql)
once in the SQL Editor. This adds the fields required for recurring occurrences,
unread counts, and “Seen at” timestamps.

## 3. Create the two accounts (~2 min)

1. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Create yours: your email + a password. ✅ Check **Auto Confirm User**.
3. Create hers the same way (any email works, e.g. her real one; set the password
   yourself and just send it to her). ✅ Auto Confirm.
4. Also: **Authentication → Sign In / Up** → disable **Allow new users to sign up**
   (so it stays a 2-person app).

## 4. Connect the deployed site to Supabase (~2 min)

1. In Supabase: **Project Settings → API** — copy the **Project URL** and the
   **anon public** key.
2. On the GitHub repo page: **Settings → Secrets and variables → Actions →
   Variables tab → New repository variable**:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
3. Repo → **Actions** → select the latest "Deploy to GitHub Pages" run → **Re-run
   all jobs** (or just push any commit). Two minutes later the live site shows the
   sign-in screen.

> The anon key is designed to be public — security comes from Row Level Security,
> which the schema already enforces (each user can only write their own rows).

## 5. Local dev with sync (optional)

Copy `app/.env.example` to `app/.env.local`, fill in the same two values, restart
`npm run dev`.

## 6. Her name in the UI (30 sec)

Edit `app/src/config.ts` → change `FRIEND_NAME = 'Friend'` to her name → push.

## 7. Telegram reminders (optional)

1. Create a bot with Telegram's **@BotFather** and copy its token.
2. In Supabase **Project Settings â†’ Vault**, create a secret named
   `telegram_bot_token` containing that token.
3. Run `supabase/migrations/20260716_enable_telegram_task_reminders.sql` in the
   SQL Editor to enable the one-minute delivery job.
4. Send `/start` to the bot. In the app's Settings, enter your numeric Telegram
   chat ID. Tasks can then opt into a reminder from their editor.

## Done

- She opens the site URL on her phone, signs in with the credentials you gave her,
  optionally "Add to Home Screen".
- You both see each other's timelines under the person tab, chat under Chat, and a
  green dot when the other is in the app.
