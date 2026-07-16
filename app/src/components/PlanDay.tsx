import { useEffect, useMemo, useState } from 'react'
import type { Task } from '../types'
import { fmtRange, shiftISO, uid } from '../types'
import { db } from '../db'
import { cloudEnabled, supabase } from '../supabase'
import { normalizeAIPlan, planDayLocally, type PlannedTask } from '../planner'

interface Props {
  date: string
  defaultStart: number
  existingTasks: Task[]
  onClose: () => void
}

const EXAMPLE = '1h making PPT, then 1h reviewing the paper, then 6–8 pm presentation'

export default function PlanDay({ date, defaultStart, existingTasks, onClose }: Props) {
  const [input, setInput] = useState('')
  const [plan, setPlan] = useState<PlannedTask[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const selectedCount = useMemo(() => plan.filter((task) => task.selected).length, [plan])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const makePlan = async () => {
    if (!input.trim()) return
    const deleteMatch = /^\s*(?:delete|remove|clear)\s+(?:all\s+)?(?:my\s+)?tasks?(?:\s+for\s+(today|tomorrow))?\s*[.!]?\s*$/i.exec(input)
    if (deleteMatch) {
      const targetDate = deleteMatch[1]?.toLowerCase() === 'tomorrow' ? shiftISO(date, 1) : date
      setDeleteTarget(targetDate)
      setPlan([])
      setNotice('')
      return
    }
    setLoading(true)
    setNotice('')
    let next: PlannedTask[] = []
    let aiFailure = ''
    if (cloudEnabled && supabase) {
      const { data, error } = await supabase.functions.invoke('plan-day', {
        body: {
          text: input.trim(), date, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          defaultStart,
          existingTasks: existingTasks.filter((task) => task.startMin !== null).map(({ title, date: taskDate, startMin, durationMin }) => ({ title, date: taskDate, startMin, durationMin })),
        },
      })
      if (!error) {
        next = normalizeAIPlan(data, date, existingTasks)
        // Guard against an AI response that drops the relative-day word. If the
        // request is explicitly for tomorrow and every returned task landed on
        // the selected date, move the whole plan forward one day.
        if (/\btomorrow\b/i.test(input) && !/\btoday\b/i.test(input) && next.length && next.every((task) => task.date === date)) {
          next = next.map((task) => ({ ...task, date: shiftISO(date, 1) }))
        }
      }
      else {
        aiFailure = 'The AI service could not make a plan'
        try {
          const details = await error.context?.json()
          if (typeof details?.error === 'string') aiFailure = details.error
        } catch { /* The fallback below remains available. */ }
      }
    }
    if (!next.length) {
      next = planDayLocally(input, date, defaultStart, existingTasks)
      setNotice(`${aiFailure ? `${aiFailure}. ` : ''}Quick planning mode used—review times before adding.`)
    } else {
      setNotice('Planned with Gemini 3.1 Flash-Lite.')
    }
    setPlan(next)
    setLoading(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const tasks = await db.tasks.where('date').equals(deleteTarget).filter((task) => task.userId === 'me').toArray()
    await db.tasks.bulkDelete(tasks.map((task) => task.id))
    setDeleting(false)
    setDeleteTarget(null)
    setInput('')
    setNotice(`${tasks.length} task${tasks.length === 1 ? '' : 's'} deleted.`)
  }

  const update = (id: string, patch: Partial<PlannedTask>) => {
    setPlan((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item))
  }

  const addTasks = async () => {
    const selected = plan.filter((task) => task.selected)
    if (!selected.length) return
    setSaving(true)
    const createdAt = Date.now()
    await db.tasks.bulkPut(selected.map((task, index): Task => ({
      id: uid(), userId: 'me', title: task.title, icon: task.icon, color: task.color,
      date: task.date, startMin: task.startMin, durationMin: task.durationMin,
      notes: '', subtasks: [], done: false, createdAt: createdAt + index,
    })))
    setSaving(false)
    onClose()
  }

  return (
    <div className="overlay planner-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="planner" role="dialog" aria-modal="true" aria-labelledby="planner-title">
        <header className="planner-head">
          <div className="planner-spark"><span className="msym fill">auto_awesome</span></div>
          <div>
            <div className="planner-kicker">AI DAY PLANNER</div>
            <h2 id="planner-title">Turn a rough list into a timeline</h2>
          </div>
          <button className="iconbtn" onClick={onClose} aria-label="Close planner"><span className="msym">close</span></button>
        </header>

        <div className="planner-prompt">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe the day in any order…"
            autoFocus
            maxLength={3000}
            aria-label="Describe your day"
          />
          <div className="planner-prompt-foot">
            <button className="planner-example" onClick={() => setInput(EXAMPLE)}>Try an example</button>
            <span>{input.length}/3000</span>
            <button className="planner-generate" disabled={!input.trim() || loading} onClick={makePlan}>
              <span className={`msym ${loading ? 'planner-spin' : 'fill'}`}>{loading ? 'progress_activity' : 'auto_awesome'}</span>
              {loading ? 'Planning…' : plan.length ? 'Plan again' : 'Make a plan'}
            </button>
          </div>
        </div>

        {notice && <div className="planner-notice"><span className="msym">info</span>{notice}</div>}

        {deleteTarget ? (
          <div className="planner-delete-confirm">
            <span className="msym fill">delete_sweep</span>
            <strong>Delete all tasks for {deleteTarget === date ? 'this day' : 'tomorrow'}?</strong>
            <p>This removes only your tasks on that date and cannot be undone.</p>
            <div className="planner-delete-actions">
              <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn ghost-danger" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting…' : 'Delete tasks'}</button>
            </div>
          </div>
        ) : plan.length > 0 ? (
          <div className="planner-review">
            <div className="planner-review-head"><strong>Review your day</strong><span>{selectedCount} of {plan.length} selected</span></div>
            <div className="planner-list">
              {plan.map((task) => (
                <article className={`planner-item ${task.selected ? '' : 'off'}`} key={task.id}>
                  <button className="planner-check" onClick={() => update(task.id, { selected: !task.selected })} aria-label={`${task.selected ? 'Remove' : 'Add'} ${task.title}`}>
                    <span className="msym fill">{task.selected ? 'check_circle' : 'radio_button_unchecked'}</span>
                  </button>
                  <div className="planner-icon" style={{ background: `${task.color}22`, color: task.color }}>{task.icon}</div>
                  <div className="planner-item-main">
                    <input value={task.title} onChange={(event) => update(task.id, { title: event.target.value })} aria-label="Task title" />
                    <div className="planner-time">{fmtRange(task.startMin, task.durationMin)} · {task.durationMin} min</div>
                  </div>
                  {task.conflict && <span className="planner-conflict" title="Overlaps another task">Overlap</span>}
                  <button className="iconbtn sm" onClick={() => setPlan((items) => items.filter((item) => item.id !== task.id))} aria-label={`Delete ${task.title}`} title="Delete task">
                    <span className="msym">delete</span>
                  </button>
                </article>
              ))}
            </div>
            <footer className="planner-actions">
              <span>You can move or resize tasks after adding them.</span>
              <button className="planner-add" disabled={!selectedCount || saving} onClick={addTasks}>
                {saving ? 'Adding…' : `Add ${selectedCount} task${selectedCount === 1 ? '' : 's'}`}
              </button>
            </footer>
          </div>
        ) : (
          <div className="planner-empty">
            <span className="msym">route</span>
            <strong>Dates, durations, fixed times—write them naturally.</strong>
            <span>Flexible tasks are placed around the times you specify.</span>
          </div>
        )}
      </section>
    </div>
  )
}
