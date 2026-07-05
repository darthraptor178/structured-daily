import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { uid } from '../types'
import { FRIEND_NAME } from '../config'
import { cloudEnabled } from '../supabase'

export default function Chat() {
  const [text, setText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const messages = useLiveQuery(() => db.messages.orderBy('at').toArray(), [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages?.length])

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
        {messages?.map((m) => (
          <div key={m.id} className={`bubble-row ${m.from}`}>
            <div className="bubble">
              {m.text}
              <div className="bubble-time">
                {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="chat-inputbar">
        <div className="inner">
          <input
            placeholder={`Message ${FRIEND_NAME}…`}
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
