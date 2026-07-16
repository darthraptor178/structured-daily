import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Task } from '../types'
import { uid } from '../types'

interface Props {
  onEdit: (t: Task) => void
  onSchedule: (t: Task) => void
}

export default function Inbox({ onEdit, onSchedule }: Props) {
  const [text, setText] = useState('')
  const items = useLiveQuery(
    () => db.tasks.where('userId').equals('me').filter((t) => t.date === null).sortBy('createdAt'),
    [],
  )

  const add = async () => {
    const title = text.trim()
    if (!title) return
    await db.tasks.add({
      id: uid(), userId: 'me', title, icon: '📝', color: '#6C5CE7',
      date: null, startMin: null, durationMin: 30, notes: '', subtasks: [], done: false, createdAt: Date.now(),
    })
    setText('')
  }

  return (
    <div className="page">
      <div className="quickadd">
        <input
          placeholder="Add to inbox…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} aria-label="Add to inbox"><span className="msym fill">add_circle</span></button>
      </div>

      {items && items.length === 0 && (
        <div className="empty">
          <span className="msym">inbox</span>
          <div>Inbox zero. Enjoy the quiet.</div>
        </div>
      )}

      {items?.map((t) => (
        <div key={t.id} className="inbox-card" style={{ borderLeftColor: t.color }}>
          <div style={{ fontSize: 22 }}>{t.icon}</div>
          <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => onEdit(t)}>
            <div className="ic-title">{t.title}</div>
            <div className="ic-meta">
              <span className="msym" style={{ fontSize: 14 }}>schedule</span> ~{t.durationMin}m
            </div>
          </div>
          <div className="actions">
            <button className="pill accent" title="Pick a time today" onClick={() => onSchedule(t)}>
              <span className="msym" style={{ fontSize: 15, verticalAlign: '-3px' }}>today</span> Schedule
            </button>
            <button className="iconbtn" title="Edit" onClick={() => onEdit(t)}>
              <span className="msym">edit</span>
            </button>
            <button className="iconbtn" title="Delete" aria-label={`Delete ${t.title}`} onClick={() => db.tasks.delete(t.id)}>
              <span className="msym">delete</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
