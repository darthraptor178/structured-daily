import { useEffect, useRef, useState } from 'react'
import { todayISO, shiftISO, fmtTime } from '../types'

/* ── Popover shell with click-outside close ─────────────────── */
function Popover({
  label, icon, active, children, onOpenChange, align,
}: {
  label: string
  icon?: string
  active?: boolean
  children: (close: () => void) => React.ReactNode
  onOpenChange?: (open: boolean) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setOpen(false); onOpenChange?.(false) }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); onOpenChange?.(false) } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onOpenChange])

  const close = () => { setOpen(false); onOpenChange?.(false) }

  return (
    <div className="pop-wrap" ref={ref}>
      <button
        type="button"
        className={`picker-btn ${active || open ? 'on' : ''}`}
        onClick={() => { setOpen(!open); onOpenChange?.(!open) }}
      >
        {icon && <span className="msym" style={{ fontSize: 17 }}>{icon}</span>}
        {label}
        <span className="msym caret" style={{ fontSize: 16 }}>keyboard_arrow_down</span>
      </button>
      {open && <div className={`popover ${align === 'right' ? 'align-right' : ''}`}>{children(close)}</div>}
    </div>
  )
}

/* ── Mini month calendar ────────────────────────────────────── */
function MonthGrid({ value, onPick }: { value: string | null; onPick: (iso: string) => void }) {
  const today = todayISO()
  const anchor = value ?? today
  const [view, setView] = useState(() => {
    const d = new Date(anchor + 'T12:00:00')
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const first = new Date(view.y, view.m, 1)
  const monthName = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const startPad = first.getDay() // sunday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const dd = String(i + 1).padStart(2, '0')
      const mm = String(view.m + 1).padStart(2, '0')
      return `${view.y}-${mm}-${dd}`
    }),
  ]

  const step = (n: number) => {
    const m = view.m + n
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 })
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <span className="cal-month">{monthName}</span>
        <span style={{ flex: 1 }} />
        <button type="button" className="iconbtn sm" onClick={() => step(-1)} aria-label="Previous month">
          <span className="msym" style={{ fontSize: 18 }}>chevron_left</span>
        </button>
        <button type="button" className="iconbtn sm" onClick={() => step(1)} aria-label="Next month">
          <span className="msym" style={{ fontSize: 18 }}>chevron_right</span>
        </button>
      </div>
      <div className="cal-grid cal-dow">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((iso, i) =>
          iso === null ? <span key={i} /> : (
            <button
              key={i}
              type="button"
              className={`cal-day ${iso === value ? 'sel' : ''} ${iso === today ? 'today' : ''}`}
              onClick={() => onPick(iso)}
            >
              {Number(iso.slice(8))}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

export function dateLabel(iso: string | null): string {
  if (iso === null) return 'Inbox'
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === shiftISO(today, 1)) return 'Tomorrow'
  if (iso === shiftISO(today, -1)) return 'Yesterday'
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Date picker button: calendar popover + Today/Tomorrow/Inbox quick chips. */
export function DatePicker({
  value, onChange, allowInbox, align,
}: {
  value: string | null
  onChange: (iso: string | null) => void
  allowInbox?: boolean
  align?: 'left' | 'right'
}) {
  const today = todayISO()
  return (
    <Popover label={dateLabel(value)} icon="calendar_today" align={align} active={false}>
      {(close) => (
        <div>
          <div className="quick-chips">
            <button type="button" className={`seg ${value === today ? 'on' : ''}`} onClick={() => { onChange(today); close() }}>Today</button>
            <button type="button" className={`seg ${value === shiftISO(today, 1) ? 'on' : ''}`} onClick={() => { onChange(shiftISO(today, 1)); close() }}>Tomorrow</button>
            {allowInbox && (
              <button type="button" className={`seg ${value === null ? 'on' : ''}`} onClick={() => { onChange(null); close() }}>
                <span className="msym" style={{ fontSize: 15, verticalAlign: '-2px' }}>inbox</span> Inbox
              </button>
            )}
          </div>
          <MonthGrid value={value} onPick={(iso) => { onChange(iso); close() }} />
        </div>
      )}
    </Popover>
  )
}

/** Time picker button: scrollable list of 15-minute slots, auto-centred on the value. */
export function TimePicker({
  value, onChange, align,
}: {
  value: number
  onChange: (min: number) => void
  align?: 'left' | 'right'
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const slots = Array.from({ length: 96 }, (_, i) => i * 15)

  return (
    <Popover
      label={fmtTime(value)}
      icon="schedule"
      align={align}
      onOpenChange={(open) => {
        if (open) requestAnimationFrame(() => {
          const el = listRef.current?.querySelector('.on') as HTMLElement | null
          el?.scrollIntoView({ block: 'center' })
        })
      }}
    >
      {(close) => (
        <div className="timelist" ref={listRef}>
          {slots.map((m) => (
            <button
              key={m}
              type="button"
              className={`time-opt ${Math.abs(m - value) < 8 ? 'on' : ''}`}
              onClick={() => { onChange(m); close() }}
            >
              {fmtTime(m)}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}
