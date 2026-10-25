import { useState } from 'react'
import { Modal, Field } from '../ui'
import { ALLOW_SIGNUP } from '../cloudConfig'
import { cloudEnabled, deleteCloudData, resetPassword, signIn, signOut, signUp, sync, useCloud } from '../cloud'

export function SyncBadge() {
  const { email, status, lastSync } = useCloud()
  if (!cloudEnabled) return null
  const txt = !email ? 'Accedi' : status === 'syncing' ? 'Sincronizzo…' : status === 'offline' ? 'Offline' : status === 'error' ? 'Errore sync' : lastSync ? 'Sincronizzato' : 'Collegato'
  const dot = !email ? '#fff' : status === 'error' ? '#ffb4b4' : status === 'offline' ? '#ffd68a' : '#9be3b4'
  return <><span style={{ width: 10, height: 10, borderRadius: 5, background: dot, display: 'inline-block' }} />{txt}</>
}

export function AccountModal({ onClose }: { onClose: () => void }) {
  const { email, status, lastSync, error } = useCloud()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [mail, setMail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (!cloudEnabled) {
    return (
      <Modal title="Account" onClose={onClose}>
        <p>Il cloud non è ancora configurato in questa versione dell’app. I dati restano salvati sull’iPad.</p>
        <button className="btn ghost" onClick={onClose}>Chiudi</button>
      </Modal>
    )
  }

  if (email) {
    return (
      <Modal title="Account" onClose={onClose}>
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>{email}</div>
          <div style={{ color: 'var(--muted)', marginTop: 4 }}>
            {status === 'syncing' ? 'Sincronizzazione in corso…' : status === 'offline' ? 'Offline: sincronizzo appena torna la rete' : status === 'error' ? `Errore: ${error}` : lastSync ? `Ultima sincronizzazione ${new Date(lastSync).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'Collegato'}
          </div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Le partite si salvano sempre sull’iPad e, quando c’è rete, anche nel cloud. Puoi registrare senza Wi-Fi.</p>
        <div className="row-actions">
          <button className="btn" onClick={() => void sync()}>↻ Sincronizza ora</button>
          <button className="btn ghost" onClick={async () => {
            const clear = confirm('Uscire dall’account?\n\nOK = esci e togli i dati da questo iPad (restano nel cloud)\nAnnulla = scegli dopo')
            if (clear) { await signOut(true); onClose(); return }
            if (confirm('Uscire lasciando i dati su questo iPad?')) { await signOut(false); onClose() }
          }}>Esci</button>
        </div>
        <div className="row-actions">
          <button className="btn danger small" onClick={async () => {
            if (!confirm('Cancellare tutti i dati di questo account dal cloud? I dati su questo iPad restano.')) return
            const e = await deleteCloudData()
            setMsg(e ?? 'Dati cloud cancellati.')
          }}>Cancella dati dal cloud</button>
        </div>
        {msg && <p style={{ color: 'var(--muted)' }}>{msg}</p>}
      </Modal>
    )
  }

  const submit = async () => {
    setMsg(''); setBusy(true)
    if (mode === 'in') {
      const e = await signIn(mail.trim(), pw)
      if (e) setMsg(e); else onClose()
    } else {
      const r = await signUp(mail.trim(), pw)
      if (r.error) setMsg(r.error)
      else if (r.needsConfirm) setMsg('Account creato. Ti abbiamo mandato un’email: apri il link per confermare, poi accedi.')
      else onClose()
    }
    setBusy(false)
  }
  return (
    <Modal title="Account" onClose={onClose}>
      {ALLOW_SIGNUP && (
        <div className="seg" style={{ marginBottom: 16 }}>
          <button className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setMsg('') }}>Accedi</button>
          <button className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg('') }}>Crea account</button>
        </div>
      )}
      <Field label="Email"><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={mail} onChange={(e) => setMail(e.target.value)} /></Field>
      <Field label="Password"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
      {msg && <p style={{ color: msg.startsWith('Account creato') || msg.startsWith('Ti abbiamo') ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{msg}</p>}
      <div className="row-actions">
        <button className="btn" disabled={busy || !mail || pw.length < 6} onClick={submit}>{mode === 'in' ? 'Accedi' : 'Crea account'}</button>
        {mode === 'in' && <button className="btn ghost" disabled={!mail} onClick={async () => setMsg((await resetPassword(mail.trim())) ?? 'Ti abbiamo mandato un’email per reimpostare la password.')}>Password dimenticata</button>}
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 16 }}>Senza account l’app funziona lo stesso, con i dati solo su questo iPad. Con l’account li ritrovi anche su altri dispositivi e hai un backup automatico.</p>
    </Modal>
  )
}
