import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { uid } from '../types'
import { cloudEnabled } from '../supabase'

export default function Chat({ friendName }: { friendName: string }) {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = useLiveQuery(() => db.messages.orderBy('at').toArray(), [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages?.length])

  useEffect(() => {
    const unread = messages?.filter((m) => m.from === 'friend' && m.readAt === undefined) ?? []
    if (unread.length) Promise.all(unread.map((m) => db.messages.update(m.id, { readAt: Date.now() })))
  }, [messages])

  const send = async () => {
    const t = text.trim()
    if (!t) return
    await db.messages.add({ id: uid(), from: 'me', text: t, at: Date.now() })
    setText('')
  }

  return (
    <div className="chat-page">
      {!cloudEnabled && (
        <div className="banner">
          <span className="msym" style={{ fontSize: 16 }}>cloud_off</span>
          Local demo — connect Supabase to chat for real
        </div>
      )}
      <div className="chat-scroll" ref={scrollRef}>
        {messages && messages.length === 0 && <div className="empty">Say hi 👋</div>}
        {messages?.map((m, i) => {
          const previous = messages[i - 1]
          const day = new Date(m.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          const previousDay = previous && new Date(previous.at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          return <div key={m.id}>
            {day !== previousDay && <div className="chat-day">{day}</div>}
            <div className={`bubble-row ${m.from}`}>
            <div className="bubble">
              {m.text}
              <div className="bubble-time">
                {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {m.from === 'me' && <span className={`read-state ${m.readAt ? 'seen' : ''}`}><span className="msym">done_all</span>{m.readAt ? ` Seen ${new Date(m.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' Sent'}</span>}
              </div>
            </div>
            </div>
          </div>
        })}
      </div>
      <div className="chat-inputbar">
        <div className="inner">
          <input
            placeholder={`Message ${friendName}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className="send-btn" onClick={send} disabled={!text.trim()} aria-label="Send">
            <span className="msym fill" style={{ fontSize: 19 }}>send</span>
          </button>
        </div>
      </div>
    </div>
  )
}
