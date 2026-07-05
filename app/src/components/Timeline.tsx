import { useEffect, useRef, useState } from 'react'
import type { Task } from '../types'
import { fmtRange, fmtTime, todayISO, MAX_DURATION } from '../types'

const PX_PER_MIN = 1
const SNAP = 5
const DAY_MIN = 24 * 60

interface Props {
  tasks: Task[] // timed tasks for one date, one user
  date: string
  readonly?: boolean
  onEdit?: (t: Task) => void
  onToggle?: (t: Task) => void
  onMove?: (t: Task, startMin: number) => void
  onResize?: (t: Task, durationMin: number) => void
  onGapTap?: (startMin: number) => void
}

/** Assign overlapping tasks to side-by-side columns (interval partitioning). */
function layoutColumns(tasks: Task[]): Map<string, { col: number; cols: number }> {
  const sorted = [...tasks].sort((a, b) => (a.startMin! - b.startMin!) || (b.durationMin - a.durationMin))
  const result = new Map<string, { col: number; cols: number }>()
  let cluster: Task[] = []
  let clusterEnd = -1

  const flush = () => {
    if (!cluster.length) return
    const colEnd: number[] = []
    const assign = new Map<string, number>()
    for (const t of cluster) {
      let col = colEnd.findIndex((end) => end <= t.startMin!)
      if (col === -1) { col = colEnd.length; colEnd.push(0) }
      colEnd[col] = t.startMin! + t.durationMin
      assign.set(t.id, col)
    }
    for (const t of cluster) result.set(t.id, { col: assign.get(t.id)!, cols: colEnd.length })
    cluster = []
  }

  for (const t of sorted) {
    if (t.startMin! >= clusterEnd) flush()
    cluster.push(t)
    clusterEnd = Math.max(clusterEnd, t.startMin! + t.durationMin)
  }
  flush()
  return result
}

interface DragState {
  task: Task
  mode: 'move' | 'resize'
  startY: number
  origStart: number
  origDur: number
  moved: boolean
  delta: number
}

export default function Timeline({ tasks, date, readonly, onEdit, onToggle, onMove, onResize, onGapTap }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes())
  const isToday = date === todayISO()

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }, 30_000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll so the now line (or 8 AM) is in view on mount / date change
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const target = isToday ? nowMin * PX_PER_MIN - el.clientHeight * 0.35 : 8 * 60 * PX_PER_MIN - 20
    el.scrollTop = Math.max(0, target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const dragRef = useRef<DragState | null>(null)
  const setDragBoth = (d: DragState | null) => { dragRef.current = d; setDrag(d) }

  useEffect(() => {
    if (!drag) return
    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const delta = e.clientY - d.startY
      setDragBoth({ ...d, delta, moved: d.moved || Math.abs(delta) > 4 })
    }
    const onPointerUp = () => {
      const d = dragRef.current
      setDragBoth(null)
      if (!d) return
      if (d.moved) {
        if (d.mode === 'move') {
          const raw = d.origStart + d.delta / PX_PER_MIN
          const snapped = Math.round(raw / SNAP) * SNAP
          const clamped = Math.max(0, Math.min(DAY_MIN - d.origDur, snapped))
          onMove?.(d.task, clamped)
        } else {
          const raw = d.origDur + d.delta / PX_PER_MIN
          const snapped = Math.max(SNAP, Math.round(raw / SNAP) * SNAP)
          const clamped = Math.min(MAX_DURATION, DAY_MIN - d.origStart, snapped)
          onResize?.(d.task, clamped)
        }
      } else if (d.mode === 'move') {
        onEdit?.(d.task)
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [drag !== null, onMove, onResize, onEdit])

  const startDrag = (e: React.PointerEvent, task: Task, mode: 'move' | 'resize') => {
    if (readonly) { if (mode === 'move') onEdit?.(task); return }
    e.stopPropagation()
    setDragBoth({ task, mode, startY: e.clientY, origStart: task.startMin!, origDur: task.durationMin, moved: false, delta: 0 })
  }

  const handleGapClick = (e: React.MouseEvent) => {
    if (readonly || !onGapTap) return
    if ((e.target as HTMLElement).closest('.tblock')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const min = Math.max(0, Math.min(DAY_MIN - 30, Math.floor(y / PX_PER_MIN / 15) * 15))
    onGapTap(min)
  }

  const cols = layoutColumns(tasks)
  const hours = Array.from({ length: 24 }, (_, h) => h)

  return (
    <div className="timeline-wrap" ref={wrapRef}>
      <div className="timeline" style={{ height: DAY_MIN * PX_PER_MIN + 40 }} onClick={handleGapClick}>
        {hours.map((h) => (
          <div key={h}>
            <div className="hour-row" style={{ top: h * 60 * PX_PER_MIN }}>
              <span className="hlabel">{h === 0 ? '' : fmtTime(h * 60)}</span>
              <div className="hline" />
            </div>
            <div className="hour-row half-row" style={{ top: (h * 60 + 30) * PX_PER_MIN }}>
              <div className="hline" />
            </div>
          </div>
        ))}

        {isToday && (
          <div className="now-line" style={{ top: nowMin * PX_PER_MIN }}>
            <span className="now-time">{fmtTime(nowMin)}</span>
          </div>
        )}

        {tasks.map((t) => {
          const lay = cols.get(t.id) ?? { col: 0, cols: 1 }
          const isDragging = drag?.task.id === t.id && drag.moved
          let top = t.startMin! * PX_PER_MIN
          let height = Math.max(34, t.durationMin * PX_PER_MIN)
          if (isDragging && drag!.mode === 'move') top += drag!.delta
          if (isDragging && drag!.mode === 'resize') height = Math.max(20, height + drag!.delta)
          const widthPct = 100 / lay.cols
          const isPast = isToday && t.startMin! + t.durationMin < nowMin

          return (
            <div
              key={t.id}
              className={`tblock ${t.done ? 'done' : ''} ${isPast ? 'past' : ''} ${isDragging ? 'dragging' : ''} ${readonly ? 'readonly' : ''}`}
              style={{
                top,
                height,
                left: `calc(var(--gutter) + 8px + (100% - var(--gutter) - 16px) * ${(lay.col * widthPct) / 100})`,
                width: `calc((100% - var(--gutter) - 16px) * ${widthPct / 100} - ${lay.cols > 1 ? 4 : 0}px)`,
                borderLeftColor: t.color,
                background: `color-mix(in srgb, ${t.color} 16%, var(--surface-2))`,
              }}
              onPointerDown={(e) => startDrag(e, t, 'move')}
            >
              <div className="tb-head">
                {!readonly && (
                  <button
                    className={`tb-check ${t.done ? 'checked' : ''}`}
                    style={{ color: t.color }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onToggle?.(t) }}
                    aria-label={t.done ? 'Mark not done' : 'Mark done'}
                  >
                    {t.done && <span className="msym">check</span>}
                  </button>
                )}
                <span className="tb-title">{t.icon} {t.title || 'Untitled'}</span>
              </div>
              {height >= 52 && (
                <div className="tb-meta" style={{ marginLeft: readonly ? 0 : 27 }}>
                  <span>{fmtRange(t.startMin!, t.durationMin)}</span>
                  {t.subtasks.length > 0 && (
                    <span>☑ {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</span>
                  )}
                  {t.notes && <span className="msym" style={{ fontSize: 13 }}>notes</span>}
                </div>
              )}
              {!readonly && <div className="tb-resize" onPointerDown={(e) => startDrag(e, t, 'resize')} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
