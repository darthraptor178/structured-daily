# Structured Clone — UI Specification

**Companion to** `FEATURES-AND-FEASIBILITY.md`. This doc describes *what every screen looks like* and *how each feature is presented*, screen by screen. Written for a dark-first PWA on both phone (primary) and desktop (secondary).

---

## 0. Design language (applies everywhere)

**Mood:** calm, focused, "a quiet dashboard for your day." Not playful, not corporate. The timeline is the star — everything else recedes.

**Color**
- Background: near-black charcoal `#16171A` (not pure black — softer on OLED and less harsh).
- Surface / cards: `#1F2024` raised one step; sheets/modals `#25262B`.
- Text: primary `#F2F3F5`, secondary `#9A9CA3`, disabled `#5C5E66`.
- Accent (brand): a single warm indigo `#6C5CE7` for the "now" line, primary buttons, active states.
- Task colors: a fixed palette of 12 muted-but-saturated hues (coral, amber, sun, lime, mint, teal, sky, blue, indigo, violet, rose, slate). Blocks use the hue at ~18% opacity fill + full-strength left border.
- Success/done: desaturate + 40% opacity, no separate green.

**Type**
- Display / headings: **Space Grotesk** (free, Google Fonts). Used for the date header and section titles.
- Body / UI: **Inter** (free) for everything else — task titles, times, labels.
- Numerals in the time ruler use **tabular figures** so they don't jitter.
- Scale: 28/600 date header, 17/600 task title, 15/400 body, 13/500 labels, 11/500 time ruler.

**Shape & spacing**
- 8px base grid. Cards 12px radius, sheets 20px top radius, buttons 10px radius.
- Generous vertical rhythm — the timeline breathes; don't cram.

**Motion**
- Drag = block lifts (shadow + 1.02 scale). Drop = spring settle (~200ms).
- Completing a task = quick checkmark draw + fade-to-done.
- Sheet open = slide up from bottom on mobile, fade+scale on desktop.
- Keep it under 250ms everywhere; nothing bouncy or slow.

---

## 1. Main screen — Day Timeline (the home screen)

This is 90% of the app. Layout top to bottom:

### 1a. Top bar (sticky)
- **Left:** big date — "Sunday" on line 1 (28/600), "July 5" smaller/secondary beneath. Tapping it opens a mini month-picker popover to jump dates.
- **Center/right:** ‹ Today › arrows to step days; "Today" pill is highlighted when you're on the current day and dimmed/tappable to return when you've navigated away.
- **Far right:** an overflow ⋯ menu (Duplicate day, Replan, Settings) and a view-switch segmented control (Day / Week / Month).

### 1b. All-day strip
- A thin horizontal band directly under the top bar labeled subtly "All-day."
- Holds chip-style tasks with no fixed time (icon + short title). Horizontally scrollable if many.
- Collapses to a single "+2 all-day" pill when there are lots, expands on tap.

### 1c. The timeline (scrollable body — the centerpiece)
- **Left gutter (~52px):** hour labels (6 AM, 7 AM…) in the tabular 11px ruler font, secondary color. Faint 1px hairline per hour across the width; half-hour marks even fainter.
- **"Now" line:** a full-width `#6C5CE7` line with a filled dot on the left, sitting at the real current time. Auto-scrolls into view on open. The single brightest element on screen.
- **Task blocks:** positioned by start time, height = duration (min tap height enforced ~44px even for 5-min tasks).
  - Left border in the task's full color; fill at ~18%.
  - Row 1: icon/emoji + title (17/600). Row 2 (if height allows): time range "9:00–9:45" + a subtask progress like "2/3" and a small note glyph if notes exist.
  - Left circle to check off; checking dims the whole block and strikes the title.
  - Overlapping tasks split into side-by-side columns automatically.
- **Empty gaps:** tapping any empty stretch starts a new task pre-filled to that time (see §3). A faint "＋" ghosts in on hover/long-press over empty space.
- **Past time:** everything above the now-line is slightly dimmed so the eye lands on what's ahead.

### 1d. Floating action button (bottom-right)
- Round `#6C5CE7` **＋**. Tap = new task sheet.

### 1e. Bottom nav (mobile) / left rail (desktop)
- Five items: **My Day** (active), **Inbox** (badge with unscheduled count), **[Her name]** (online dot), **Chat** (unread badge), **Settings**.
- Desktop turns this into a slim left rail; Friend timeline and Chat become panels in the main area.

---

## 2. Inbox

A holding pen for unscheduled tasks.
- Simple vertical list of task rows (icon, title, optional duration estimate as a "~30m" chip).
- Each row is **draggable straight onto the timeline** — on mobile, long-press lifts it, then switch to My Day tab and drop into a time slot.
- Empty state: a calm illustration + "Nothing waiting. Capture a thought with ＋."
- Top has a fast single-line "Add to inbox…" input so you can dump tasks without scheduling.

---

## 3. Task editor (bottom sheet)

Opens when creating or tapping a task. Slides up ~85% height on mobile, centered modal on desktop.

Top to bottom:
1. **Title field** — large, autofocused, placeholder "What's the task?"
2. **Icon + color row** — the current emoji/icon on the left (tap → searchable emoji/Lucide picker), the 12-swatch color strip on the right + a "custom" swatch opening a color wheel.
3. **Time controls** — three chips: **Start** (time wheel), **Duration** (quick presets 15/30/45/60/90m + custom), and an **All-day** toggle. Changing start/duration live-previews the block behind the sheet.
4. **Repeat** — a chip showing "Does not repeat"; tapping opens recurrence options: None / Daily / Weekdays / Weekly on [S M T W T F S] / Monthly. (Phase 3.)
5. **Subtasks** — an add-item list; each row is a checkbox + text, reorderable, with a progress ring summarizing.
6. **Notes** — an expanding multiline field.
7. **Footer** — "Delete" (left, muted red) and "Done" (right, accent). On desktop, Esc cancels, Ctrl+Enter saves.

For a task created by tapping a gap, Start is pre-filled; for one created from the FAB, it defaults to the next round half-hour.

---

## 4. Friend's timeline tab

A read-only view of her full day — everything she's planned is visible to you, and vice versa. Same visual structure as your own timeline, but:
- **No edit controls** — tapping a block shows a read-only detail popover (title, time, icon, color, notes). No sheet, no pencil, no delete.
- **Header** shows her name + avatar initial + a green presence dot if she's currently in the app (Supabase Presence).
- **Day navigation** works the same — you can look at her schedule on any date.
- **Loading state** — skeleton blocks while her tasks load; "She hasn't planned this day yet" empty state with her avatar.
- Her tasks use the same color/icon system so the timeline looks familiar.
- A subtle "viewing [Name]'s day" banner at the top so you always know whose timeline you're on.

---

## 5. Chat tab

Simple, focused real-time chat between the two of you.

- **Layout:** messages list (scrollable, newest at bottom) + a fixed input bar at the bottom.
- **Message bubbles:** yours on the right (accent background `#6C5CE7`), hers on the left (surface `#25262B`). Text only for v1 — no media, no reactions.
- **Timestamps:** shown once per cluster of messages within the same ~5-minute window.
- **Unread indicator:** the Chat tab in the nav shows a badge with unread count; clears when you open the tab.
- **Real-time:** new messages appear instantly via Supabase Realtime — no polling, no refresh.
- **Online presence:** a "● Online" or "Last seen 2h ago" line above the input, pulled from Supabase Presence.
- **Empty state:** "Say hi 👋" centered in the message area.

---

## 6. Week view

- Seven narrow day columns across the width, each a mini vertical timeline sharing one hour ruler down the left.
- Blocks render as compact colored bars (color + tiny title, no detail).
- The now-line spans only today's column. Today's column header is accent-highlighted.
- Tap a column header → jumps to that Day view. Tap a block → opens the task editor.
- Horizontal swipe moves week to week. Navigation-first — full editing happens in Day view.

## 7. Month view

- Classic calendar grid, dark. Each cell shows the date number and up to ~3 colored dots (one per task color that day) + a "+n" overflow.
- Today's cell has an accent ring. Days with nothing are flat/empty.
- Tap a day → Day view for that date. Purely for orientation and jumping around.

---

## 8. Recurring tasks — UI details (Phase 3)

- In the editor, the **Repeat** chip summarizes the rule in plain language ("Every weekday", "Weekly on Mon, Wed").
- Recurring occurrences on the timeline carry a small loop glyph in the corner.
- Editing or deleting a recurring occurrence prompts a 3-way choice: **This task** / **This and future** / **All tasks**.
- Completed recurring tasks feed the **streak** indicator: a tiny "🔥 5" appears on the block.

---

## 9. Replan (the "catch-up" flow)

- Reachable from the ⋯ menu or an auto-prompt banner when you open today with overdue tasks: "You have 4 unfinished tasks from before. Replan?"
- Tapping shows a **review sheet**: a list of the overdue tasks, each with a suggested new slot the algorithm found in today's gaps, each toggleable.
- "Place all" drops them onto today's timeline with a brief highlight animation. Rule-based (first-fit into free gaps by duration).

---

## 10. Calendar import — Phase 3

- Settings → "Connect a calendar" → paste a Google Calendar secret **.ics URL**.
- Imported events appear on the timeline with a hatched left border + small calendar glyph. Non-editable; tapping shows a read-only detail popover.

---

## 11. AI brain-dump — Phase 3

- A dedicated "Plan with AI" button in the ⋯ menu → a full-height compose sheet with a large text area: "Tell me about your day…"
- On submit: thinking state, then a **review list** of parsed tasks (title + suggested duration + suggested time), each editable/removable, with "Add all to timeline." Never auto-commits.

---

## 12. Settings

Grouped list, dark:
- **Appearance:** theme (Dark default / Light / System), accent color, font size (S/M/L), timeline density (compact/comfortable), day start hour.
- **Account:** your display name, email, change password, sign out.
- **Notifications:** master toggle, default lead time (at start / 5 / 10 / 15 min before).
- **Calendars (Phase 3):** connected .ics URLs (add/remove).
- **Data:** Export JSON backup, Import JSON.
- **About:** version, "free forever, no ads."

---

## 13. Notifications (surface behavior)

- Fire at task start (or the configured lead time). Content: task icon + title + time.
- Tapping the notification deep-links to that day with the task momentarily highlighted.
- In-app, a task about to start gets a gentle pulse on its block a minute before.

---

## 14. Component checklist (build inventory)

Reusable pieces to build once and reuse:
`TopBar` · `ViewSwitcher` · `AllDayStrip` · `TimeRuler` · `NowLine` · `TaskBlock` · `TaskBlockCompact` (week) · `TaskBlockReadOnly` (friend view) · `GapAffordance` · `FAB` · `BottomNav`/`SideRail` · `InboxList` · `InboxRow` · `TaskSheet` (with `IconPicker`, `ColorStrip`, `TimeWheel`, `DurationPicker`, `SubtaskList`, `NotesField`) · `RecurrenceScopeDialog` · `ReplanSheet` · `FriendTimeline` · `PresenceDot` · `ChatMessageList` · `ChatBubble` · `ChatInput` · `MonthGrid` · `SettingsList` · `Toast`/`Banner`.

---

## 15. Screen-to-feature map (quick reference)

| Screen | Features it delivers |
|--------|----------------------|
| My Day (timeline) | T1–T8, D1–D4, N1 in-app, gap-add |
| Inbox | T5, quick capture |
| Task Sheet | T2, D1–D5, S1 entry (Phase 3), color/icon |
| Friend tab | C2, C4 presence |
| Chat tab | C3, C4 presence |
| Week / Month | S5 navigation |
| Replan sheet | S2 |
| Settings → Calendars | S3 (Phase 3) |
| Brain-dump sheet | A1 (Phase 3) |
| Settings | P3, N1 config, data export/import, account |

---

*Next step: scaffold the Vite + React + TS PWA and build Phase 1 (My Day timeline + Task Sheet + Inbox + offline). Social layer (Supabase) comes in Phase 2.*
