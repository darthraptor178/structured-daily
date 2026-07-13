import Dexie, { type Table } from 'dexie'
import type { Task, ChatMessage } from './types'
import { uid, todayISO } from './types'

class StructuredDB extends Dexie {
  tasks!: Table<Task, string>
  messages!: Table<ChatMessage, string>

  constructor() {
    super('structured-daily')
    this.version(1).stores({
      tasks: 'id, userId, date, [userId+date]',
      messages: 'id, at',
    })
    this.version(2).stores({
      tasks: 'id, userId, date, [userId+date], recurrenceParentId',
      messages: 'id, at, from, readAt',
    })
  }
}

export const db = new StructuredDB()

/** Seed demo data on first run so every screen has something to show. */
export async function seedIfEmpty() {
  const count = await db.tasks.count()
  if (count > 0) return
  const today = todayISO()
  const mk = (t: Partial<Task>): Task => ({
    id: uid(),
    userId: 'me',
    title: '',
    icon: '📝',
    color: '#6C5CE7',
    date: today,
    startMin: null,
    durationMin: 30,
    notes: '',
    subtasks: [],
    done: false,
    createdAt: Date.now(),
    ...t,
  })
  await db.tasks.bulkAdd([
    mk({ title: 'Morning routine', icon: '🚿', color: '#70E1B1', startMin: 8 * 60, durationMin: 45 }),
    mk({ title: 'Deep work', icon: '💻', color: '#6C5CE7', startMin: 9 * 60 + 30, durationMin: 120, subtasks: [{ text: 'Design timeline component', done: true }, { text: 'Wire up drag & drop', done: false }] }),
    mk({ title: 'Lunch', icon: '🍽️', color: '#FFB347', startMin: 13 * 60, durationMin: 60 }),
    mk({ title: 'Gym', icon: '🏋️', color: '#FF7F78', startMin: 18 * 60, durationMin: 75 }),
    mk({ title: 'Drink 2L water', icon: '💧', color: '#4CC9F0' }),
    mk({ title: 'Call bank', icon: '☎️', color: '#FFD93D', date: null, durationMin: 15 }),
    mk({ title: 'Read chapter 4', icon: '📚', color: '#A06EE1', date: null, durationMin: 45 }),
    // Friend demo schedule (replaced by Supabase realtime in Phase 2)
    mk({ userId: 'friend', title: 'College classes', icon: '🎓', color: '#4361EE', startMin: 9 * 60, durationMin: 180 }),
    mk({ userId: 'friend', title: 'Lunch', icon: '🍜', color: '#FFB347', startMin: 13 * 60 + 30, durationMin: 45 }),
    mk({ userId: 'friend', title: 'Study session', icon: '📖', color: '#FF6BAD', startMin: 16 * 60, durationMin: 90 }),
  ])
  await db.messages.bulkAdd([
    { id: uid(), from: 'friend', text: 'Hey! Free after 6?', at: Date.now() - 3600_000 },
    { id: uid(), from: 'me', text: 'Gym till 7:15, after that yes 👍', at: Date.now() - 3500_000 },
  ])
}
