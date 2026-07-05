import { useEffect, useState } from 'react'
import type { Task, Subtask } from '../types'
import { TASK_COLORS, QUICK_ICONS, fmtTime, MAX_DURATION } from '../types'
import { db } from '../db'
import { DatePicker, TimePicker } from './pickers'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]

interface Props {
  task: Task // draft (existing or new — new tasks have isNew)
  isNew: boolean
  onClose: () => void
}

export default function TaskSheet({ task, isNew, onClose }: Props) {
  const [draft, setDraft] = useState<Task>(task)
  const [showIcons, setShowIcons] = useState(false)
  const [newSub, setNewSub] = useState('')

  const set = (patch: Partial<Task>) => setDraft((d) => ({ ...d, ...patch }))

  const save = async () => {
    const final = { ...draft, title: draft.title.trim() || 'Untitled' }
    if (newSub.trim()) final.subtasks = [...final.subtasks, { text: newSub.trim(), done: false }]
    await db.tasks.put(final)
    onClose()
  }
  const remove = async () => {
    if (!isNew) await db.tasks.delete(draft.id)
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const setSub = (i: number, patch: Partial<Subtask>) =>
    set({ subtasks: draft.subtasks.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  const isAllDay = draft.date !== null && draft.startMin === null
  const isInbox = draft.date === null

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label="Task editor">
        <div className="sheet-body">
          <div className="sheet-title-row">
            <button className="icon-tile" onClick={() => setShowIcons(!showIcons)} aria-label="Choose icon">
              {draft.icon}
              <span className="dot" style={{ background: draft.color }} />
            </button>
            <input
              className="title-input"
              placeholder="What's the task?"
              value={draft.title}
              autoFocus={isNew}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>

          {showIcons && (
            <div>
              <div className="emoji-grid">
                {QUICK_ICONS.map((ic) => (
                  <button key={ic} onClick={() => { set({ icon: ic }); setShowIcons(false) }}>{ic}</button>
                ))}
              </div>
              <div className="swatches" style={{ marginTop: 12 }}>
                {TASK_COLORS.map((c) => (
                  <button
                    key={c.name}
                    className={`swatch ${draft.color === c.hex ? 'on' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => set({ color: c.hex })}
                    aria-label={c.name}
                  />
                ))}
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) => set({ color: e.target.value })}
                  style={{ width: 28, height: 28, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  aria-label="Custom color"
                />
              </div>
            </div>
          )}

          <div>
            <div className="field-label"><span className="msym" style={{ fontSize: 16 }}>schedule</span> Schedule</div>
            <div className="seg-row" style={{ alignItems: 'center' }}>
              <DatePicker
                value={draft.date}
                allowInbox
                onChange={(iso) => set({ date: iso, startMin: iso === null ? null : draft.startMin })}
              />
              {!isInbox && !isAllDay && (
                <TimePicker value={draft.startMin ?? 9 * 60} onChange={(min) => set({ startMin: min })} />
              )}
              {!isInbox && (
                <button type="button" className={`seg ${isAllDay ? 'on' : ''}`} onClick={() => set({ startMin: isAllDay ? 9 * 60 : null })}>
                  All-day
                </button>
              )}
              {isInbox && <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Sits in the inbox until you pick a date</span>}
            </div>
          </div>

          {!isAllDay && (
            <div>
              <div className="field-label"><span className="msym" style={{ fontSize: 16 }}>hourglass_empty</span> Duration</div>
              <div className="seg-row">
                {DURATIONS.map((d) => (
                  <button key={d} className={`seg ${draft.durationMin === d ? 'on' : ''}`} onClick={() => set({ durationMin: d })}>
                    {d < 60 ? `${d}m` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''}`}
                  </button>
                ))}
              </div>
              {draft.startMin != null && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  {fmtTime(draft.startMin)} → {fmtTime(draft.startMin + draft.durationMin)}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="field-label">
              <span className="msym" style={{ fontSize: 16 }}>checklist</span> Subtasks
              {draft.subtasks.length > 0 && (
                <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0 }}>
                  {draft.subtasks.filter((s) => s.done).length}/{draft.subtasks.length}
                </span>
              )}
            </div>
            {draft.subtasks.map((s, i) => (
              <div key={i} className={`subtask-row ${s.done ? 'done' : ''}`}>
                <button
                  className={`tb-check ${s.done ? 'checked' : ''}`}
                  style={{ color: draft.color }}
                  onClick={() => setSub(i, { done: !s.done })}
                  aria-label="Toggle subtask"
                >
                  {s.done && <span className="msym">check</span>}
                </button>
                <input type="text" value={s.text} onChange={(e) => setSub(i, { text: e.target.value })} />
                <button className="del" onClick={() => set({ subtasks: draft.subtasks.filter((_, j) => j !== i) })} aria-label="Remove subtask">
                  <span className="msym" style={{ fontSize: 17 }}>close</span>
                </button>
              </div>
            ))}
            <div className="subtask-row">
              <span className="msym" style={{ fontSize: 18, color: 'var(--text-3)', width: 19, textAlign: 'center' }}>add</span>
              <input
                type="text"
                placeholder="Add subtask…"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSub.trim()) {
                    set({ subtasks: [...draft.subtasks, { text: newSub.trim(), done: false }] })
                    setNewSub('')
                  }
                }}
              />
            </div>
          </div>

          <div>
            <div className="field-label"><span className="msym" style={{ fontSize: 16 }}>subject</span> Notes</div>
            <textarea
              className="notes"
              placeholder="Add context, links, or notes…"
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </div>

        <div className="sheet-footer">
          <button className="btn ghost-danger" onClick={remove}>{isNew ? 'Discard' : 'Delete'}</button>
          <button className="btn primary" onClick={save}>Done</button>
        </div>
      </div>
    </div>
  )
}
