import type { Task } from './types'

function dayOfWeek(iso: string) {
  return new Date(iso + 'T12:00:00').getDay()
}

/** Pure recurrence matcher, kept separate so the scheduling rules are testable. */
export function taskOccursOn(template: Task, iso: string) {
  if (!template.recurrence || !template.date || template.date > iso) return false
  if (template.recurrence.frequency === 'daily') return true
  const days = template.recurrence.days?.length ? template.recurrence.days : [dayOfWeek(template.date)]
  return days.includes(dayOfWeek(iso))
}
