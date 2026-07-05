import { db } from '../db'
import { supabase, cloudEnabled } from '../supabase'

export default function Settings() {
  const signOut = async () => {
    await supabase!.auth.signOut()
    await db.tasks.clear()
    await db.messages.clear()
    location.reload()
  }
  const exportJSON = async () => {
    const tasks = await db.tasks.toArray()
    const messages = await db.messages.toArray()
    const blob = new Blob([JSON.stringify({ tasks, messages }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `structured-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const data = JSON.parse(await file.text())
      if (Array.isArray(data.tasks)) await db.tasks.bulkPut(data.tasks)
      if (Array.isArray(data.messages)) await db.messages.bulkPut(data.messages)
      alert('Import complete.')
    }
    input.click()
  }

  const clearAll = async () => {
    if (!confirm('Delete all local tasks and messages? This cannot be undone.')) return
    await db.tasks.clear()
    await db.messages.clear()
  }

  return (
    <div className="page" style={{ paddingTop: 8 }}>
      <div className="settings-group">
        <div className="field-label">Data</div>
        <div className="settings-row">
          <div>
            <div className="r-label">Export backup</div>
            <div className="r-sub">Download all tasks and messages as JSON</div>
          </div>
          <button className="pill" onClick={exportJSON}>Export</button>
        </div>
        <div className="settings-row">
          <div>
            <div className="r-label">Import backup</div>
            <div className="r-sub">Restore from a JSON file</div>
          </div>
          <button className="pill" onClick={importJSON}>Import</button>
        </div>
        <div className="settings-row">
          <div>
            <div className="r-label">Clear all data</div>
            <div className="r-sub">Removes everything stored on this device</div>
          </div>
          <button className="pill" style={{ color: 'var(--danger)' }} onClick={clearAll}>Clear</button>
        </div>
      </div>

      <div className="settings-group">
        <div className="field-label">Account</div>
        {cloudEnabled ? (
          <div className="settings-row">
            <div>
              <div className="r-label">Signed in</div>
              <div className="r-sub">Tasks and chat sync in real time via Supabase</div>
            </div>
            <button className="pill" style={{ color: 'var(--danger)' }} onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="settings-row">
            <div>
              <div className="r-label">Cloud sync off</div>
              <div className="r-sub">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login, friend timeline, and chat</div>
            </div>
            <span className="pill">Local mode</span>
          </div>
        )}
      </div>

      <div className="settings-group">
        <div className="field-label">About</div>
        <div className="settings-row">
          <div>
            <div className="r-label">Structured Daily</div>
            <div className="r-sub">v0.1 · free forever, no ads, your data stays on your device</div>
          </div>
        </div>
      </div>
    </div>
  )
}
