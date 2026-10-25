import { useState } from 'react'
import { Field } from '../ui'
import { resetPassword, signIn } from '../cloud'

/** Schermata di accesso (app su invito): niente registrazione, solo login. */
export default function Login() {
  const [mail, setMail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setMsg(''); setOk(false); setBusy(true)
    if (!navigator.onLine) { setMsg('Serve la connessione per il primo accesso.'); setBusy(false); return }
    const e = await signIn(mail.trim(), pw)
    if (e) setMsg(e)
    setBusy(false)
  }
  return (
    <div className="setup">
      <div className="setup-side">
        <div style={{ fontFamily: 'var(--display)', letterSpacing: '.3em', fontWeight: 700, fontSize: 18 }}>BASKET STATS</div>
        <div className="setup-logo">🏀</div>
        <h1 style={{ fontSize: 64, lineHeight: 0.95 }}>Statistiche basket</h1>
        <div style={{ marginTop: 14, opacity: 0.9 }}>Accesso riservato</div>
      </div>
      <div className="setup-form">
        <h2 style={{ fontSize: 40, marginBottom: 6 }}>Accedi</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 22 }}>L’app è su invito. Usa l’email e la password che ti ha dato chi gestisce l’accesso.</p>
        <Field label="Email"><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={mail} onChange={(e) => setMail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} /></Field>
        {msg && <p style={{ color: ok ? 'var(--green)' : 'var(--red)', fontWeight: 500 }}>{msg}</p>}
        <button className="btn block" disabled={busy || !mail || !pw} onClick={go}>Accedi</button>
        <div className="row-actions" style={{ marginTop: 14 }}>
          <button className="btn ghost small" disabled={!mail} onClick={async () => {
            const e = await resetPassword(mail.trim())
            setOk(!e); setMsg(e ?? 'Se l’email è abilitata, ti arriva un link per reimpostare la password.')
          }}>Password dimenticata</button>
        </div>
      </div>
    </div>
  )
}
