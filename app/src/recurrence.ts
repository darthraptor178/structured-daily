import { db } from './db'
import type { Task } from './types'
import { taskOccursOn } from './recurrenceRules'

/** Create durable, independently completable occurrences when a day is opened. */
export async function materializeRecurringForDate(iso: string) {
  const templates = (await db.tasks.toArray()).filter((task) => !task.recurrenceParentId && taskOccursOn(task, iso))
  const occurrences = templates
    .filter((task) => task.date !== iso)
    .map((task): Task => ({
      ...task,
      id: `rec:${task.id}:${iso}`,
      date: iso,
      done: false,
      recurrence: undefined,
      recurrenceParentId: task.id,
      createdAt: Date.now(),
    }))
  if (!occurrences.length) return
  const existing = await db.tasks.bulkGet(occurrences.map((task) => task.id))
  const newOccurrences = occurrences.filter((_, index) => existing[index] === undefined)
  if (newOccurrences.length) await db.tasks.bulkAdd(newOccurrences)
}
