import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import { db } from './db'
import type { Task } from './types'
import { todayISO, shiftISO, uid } from './types'
import Timeline from './components/Timeline'
import TaskSheet from './components/TaskSheet'
import Inbox from './components/Inbox'
import Chat from './components/Chat'
import Settings from './components/Settings'
import Login from './components/Login'
import { getNames } from './config'
import { supabase, cloudEnabled } from './supabase'
import { startSync, presenceStore } from './sync'
import { DatePicker } from './components/pickers'

type Tab = 'day' | 'inbox' | 'friend' | 'chat' | 'settings'

function newTask(date: string | null, startMin: number | null): Task {
  return {
    id: uid(), userId: 'me', title: '', icon: '📝', color: '#6C5CE7',
    date, startMin, durationMin: 45, notes: '', subtasks: [], done: false, createdAt: Date.now(),
  }
}

function nextSlot(): number {
  const now = new Date()
  return Math.min(23 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30)
}

function dateHeading(iso: string): { line1: string; line2: string } {
  const d = new Date(iso + 'T12:00:00')
  const today = todayISO()
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const md = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  if (iso === today) return { line1: 'Today', line2: `${weekday}, ${md}` }
  if (iso === shiftISO(today, 1)) return { line1: 'Tomorrow', line2: `${weekday}, ${md}` }
  if (iso === shiftISO(today, -1)) return { line1: 'Yesterday', line2: `${weekday}, ${md}` }
  return { line1: weekday, line2: md }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('day')
  const [date, setDate] = useState(todayISO)
  const [editing, setEditing] = useState<{ task: Task; isNew: boolean } | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)
  const friendOnline = useSyncExternalStore(presenceStore.subscribe, presenceStore.isFriendOnline)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) startSync(session.user.id).catch((e) => console.error('[sync] start failed:', e))
  }, [session?.user?.id])

  const friendName = getNames(session?.user?.email).friend

  const userId = tab === 'friend' ? 'friend' : 'me'
  const dayTasks = useLiveQuery(
    () => db.tasks.where('[userId+date]').equals([userId, date]).toArray(),
    [userId, date],
  )
  const inboxCount = useLiveQuery(
    () => db.tasks.where('userId').equals('me').filter((t) => t.date === null).count(),
    [],
  )

  const timed = useMemo(() => (dayTasks ?? []).filter((t) => t.startMin !== null), [dayTasks])
  const allDay = useMemo(() => (dayTasks ?? []).filter((t) => t.startMin === null), [dayTasks])
  const heading = dateHeading(date)
  const isToday = date === todayISO()
  const readonly = tab === 'friend'

  const openNew = (startMin: number | null = null) => {
    setEditing({ task: newTask(date, startMin ?? nextSlot()), isNew: true })
  }

  const navItems: { key: Tab; icon: string; label: string }[] = [
    { key: 'day', icon: 'event_note', label: 'My Day' },
    { key: 'inbox', icon: 'inbox', label: 'Inbox' },
    { key: 'friend', icon: 'person', label: friendName },
    { key: 'chat', icon: 'chat_bubble', label: 'Chat' },
    { key: 'settings', icon: 'settings', label: 'Settings' },
  ]

  const NavBtn = ({ item }: { item: (typeof navItems)[number] }) => (
    <button
      className={`rail-btn ${tab === item.key ? 'active' : ''}`}
      onClick={() => setTab(item.key)}
      aria-label={item.label}
    >
      <span className={`msym ${tab === item.key ? 'fill' : ''}`}>{item.icon}</span>
      <span className="label">{item.label}</span>
      {item.key === 'inbox' && (inboxCount ?? 0) > 0 && <span className="badge">{inboxCount}</span>}
      {item.key === 'friend' && (!cloudEnabled || friendOnline) && <span className="presence" />}
    </button>
  )

  const showTimeline = tab === 'day' || tab === 'friend'

  if (!authReady) {
    return <div className="login-screen"><div className="rail-logo" style={{ fontSize: 30 }}>SD</div></div>
  }
  if (cloudEnabled && !session) {
    return <Login />
  }

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail-logo">SD</div>
        {navItems.slice(0, 4).map((i) => <NavBtn key={i.key} item={i} />)}
        <div className="rail-spacer" />
        <NavBtn item={navItems[4]} />
      </nav>

      <main className="main">
        {showTimeline && (
          <>
            <header className="topbar">
              {tab === 'friend' && (
                <div className="avatar" aria-hidden>
                  {friendName[0]}
                  {(!cloudEnabled || friendOnline) && <span className="presence" />}
                </div>
              )}
              <div>
                <h1>{tab === 'friend' ? `${friendName}'s day` : heading.line1}</h1>
                <div className="sub">{heading.line2}</div>
              </div>
              <div className="topbar-spacer" />
              {!isToday && (
                <button className="pill accent" onClick={() => setDate(todayISO())}>
                  Back to today
                </button>
              )}
              <button className="iconbtn" onClick={() => setDate(shiftISO(date, -1))} aria-label="Previous day">
                <span className="msym">chevron_left</span>
              </button>
              <DatePicker value={date} align="right" onChange={(iso) => iso && setDate(iso)} />
              <button className="iconbtn" onClick={() => setDate(shiftISO(date, 1))} aria-label="Next day">
                <span className="msym">chevron_right</span>
              </button>
            </header>

            {tab === 'friend' && (
              <div className="banner">
                <span className="msym" style={{ fontSize: 16 }}>visibility</span>
                {cloudEnabled
                  ? `Viewing ${friendName}'s schedule — updates live`
                  : `Viewing ${friendName}'s schedule (demo data) — connect Supabase to go live`}
              </div>
            )}

            {allDay.length > 0 && (
              <div className="allday">
                <span className="allday-label">All-day</span>
                {allDay.map((t) => (
                  <button
                    key={t.id}
                    className={`chip ${t.done ? 'done' : ''}`}
                    style={{ borderLeftColor: t.color }}
                    onClick={() => !readonly && setEditing({ task: t, isNew: false })}
                  >
                    {t.icon} {t.title}
                    {!readonly && (
                      <span
                        className="msym"
                        style={{ fontSize: 16, color: t.done ? t.color : 'var(--text-3)' }}
                        onClick={async (e) => { e.stopPropagation(); await db.tasks.update(t.id, { done: !t.done }) }}
                      >
                        {t.done ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <Timeline
              tasks={timed}
              date={date}
              readonly={readonly}
              onEdit={(t) => !readonly && setEditing({ task: t, isNew: false })}
              onToggle={(t) => db.tasks.update(t.id, { done: !t.done })}
              onMove={(t, startMin) => db.tasks.update(t.id, { startMin })}
              onResize={(t, durationMin) => db.tasks.update(t.id, { durationMin })}
              onGapTap={(min) => openNew(min)}
            />
          </>
        )}

        {tab === 'inbox' && (
          <>
            <header className="topbar">
              <div><h1>Inbox</h1><div className="sub">Unscheduled tasks</div></div>
            </header>
            <Inbox
              onEdit={(t) => setEditing({ task: t, isNew: false })}
              onSchedule={(t) => setEditing({ task: { ...t, date: todayISO(), startMin: nextSlot() }, isNew: false })}
            />
          </>
        )}

        {tab === 'chat' && (
          <>
            <header className="topbar">
              <div className="avatar" aria-hidden>
                {friendName[0]}
                {(!cloudEnabled || friendOnline) && <span className="presence" />}
              </div>
              <div>
                <h1>{friendName}</h1>
                <div className="sub">{!cloudEnabled ? 'Demo' : friendOnline ? 'Online' : 'Offline'}</div>
              </div>
            </header>
            <Chat friendName={friendName} />
          </>
        )}

        {tab === 'settings' && (
          <>
            <header className="topbar">
              <div><h1>Settings</h1></div>
            </header>
            <Settings />
          </>
        )}
      </main>

      {tab === 'day' && (
        <button className="fab" onClick={() => openNew()} aria-label="New task">
          <span className="msym" style={{ fontSize: 26 }}>add</span>
        </button>
      )}

      <nav className="bottomnav">
        {navItems.map((i) => <NavBtn key={i.key} item={i} />)}
      </nav>

      {editing && (
        <TaskSheet
          key={editing.task.id}
          task={editing.task}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
