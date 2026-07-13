import { MAX_DURATION } from './types'

export interface SmartTaskInput {
  title: string
  durationMin?: number
  startMin?: number
}

/**
 * Pull scheduling details out of natural task text without guessing a date.
 * Examples: "Study 1h 12:30 pm", "Gym 45m at 8pm", "Read 1h 30m 18:15".
 */
export function parseSmartTask(input: string): SmartTaskInput {
  let rest = input.trim()
  let durationMin: number | undefined
  let startMin: number | undefined

  const duration = /\b(\d+)\s*(?:h|hr|hrs|hour|hours)\b(?:\s*(\d+)\s*(?:m|min|mins|minute|minutes)\b)?|\b(\d+)\s*(?:m|min|mins|minute|minutes)\b/i.exec(rest)
  if (duration) {
    const hours = Number(duration[1] ?? 0)
    const mins = Number(duration[2] ?? duration[3] ?? 0)
    const parsed = hours * 60 + mins
    if (parsed > 0) durationMin = Math.min(parsed, MAX_DURATION)
    rest = rest.slice(0, duration.index) + rest.slice((duration.index ?? 0) + duration[0].length)
  }

  const named = /\b(noon|midnight)\b/i.exec(rest)
  const ampm = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(rest)
  const clock24 = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i.exec(rest)
  if (named) {
    startMin = named[1].toLowerCase() === 'noon' ? 12 * 60 : 0
    rest = rest.slice(0, named.index) + rest.slice((named.index ?? 0) + named[0].length)
  } else if (ampm) {
    let hour = Number(ampm[1]) % 12
    if (ampm[3].toLowerCase() === 'pm') hour += 12
    startMin = hour * 60 + Number(ampm[2] ?? 0)
    rest = rest.slice(0, ampm.index) + rest.slice((ampm.index ?? 0) + ampm[0].length)
  } else if (clock24) {
    startMin = Number(clock24[1]) * 60 + Number(clock24[2])
    rest = rest.slice(0, clock24.index) + rest.slice((clock24.index ?? 0) + clock24[0].length)
  }

  return { title: rest.replace(/\s{2,}/g, ' ').trim(), durationMin, startMin }
}
