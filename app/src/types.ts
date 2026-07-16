export interface Subtask {
  text: string
  done: boolean
}

export interface Recurrence {
  /** Daily, weekdays, or specific days of the week (0 = Sunday). */
  frequency: 'daily' | 'weekly'
  days?: number[]
}

export interface Task {
  id: string
  userId: 'me' | 'friend'
  title: string
  icon: string
  color: string
  /** ISO date "2026-07-05", or null when the task sits in the inbox */
  date: string | null
  /** minutes from midnight, or null for all-day tasks */
  startMin: number | null
  durationMin: number
  notes: string
  subtasks: Subtask[]
  done: boolean
  createdAt: number
  /** Only set on the template task; occurrences are independent tasks. */
  recurrence?: Recurrence
  recurrenceParentId?: string
  /** Optional Telegram reminder lead time in minutes (0 = at start). */
  telegramReminderMin?: number
  telegramRemindAt?: number
  telegramReminderSentAt?: number
}

export interface ChatMessage {
  id: string
  from: 'me' | 'friend'
  text: string
  at: number
  /** When the other person opened this message. */
  readAt?: number
}

/** Hard cap on task length: 4 hours. */
export const MAX_DURATION = 240

export const TASK_COLORS = [
  { name: 'indigo', hex: '#6C5CE7' },
  { name: 'violet', hex: '#A06EE1' },
  { name: 'rose', hex: '#FF6BAD' },
  { name: 'coral', hex: '#FF7F78' },
  { name: 'amber', hex: '#FFB347' },
  { name: 'sun', hex: '#FFD93D' },
  { name: 'lime', hex: '#A8E063' },
  { name: 'mint', hex: '#70E1B1' },
  { name: 'teal', hex: '#4ECDC4' },
  { name: 'sky', hex: '#4CC9F0' },
  { name: 'blue', hex: '#4361EE' },
  { name: 'slate', hex: '#778CA3' },
]

export const QUICK_ICONS = [
  '📝', '💻', '📚', '🏋️', '🍳', '🛒', '☎️', '🧹',
  '🎯', '🎨', '🎮', '🎧', '🚿', '😴', '🚌', '☕',
  '🧠', '💊', '🐕', '🌱', '💬', '📅', '🍽️', '✈️',
]

export function todayISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

export function fmtTime(min: number): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

export function fmtRange(start: number, dur: number): string {
  return `${fmtTime(start)} – ${fmtTime(start + dur)}`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
