# Structured Clone — Feature Spec & Feasibility Doc

**Goal:** Build a free-for-me alternative to [Structured](https://structured.app/) (the visual daily planner / time-blocking app) with a social layer for sharing schedules + chatting with one friend.
**Date:** 2026-07-05 · Status: pre-build research

---

## 1. What Structured Is

Structured merges your calendar, to-do list, and habits into **one vertical visual timeline per day**. You split the day into color-coded time blocks, drag them around, and see gaps instantly. It runs on iOS, iPadOS, macOS, watchOS, Android, and Web (beta at web.structured.app), syncing via iCloud or their own "Structured Cloud".

Their pricing: free base app; **Pro** (~$6.49/mo, ~$19.99–27.99/yr, or lifetime) unlocks recurring tasks, calendar import, AI, Replan, custom notifications/colors/icons. No social features at all — this is our differentiator.

---

## 2. Feature Inventory (what we copy) + How We'll Build Each

### 2.1 Core timeline (the heart of the app)

| # | Feature | What it does in Structured | How we build it |
|---|---------|---------------------------|-----------------|
| T1 | **Day timeline view** | Vertical timeline of the day; tasks are blocks positioned by start time, sized by duration; current-time indicator line | A scrollable column where 1 minute = N px. Absolutely-positioned task cards inside a relative container (same technique as Google Calendar). A red "now" line updated every minute via `setInterval`. |
| T2 | **Time blocks / tasks** | Each task has title, icon, color, start time, duration, notes, subtasks | Single `Task` record: `{id, userId, title, emoji/icon, color, date, startMin, durationMin, notes, subtasks[], done, recurrenceRule?}` |
| T3 | **Drag & drop + resize** | Drag a block to move its time; drag edge to change duration; drag from inbox onto timeline | Pointer events (`pointerdown/move/up`) with snap-to-5-minute grid. No library needed; or `interact.js` if we want it faster. |
| T4 | **All-day tasks** | Tasks pinned to top of the day without a specific time | A separate strip above the timeline; `startMin = null`. |
| T5 | **Inbox** | Holding area for unscheduled tasks; drag into timeline later | Tasks with `date = null` shown in a side panel / bottom drawer; drop onto timeline sets date+time. |
| T6 | **Check off / complete** | Tap circle to complete; visual strike/dim | `done` flag; completed blocks get reduced opacity. |
| T7 | **Overlap handling** | Overlapping blocks shown side-by-side | Standard interval-partitioning layout algorithm (compute columns for overlapping intervals). |
| T8 | **Gaps / free time** | Empty space visually obvious; tap a gap to create a task there | Click on empty timeline area → new task pre-filled with that start time. |

### 2.2 Task details

| # | Feature | Notes | How |
|---|---------|-------|-----|
| D1 | **Subtasks** | Checklist inside a task | `subtasks: [{text, done}]` array; progress ring on the block. |
| D2 | **Notes** | Free text per task | Plain `notes` string, textarea in the task sheet. |
| D3 | **Icons** | Every task has an icon | Use **emoji** (free, built-in, thousands) + Lucide/Tabler icon set (MIT-licensed). Searchable picker. |
| D4 | **Color coding** | Pick a color per task | Fixed palette of ~12 colors + a free HTML `<input type="color">` for custom. Full custom palette, no paywalling. |
| D5 | **Duplicate task / duplicate day** | Copy one task, or copy an entire day's plan to another date | "Duplicate" action clones records with new IDs/date. Trivial. |

### 2.3 Scheduling power features

| # | Feature | Notes | How |
|---|---------|-------|-----|
| S1 | **Recurring tasks** | Daily/weekly/monthly/custom repeats; edit "this occurrence" vs "all future" | Store an RRULE-style rule (`rrule` npm package). Materialize occurrences on view; exceptions stored as overrides keyed by date. Design this data model early — it's the trickiest piece. |
| S2 | **Replan** | One tap moves yesterday's unfinished tasks into today's gaps | Pure algorithm: collect overdue undone tasks, find free gaps in today's timeline, place by duration (first-fit). No AI needed. |
| S3 | **Calendar import (read)** | Shows Google Calendar events alongside tasks | *(Shifted to Phase 3)* Subscribe to ICS URLs, parse with `ical.js`, render as non-editable blocks. |
| S4 | **Reminders import** | Apple Reminders | **Skipped** — Apple-only, not applicable. |
| S5 | **Week / month views** | Zoomed-out views for navigation | Week = 7 slim timeline columns; Month = grid with dot indicators. Navigation-first, editing optional. |

### 2.4 Notifications & habits

| # | Feature | Notes | How |
|---|---------|-------|-----|
| N1 | **Task start alerts** | Notify at task start | **Web:** Notification API + Service Worker; web push for closed-app delivery via Supabase Edge Function or Cloudflare Worker (free tier). |
| N2 | **Widgets** | Home-screen widget | Requires native app. **Deferred** — PWA has no widget story. |
| N3 | **Habit streaks** | Recurring tasks show completion streaks | Count consecutive completed occurrences; show 🔥 n on the block. |

### 2.5 AI features

| # | Feature | Notes | How |
|---|---------|-------|-----|
| A1 | **AI brain-dump planner** | Type a brain-dump → parsed into scheduled tasks | *(Shifted to Phase 3)* Gemini Flash free tier via personal API key stored in settings. Text-only; voice dictation dropped. |
| A2 | **AI Replan** | GPT-based rescheduling | **Skipped** — rule-based S2 is sufficient. |

### 2.6 Social layer (our original feature — Structured has nothing like this)

This turns the app from a solo tool into a shared experience between two people.

| # | Feature | Notes | How |
|---|---------|-------|-----|
| C1 | **Two accounts** | You + your friend each have an account | Supabase Auth (email + password). You own the Supabase project; you create her account once via the Supabase dashboard. She just opens the web app URL and logs in with the credentials you give her — zero setup on her end. |
| C2 | **Friend's timeline view** | A tab where you see her full day's schedule (read-only) | All tasks are visible to both users — no privacy filtering. Her tasks fetched from Supabase Postgres in real-time via Supabase Realtime subscription. Rendered as the same timeline component but with edit controls hidden. RLS still prevents either user from *writing* the other's tasks. |
| C3 | **Real-time chat** | A chat tab between the two of you | A `messages` table in Supabase. Supabase Realtime broadcasts new rows live. Simple text messages; no media needed for v1. |
| C4 | **Online indicator** | See if the other person is currently active | Supabase Presence (built into Realtime) — broadcast a heartbeat, show a green dot on the friend's profile header. |
| C5 | **"Suggest a time" (later)** | Tap to find a free gap you both have simultaneously | Algorithm: intersect both users' free gaps for a given day. Surface as a list: "You're both free 3–4 PM." Phase 3. |

### 2.7 Sync & platform

| # | Feature | Notes | How |
|---|---------|-------|-----|
| P1 | **Offline-first local storage** | App works with no network | **IndexedDB** via `Dexie.js`. All reads/writes local first; instant UI. |
| P2 | **Multi-device sync** | Your tasks synced across your own devices | Supabase Postgres is now the source of truth anyway (needed for the social layer). Sync is free with the social backend in place — no extra work. |
| P3 | **Customization** | App color/theme, layout, font size | CSS variables + settings page. Dark mode default. |

---

## 3. Feasibility: App vs Website + Hosting (hard requirement: ₹0 / $0 total cost)

### Verdict: PWA + Supabase free tier

**Frontend (PWA):** $0 — static files on Cloudflare Pages (free). One codebase, runs on Windows and installs on any phone. Offline via IndexedDB + service worker.

**Backend (social layer + sync):** **Supabase free tier** — $0 forever for this use case.
- 500MB PostgreSQL database (more than enough for 2 users and years of tasks + messages)
- Supabase Auth (up to 50,000 MAU — we have 2)
- Supabase Realtime (WebSocket-based live subscriptions for chat + schedule updates)
- Supabase Presence (online indicators)
- Row-Level Security (privacy filter for private tasks, enforced at DB level)
- No server to run, no maintenance

**What can't be done free:**
- iOS widgets (needs $99/yr Apple dev fee) — skip
- Perfect locked-screen notifications on iOS (PWA web push on iOS is unreliable) — acceptable tradeoff

### Recommended stack

- **Frontend:** Vite + React + TypeScript, plain CSS with variables (dark theme)
- **Local storage:** Dexie.js (IndexedDB) — tasks load instantly from local; sync in background
- **Backend/sync/chat:** Supabase (Auth + Postgres + Realtime + Presence + RLS)
- **Recurrence:** `rrule` package
- **Calendar import (Phase 3):** `ical.js`
- **PWA:** `vite-plugin-pwa` (service worker, manifest, offline)
- **AI (Phase 3):** Gemini Flash free tier, personal API key in settings
- **Hosting:** Cloudflare Pages (free, unlimited bandwidth for static sites)

---

## 4. Build Order

**Phase 1 — usable in a few days (solo MVP):**
Day timeline (T1–T2, T6, T8) → task sheet with notes/subtasks/color/emoji (D1–D4) → inbox (T5) → all-day strip (T4) → drag & drop (T3) → local persistence (P1) → dark theme (P3) → PWA install/offline.

**Phase 2 — social layer + sync (the main differentiator):**
Supabase setup (auth, schema, RLS) → account login → background sync of own tasks → friend's timeline view (C2) → private tasks (D6, C3) → real-time chat (C4) → online indicator (C5) → multi-device sync now "free" (P2).

**Phase 3 — power features:**
Recurring tasks + exceptions (S1) → Replan (S2) → duplicate task/day (D5) → week & month views (S5) → overlap layout (T7) → notifications (N1) → habit streaks (N3) → JSON export/import → calendar ICS import (S3) → AI brain-dump text planner (A1) → "suggest a time" overlap finder (C6).

**Phase 4 — only if PWA notifications disappoint:**
Capacitor Android wrapper with native alarms, sideloaded APK. Still $0.

**Explicitly skipped:** Energy Monitor, Cycle Seasons, watch support, Apple Reminders/iCloud, AI Replan (rule-based is enough), voice dictation (text AI is enough), home-server hosting.

---

## 5. Sources

- [structured.app — official site](https://structured.app/)
- [Help: Free vs Pro feature split](https://help.structured.app/en/articles/1897986)
- [Help: What is Structured Pro (pricing model)](https://help.structured.app/en/articles/324674)
- [Help: Structured on Android + Structured Cloud sync](https://help.structured.app/en/articles/331714)
- [Dave Swift review 2026 (UX walkthrough)](https://daveswift.com/structured/)
- [Google Play listing](https://play.google.com/store/apps/details?id=io.unorderly.structured)
