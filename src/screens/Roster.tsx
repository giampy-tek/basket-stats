import { useState } from 'react'
import { useStore, playerName } from '../store'
import { Avatar, Hero, Modal, Field } from '../ui'
import { photoToDataUrl } from '../photo'

export default function Roster() {
  const { seasons, seasonId, players, setNumber, removeFromRoster, addToRoster, addPlayer, updatePlayer } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ first: '', last: '', role: '', number: '' })
  if (!season) return <Hero title="Roster" back={{ label: 'Stagioni', to: '/seasons' }} />

  const inRoster = [...season.roster].sort((a, b) => a.number - b.number)
  const available = players.filter((p) => !season.roster.some((r) => r.playerId === p.id))
  const byId = (id: string) => players.find((p) => p.id === id)
  const save = () => {
    if (!f.last.trim() || !f.first.trim()) return
    addPlayer({ first: f.first.trim(), last: f.last.trim(), role: f.role }, season.id, Number(f.number) || 0)
    setF({ first: '', last: '', role: '', number: '' })
    setAdding(false)
  }

  return (
    <>
      <Hero title="Roster" sub={`${season.year} ${season.category}`} back={{ label: 'Stagioni', to: '/seasons' }}
        right={<button className="pill" onClick={() => setAdding(true)}>＋ Nuovo</button>} />
      <div className="page two-col">
        <div>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>In roster <span style={{ color: 'var(--brand)' }}>{inRoster.length}</span></div>
          <div className="card list">
            {inRoster.map((r) => {
              const p = byId(r.playerId)
              return (
                <div className="player-row" key={r.playerId}>
                  <input className="numbox" inputMode="numeric" value={r.number}
                    onChange={(e) => setNumber(season.id, r.playerId, Number(e.target.value.replace(/\D/g, '')) || 0)} />
                  <label className="avatar-btn" title="Cambia foto">
                    <Avatar photo={p?.photo} size={52} />
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (f && p) updatePlayer(p.id, { photo: await photoToDataUrl(f) })
                      e.target.value = ''
                    }} />
                  </label>
                  <div className="name">
                    {playerName(p)}
                    <select className="role" style={{ display: 'block', border: 0, background: 'none', padding: 0 }} value={p?.role ?? ''}
                      onChange={(e) => updatePlayer(r.playerId, { role: e.target.value })}>
                      {['', 'Playmaker', 'Guardia', 'Ala piccola', 'Ala grande', 'Centro'].map((x) => <option key={x} value={x}>{x || 'Ruolo non impostato'}</option>)}
                    </select>
                  </div>
                  <button className="x" onClick={() => removeFromRoster(season.id, r.playerId)}>✕</button>
                </div>
              )
            })}
          </div>
        </div>
        <div>
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>Disponibili nel club <span style={{ color: 'var(--brand)' }}>{available.length}</span></div>
          <div className="card list">
            {available.length === 0 && <div className="empty">Nessun altro giocatore disponibile.</div>}
            {available.map((p) => (
              <button className="list-row" key={p.id} onClick={() => addToRoster(season.id, p.id, 0)}>
                <span className="t">{playerName(p)}</span><span className="end" style={{ fontSize: 24, color: 'var(--brand)' }}>＋</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {adding && (
        <Modal title="Nuovo giocatore" onClose={() => setAdding(false)}>
          <Field label="Cognome"><input value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></Field>
          <Field label="Nome"><input value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></Field>
          <Field label="Numero maglia"><input inputMode="numeric" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Ruolo">
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {['', 'Playmaker', 'Guardia', 'Ala piccola', 'Ala grande', 'Centro'].map((x) => <option key={x} value={x}>{x || '—'}</option>)}
            </select>
          </Field>
          <div className="row-actions"><button className="btn" onClick={save}>Aggiungi</button><button className="btn ghost" onClick={() => setAdding(false)}>Annulla</button></div>
        </Modal>
      )}
    </>
  )
}
