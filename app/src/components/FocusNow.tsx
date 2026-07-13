import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { todayISO, fmtTime, MAX_DURATION } from '../types'

const PRESETS = [10, 15, 25, 45, 60]

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Soft three-note chime, no audio assets needed. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.16, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
      osc.start(t)
      osc.stop(t + 1.2)
    })
  } catch {
    /* audio blocked — fine, the visuals still land */
  }
}

function Ring({ progress, color, children }: { progress: number; color: string; children: ReactNode }) {
  const R = 140
  const C = 2 * Math.PI * R
  const p = Math.min(1, Math.max(0, progress))
  return (
    <div className="focus-ring">
      <div className="focus-halo" />
      <svg viewBox="0 0 300 300" aria-hidden>
        <defs>
          <linearGradient id="focus-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#a06ee1" />
          </linearGradient>
        </defs>
        <circle className="track" cx="150" cy="150" r={R} />
        <circle
          className="bar"
          cx="150"
          cy="150"
          r={R}
          stroke="url(#focus-grad)"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - p)}
        />
      </svg>
      <div className="focus-ring-inner">{children}</div>
    </div>
  )
}

export default function FocusNow({ onClose }: { onClose: () => void }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tasks = useLiveQuery(
    () => db.tasks.where('[userId+date]').equals(['me', todayISO()]).toArray(),
    [],
  )

  const now = nowMinutes()
  const timed = (tasks ?? []).filter((t) => t.startMin !== null)
  const live =
    timed
      .filter((t) => !t.done && t.startMin! <= now && now < t.startMin! + t.durationMin)
      .sort((a, b) => b.startMin! - a.startMin!)[0] ?? null
  const upNext =
    timed
      .filter((t) => !t.done && t.startMin! > now)
      .sort((a, b) => a.startMin! - b.startMin!)[0] ?? null

  // Pin the focused task so it doesn't vanish the second its block ends.
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [wantTimer, setWantTimer] = useState(false)
  useEffect(() => {
    if (!wantTimer && pinnedId === null && live) setPinnedId(live.id)
  }, [live, wantTimer, pinnedId])
  const task = !wantTimer ? (tasks ?? []).find((t) => t.id === pinnedId) ?? null : null

  const [celebrated, setCelebrated] = useState(false)
  const chimed = useRef(false)

  // Freeform session state
  const [preset, setPreset] = useState(25)
  const [session, setSession] = useState<{ endAt: number; totalSec: number } | null>(null)
  const [pausedLeft, setPausedLeft] = useState<number | null>(null)
  const [timerDone, setTimerDone] = useState(false)

  const taskEnd = task ? task.startMin! + task.durationMin : 0
  const taskRemainSec = task ? (taskEnd - now) * 60 : 0
  const timeUp = task !== null && taskRemainSec <= 0
  const taskFrac = task ? taskRemainSec / (task.durationMin * 60) : 0

  const sessionRemain = session ? pausedLeft ?? (session.endAt - Date.now()) / 1000 : preset * 60
  const sessionFrac = session ? sessionRemain / session.totalSec : 1

  useEffect(() => {
    if (task && !task.done && timeUp && !chimed.current) {
      chimed.current = true
      chime()
    }
  })

  useEffect(() => {
    if (session && pausedLeft === null && session.endAt - Date.now() <= 0) {
      setSession(null)
      setTimerDone(true)
      chime()
    }
  })

  const origTitle = useRef(document.title)
  useEffect(() => {
    if (task && !timeUp && !celebrated) {
      document.title = `${fmtClock(taskRemainSec)} · ${task.title || 'Focus'}`
    } else if (session && pausedLeft === null) {
      document.title = `${fmtClock(sessionRemain)} · Focus`
    }
  })
  useEffect(() => {
    const title = origTitle.current
    return () => {
      document.title = title
    }
  }, [])

  const completeTask = async () => {
    if (!task) return
    await db.tasks.update(task.id, { done: true })
    chime()
    setCelebrated(true)
    window.setTimeout(onClose, 1600)
  }
  const extend = () => {
    if (!task) return
    chimed.current = false
    db.tasks.update(task.id, { durationMin: Math.min(MAX_DURATION, task.durationMin + 15) })
  }
  const startSession = () => {
    setTimerDone(false)
    setPausedLeft(null)
    setSession({ endAt: Date.now() + preset * 60 * 1000, totalSec: preset * 60 })
  }
  const pauseSession = () => session && setPausedLeft(Math.max(0, (session.endAt - Date.now()) / 1000))
  const resumeSession = () => {
    if (session && pausedLeft !== null) {
      setSession({ ...session, endAt: Date.now() + pausedLeft * 1000 })
      setPausedLeft(null)
    }
  }
  const stopSession = () => {
    setSession(null)
    setPausedLeft(null)
    setTimerDone(false)
  }

  const color = task ? task.color : '#6c5ce7'

  return (
    <div className="focus-screen" style={{ '--fc': color } as CSSProperties}>
      <div className="focus-bg" aria-hidden>
        <div className="fblob a" />
        <div className="fblob b" />
        <div className="fblob c" />
      </div>

      <button className="iconbtn focus-close" onClick={onClose} aria-label="Exit focus">
        <span className="msym">close</span>
      </button>

      <div className="focus-center">
        {task ? (
          <>
            <div className="focus-label">
              <span className="focus-emoji">{task.icon}</span>
              <span>{task.title || 'Untitled task'}</span>
            </div>

            <Ring progress={celebrated ? 1 : taskFrac} color={task.color}>
              {celebrated ? (
                <>
                  <span className="msym focus-bigcheck">check_circle</span>
                  <div className="focus-sub">Nice work</div>
                </>
              ) : timeUp ? (
                <>
                  <div className="focus-time">0:00</div>
                  <div className="focus-sub">Time&rsquo;s up</div>
                </>
              ) : (
                <>
                  <div className="focus-time">{fmtClock(taskRemainSec)}</div>
                  <div className="focus-sub">until {fmtTime(taskEnd)}</div>
                </>
              )}
            </Ring>

            {!celebrated && (
              <div className="focus-controls">
                <button className="fbtn primary" onClick={completeTask}>
                  <span className="msym" style={{ fontSize: 18 }}>check</span> Complete
                </button>
                {task.durationMin < MAX_DURATION && (
                  <button className="fbtn" onClick={extend}>
                    <span className="msym" style={{ fontSize: 18 }}>more_time</span> +15 min
                  </button>
                )}
                <button
                  className="fbtn"
                  onClick={() => {
                    setWantTimer(true)
                    setPinnedId(null)
                  }}
                >
                  <span className="msym" style={{ fontSize: 18 }}>timer</span> Timer
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="focus-label">
              <span className="msym" style={{ fontSize: 20, color: 'var(--accent-text)' }}>self_improvement</span>
              <span>Focus session</span>
            </div>

            <Ring progress={timerDone ? 1 : sessionFrac} color={color}>
              {timerDone ? (
                <>
                  <span className="msym focus-bigcheck">check_circle</span>
                  <div className="focus-sub">Session complete</div>
                </>
              ) : (
                <>
                  <div className="focus-time">{fmtClock(sessionRemain)}</div>
                  <div className="focus-sub">
                    {session ? (pausedLeft !== null ? 'paused' : 'stay with it') : 'ready when you are'}
                  </div>
                </>
              )}
            </Ring>

            {timerDone ? (
              <div className="focus-controls">
                <button className="fbtn primary" onClick={startSession}>
                  <span className="msym" style={{ fontSize: 18 }}>replay</span> Go again
                </button>
                <button className="fbtn" onClick={onClose}>Done</button>
              </div>
            ) : session ? (
              <div className="focus-controls">
                {pausedLeft !== null ? (
                  <button className="fbtn primary" onClick={resumeSession}>
                    <span className="msym" style={{ fontSize: 18 }}>play_arrow</span> Resume
                  </button>
                ) : (
                  <button className="fbtn primary" onClick={pauseSession}>
                    <span className="msym" style={{ fontSize: 18 }}>pause</span> Pause
                  </button>
                )}
                <button className="fbtn" onClick={stopSession}>
                  <span className="msym" style={{ fontSize: 18 }}>stop</span> Stop
                </button>
              </div>
            ) : (
              <>
                <div className="focus-presets">
                  {PRESETS.map((m) => (
                    <button key={m} className={`seg ${preset === m ? 'on' : ''}`} onClick={() => setPreset(m)}>
                      {m}m
                    </button>
                  ))}
                </div>
                <div className="focus-controls">
                  <button className="fbtn primary" onClick={startSession}>
                    <span className="msym" style={{ fontSize: 18 }}>play_arrow</span> Start
                  </button>
                  {live && wantTimer && (
                    <button
                      className="fbtn"
                      onClick={() => {
                        setWantTimer(false)
                        setPinnedId(live.id)
                      }}
                    >
                      <span className="focus-emoji sm">{live.icon}</span> Focus on {live.title || 'current task'}
                    </button>
                  )}
                </div>
                {!live && upNext && (
                  <div className="focus-upnext">
                    Up next: {upNext.icon} {upNext.title || 'Untitled'} · {fmtTime(upNext.startMin!)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
