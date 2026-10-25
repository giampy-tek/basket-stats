import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './theme'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// salvataggio protetto dal browser + app offline
navigator.storage?.persist?.()
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {})
}
