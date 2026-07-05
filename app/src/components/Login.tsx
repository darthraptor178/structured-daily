import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={signIn}>
        <div className="rail-logo" style={{ fontSize: 28, marginBottom: 4 }}>SD</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: 0, letterSpacing: '-0.02em' }}>
          Structured Daily
        </h1>
        <p style={{ color: 'var(--text-2)', margin: '4px 0 18px', fontSize: 14 }}>
          Sign in to sync your day
        </p>
        <input
          className="login-input"
          type="email"
          placeholder="Email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="login-input"
          type="password"
          placeholder="Password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
