import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { seedIfEmpty } from './db'
import { cloudEnabled } from './supabase'

const boot = cloudEnabled ? Promise.resolve() : seedIfEmpty()
boot.finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
