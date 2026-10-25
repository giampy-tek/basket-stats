import { useState } from 'react'
import { useStore } from '../store'
import { Field } from '../ui'
import { PRESETS, readable } from '../theme'
import { AccountModal } from './Account'
import { cloudEnabled, uploadActiveClub, useCloud } from '../cloud'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const isPreset = PRESETS.some(([, c]) => c.toLowerCase() === value.toLowerCase())
  return (
    <div className="swatches">
      {PRESETS.map(([name, c]) => (
        <button key={c} title={name} aria-label={name} className={value.toLowerCase() === c ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <label className={`custom ${!isPreset ? 'on' : ''}`} title="Colore personalizzato" style={!isPreset ? { background: readable(value) } : undefined}>
        {isPreset ? '＋' : ''}
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#b5440c'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

const seasonYear = () => {
  const d = new Date()
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}/${y + 1}`
}

/** Primo avvio: crea la squadra, scegli il nome e il colore. */
export default function Setup() {
  const { setClubName, setBrandColor, brandColor, addSeason, importAll } = useStore()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [year, setYear] = useState(seasonYear())
  const [coach, setCoach] = useState('')
  const [acc, setAcc] = useState(false)

  const create = () => {
    if (!name.trim()) return
    setClubName(name.trim())
    addSeason({ year: year.trim() || seasonYear(), category: category.trim(), coach: coach.trim(), vice: '', shirt1: readable(brandColor), shirt2: '#FFFFFF' })
    if (cloudEnabled && useCloud.getState().email) void uploadActiveClub()
  }
  const restore = async (f?: File) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (!Array.isArray(d.players) || !Array.isArray(d.games)) throw new Error()
      importAll(d)
    } catch { alert('File di backup non valido') }
  }
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div className="setup">
      <div className="setup-side">
        <div style={{ fontFamily: 'var(--display)', letterSpacing: '.3em', fontWeight: 700, fontSize: 18 }}>BASKET STATS</div>
        <div className="setup-logo">{initials}</div>
        <h1 style={{ fontSize: 64, lineHeight: 0.95 }}>{name.trim() || 'La tua squadra'}</h1>
        <div style={{ marginTop: 14, opacity: 0.9 }}>{[year, category].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="setup-form">
        <h2 style={{ fontSize: 40, marginBottom: 6 }}>Benvenuto</h2>
        <p style={{ color: 'var(--muted)', marginTop: 0, marginBottom: 22 }}>Crea la tua squadra: i dati restano su questo dispositivo.</p>
        <Field label="Nome della squadra"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Salzano" autoFocus /></Field>
        <Field label="Categoria"><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Es. Under 17 Gold" /></Field>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1 }}><Field label="Stagione"><input value={year} onChange={(e) => setYear(e.target.value)} /></Field></div>
          <div style={{ flex: 1.4 }}><Field label="Allenatore (facoltativo)"><input value={coach} onChange={(e) => setCoach(e.target.value)} /></Field></div>
        </div>
        <div className="field"><label>Colore della squadra</label><ColorPicker value={brandColor} onChange={setBrandColor} /></div>
        <button className="btn block" style={{ marginTop: 6 }} disabled={!name.trim()} onClick={create}>Crea squadra</button>
        <div className="row-actions" style={{ marginTop: 18 }}>
          <label className="btn ghost small">⬆ Ho un backup<input type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} /></label>
          {cloudEnabled && <button className="btn ghost small" onClick={() => setAcc(true)}>Ho già un account</button>}
        </div>
      </div>
      {acc && <AccountModal onClose={() => setAcc(false)} />}
    </div>
  )
}
