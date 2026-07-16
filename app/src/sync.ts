import { supabase } from './supabase'
import { db } from './db'
import type { Task, ChatMessage, Recurrence } from './types'

/**
 * Sync layer: Dexie stays the UI's source of truth (offline-first, instant),
 * Supabase Postgres is the shared source of truth between the two users.
 *
 * - Local writes are mirrored to Supabase via Dexie hooks (only rows owned by me).
 * - Remote changes arrive over Supabase Realtime and are applied back into Dexie.
 * - `applyingRemote` suppresses the hooks while remote rows are written locally,
 *   so changes never echo back and forth.
 */

let myUid = ''
let applyingRemote = false
let started = false

type TaskRow = {
  id: string
  user_id: string
  title: string
  icon: string
  color: string
  date: string | null
  start_min: number | null
  duration_min: number
  notes: string
  subtasks: { text: string; done: boolean }[]
  done: boolean
  created_at: number
  recurrence?: Recurrence | null
  recurrence_parent_id?: string | null
  telegram_reminder_min?: number | null
  telegram_remind_at?: number | null
  telegram_reminder_sent_at?: number | null
}
type MessageRow = { id: string; sender: string; text: string; at: number; read_at?: number | null }

const toLocalTask = (r: TaskRow): Task => ({
  id: r.id,
  userId: r.user_id === myUid ? 'me' : 'friend',
  title: r.title,
  icon: r.icon,
  color: r.color,
  date: r.date,
  startMin: r.start_min,
  durationMin: r.duration_min,
  notes: r.notes,
  subtasks: r.subtasks ?? [],
  done: r.done,
  createdAt: r.created_at,
  recurrence: r.recurrence ?? undefined,
  recurrenceParentId: r.recurrence_parent_id ?? undefined,
  telegramReminderMin: r.telegram_reminder_min ?? undefined,
  telegramRemindAt: r.telegram_remind_at ?? undefined,
  telegramReminderSentAt: r.telegram_reminder_sent_at ?? undefined,
})

const toRowTask = (t: Task): TaskRow => ({
  id: t.id,
  user_id: myUid,
  title: t.title,
  icon: t.icon,
  color: t.color,
  date: t.date,
  start_min: t.startMin,
  duration_min: t.durationMin,
  notes: t.notes,
  subtasks: t.subtasks,
  done: t.done,
  created_at: t.createdAt,
  recurrence: t.recurrence ?? null,
  recurrence_parent_id: t.recurrenceParentId ?? null,
  telegram_reminder_min: t.telegramReminderMin ?? null,
  telegram_remind_at: t.telegramRemindAt ?? null,
  telegram_reminder_sent_at: t.telegramReminderSentAt ?? null,
})

const toLocalMsg = (r: MessageRow): ChatMessage => ({
  id: r.id,
  from: r.sender === myUid ? 'me' : 'friend',
  text: r.text,
  at: r.at,
  readAt: r.read_at ?? undefined,
})

async function applyLocally(fn: () => Promise<unknown>) {
  applyingRemote = true
  try { await fn() } finally { applyingRemote = false }
}

function pushTask(t: Task) {
  if (applyingRemote || t.userId !== 'me') return
  supabase!.from('tasks').upsert(toRowTask(t)).then(({ error }) => {
    if (error) console.error('[sync] task push failed:', error.message)
  })
}

function registerHooks() {
  db.tasks.hook('creating', (_pk, obj) => { pushTask(obj as Task) })
  db.tasks.hook('updating', (mods, _pk, obj) => {
    const merged = { ...(obj as Task), ...(mods as Partial<Task>) }
    pushTask(merged)
  })
  db.tasks.hook('deleting', (_pk, obj) => {
    const t = obj as Task
    if (applyingRemote || t.userId !== 'me') return
    supabase!.from('tasks').delete().eq('id', t.id).then(({ error }) => {
      if (error) console.error('[sync] task delete failed:', error.message)
    })
  })
  db.messages.hook('creating', (_pk, obj) => {
    const m = obj as ChatMessage
    if (applyingRemote || m.from !== 'me') return
    supabase!.from('messages').insert({ id: m.id, sender: myUid, text: m.text, at: m.at, read_at: null })
      .then(({ error }) => { if (error) console.error('[sync] message push failed:', error.message) })
  })
  db.messages.hook('updating', (mods, pk, obj) => {
    const message = obj as ChatMessage
    const changes = mods as Partial<ChatMessage>
    if (applyingRemote || message.from !== 'friend' || changes.readAt === undefined) return
    supabase!.from('messages').update({ read_at: changes.readAt }).eq('id', pk as string)
      .then(({ error }) => { if (error) console.error('[sync] read receipt failed:', error.message) })
  })
}

async function initialPull() {
  const [tasksRes, msgsRes] = await Promise.all([
    supabase!.from('tasks').select('*'),
    supabase!.from('messages').select('*').order('at'),
  ])
  if (tasksRes.error) throw tasksRes.error
  if (msgsRes.error) throw msgsRes.error
  await applyLocally(async () => {
    await db.transaction('rw', db.tasks, db.messages, async () => {
      await db.tasks.clear()
      await db.messages.clear()
      await db.tasks.bulkAdd((tasksRes.data as TaskRow[]).map(toLocalTask))
      await db.messages.bulkAdd((msgsRes.data as MessageRow[]).map(toLocalMsg))
    })
  })
}

function subscribeRealtime() {
  supabase!
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
      applyLocally(async () => {
        if (payload.eventType === 'DELETE') {
          await db.tasks.delete((payload.old as { id: string }).id)
        } else {
          await db.tasks.put(toLocalTask(payload.new as TaskRow))
        }
      })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
      applyLocally(() => db.messages.put(toLocalMsg(payload.new as MessageRow)))
    })
    .subscribe()
}

/* ── Presence (online indicator) ────────────────────────────── */
let friendOnline = false
const presenceListeners = new Set<() => void>()
export const presenceStore = {
  subscribe(cb: () => void) { presenceListeners.add(cb); return () => presenceListeners.delete(cb) },
  isFriendOnline: () => friendOnline,
}

function startPresence() {
  const channel = supabase!.channel('presence:main', { config: { presence: { key: myUid } } })
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const next = Object.keys(state).some((k) => k !== myUid)
      if (next !== friendOnline) {
        friendOnline = next
        presenceListeners.forEach((cb) => cb())
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ online_at: Date.now() })
    })
}

/** Call once after login. Pulls state, mirrors local writes, listens for remote changes. */
export async function startSync(uid: string) {
  if (started) return
  started = true
  myUid = uid
  registerHooks()
  await initialPull()
  subscribeRealtime()
  startPresence()
}
