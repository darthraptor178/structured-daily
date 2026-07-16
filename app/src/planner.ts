import type { Task } from './types'
import { MAX_DURATION, shiftISO, uid } from './types'

export interface PlannedTask {
  id: string
  title: string
  date: string
  startMin: number
  durationMin: number
  icon: string
  color: string
  selected: boolean
  conflict?: boolean
}

const LOOKS = [
  { match: /ppt|presentation|slide|deck/i, icon: '📊', color: '#A06EE1' },
  { match: /paper|read|review|study|research/i, icon: '📚', color: '#4CC9F0' },
  { match: /gym|workout|run|exercise/i, icon: '🏋️', color: '#FF7F78' },
  { match: /call|meeting|interview|sync/i, icon: '💬', color: '#4ECDC4' },
  { match: /cook|lunch|dinner|breakfast|eat/i, icon: '🍳', color: '#FFB347' },
  { match: /code|build|develop|project/i, icon: '💻', color: '#6C5CE7' },
]

function lookFor(title: string) {
  return LOOKS.find((look) => look.match.test(title)) ?? { icon: '📝', color: '#6C5CE7' }
}

function parseDuration(text: string) {
  const match = /\b(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)(?:\s*(\d+)\s*(?:m|min|mins|minutes?))?|(\d+)\s*(?:m|min|mins|minutes?))\b/i.exec(text)
  if (!match) return { durationMin: undefined, text }
  const durationMin = Math.min(MAX_DURATION, Math.max(5, Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? match[3] ?? 0))))
  return { durationMin, text: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` }
}

function hourToMinutes(hourText: string, minuteText?: string, meridiem?: string, hint = '') {
  let hour = Number(hourText)
  const minute = Number(minuteText ?? 0)
  const period = meridiem?.toLowerCase()
  if (period === 'am') hour %= 12
  else if (period === 'pm') hour = (hour % 12) + 12
  else if (/morning|am\b/i.test(hint)) hour %= 12
  else if (/evening|night|pm\b/i.test(hint) || hour <= 7) hour = (hour % 12) + 12
  return hour * 60 + minute
}

function parseRange(text: string) {
  const range = /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(text)
  if (!range) return { text }
  const sharedPeriod = range[6] ?? range[3]
  const startMin = hourToMinutes(range[1], range[2], range[3] ?? sharedPeriod, text)
  let endMin = hourToMinutes(range[4], range[5], range[6] ?? sharedPeriod, text)
  if (endMin <= startMin) endMin += 12 * 60
  return {
    text: `${text.slice(0, range.index)} ${text.slice(range.index + range[0].length)}`,
    startMin,
    durationMin: Math.min(MAX_DURATION, endMin - startMin),
  }
}

function parseStart(text: string) {
  const match = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)([01]?\d|2[0-3]):([0-5]\d)\b/i.exec(text)
  if (!match) return { text }
  const startMin = match[1]
    ? hourToMinutes(match[1], match[2], match[3], text)
    : Number(match[4]) * 60 + Number(match[5])
  return { text: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`, startMin }
}

function cleanTitle(text: string) {
  return text
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/\b(?:today|tomorrow|morning|afternoon|evening|tonight)\b/gi, '')
    .replace(/^\s*(?:and\s+)?(?:then\s+)?/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.:\s-]+|[,.:\s-]+$/g, '')
    .trim()
}

function overlaps(startMin: number, durationMin: number, task: Pick<Task, 'startMin' | 'durationMin'> | PlannedTask) {
  return task.startMin !== null && startMin < task.startMin + task.durationMin && task.startMin < startMin + durationMin
}

/** Fast, no-network planner used when the optional AI service is unavailable. */
export function planDayLocally(input: string, date: string, defaultStart: number, existing: Task[] = []): PlannedTask[] {
  const targetDate = /\btomorrow\b/i.test(input) ? shiftISO(date, 1) : date
  const chunks = input
    .replace(/\r/g, '')
    .split(/\n+|\s*;\s*|\s*,\s*(?=(?:then\s+)?(?:\d+(?:\.\d+)?\s*(?:h|hr|m|min)|\d+[.)]))|\s+then\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)

  let cursor = Math.max(0, Math.min(defaultStart, 23 * 60))
  const planned: PlannedTask[] = []

  for (const chunk of chunks) {
    const range = parseRange(chunk)
    const duration = parseDuration(range.text)
    const start = parseStart(duration.text)
    const title = cleanTitle(start.text) || 'Untitled task'
    const durationMin = range.durationMin ?? duration.durationMin ?? 45
    const explicitStart = range.startMin ?? start.startMin
    let startMin = explicitStart ?? cursor

    if (explicitStart === undefined) {
      while ([...existing, ...planned].some((task) => task.date === targetDate && overlaps(startMin, durationMin, task))) {
        startMin += 15
      }
    }
    startMin = Math.max(0, Math.min(startMin, 24 * 60 - Math.min(durationMin, 24 * 60)))
    const conflict = [...existing, ...planned].some((task) => task.date === targetDate && overlaps(startMin, durationMin, task))
    const look = lookFor(title)
    planned.push({ id: uid(), title, date: targetDate, startMin, durationMin, ...look, selected: true, conflict })
    cursor = Math.min(23 * 60, startMin + durationMin)
  }

  return planned
}

export function normalizeAIPlan(value: unknown, fallbackDate: string, existing: Task[]): PlannedTask[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { tasks?: unknown }).tasks)) return []
  const result: PlannedTask[] = []
  for (const raw of (value as { tasks: unknown[] }).tasks.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const title = String(item.title ?? '').trim().slice(0, 160)
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) ? String(item.date) : fallbackDate
    const startMin = Math.round(Number(item.startMin))
    const durationMin = Math.round(Number(item.durationMin))
    if (!title || !Number.isFinite(startMin) || startMin < 0 || startMin >= 1440 || !Number.isFinite(durationMin) || durationMin < 5) continue
    const look = lookFor(title)
    const safeDuration = Math.min(MAX_DURATION, durationMin, 1440 - startMin)
    result.push({
      id: uid(), title, date, startMin, durationMin: safeDuration,
      icon: typeof item.icon === 'string' && item.icon.length <= 8 ? item.icon : look.icon,
      color: typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : look.color,
      selected: true,
      conflict: [...existing, ...result].some((task) => task.date === date && overlaps(startMin, safeDuration, task)),
    })
  }
  return result
}
