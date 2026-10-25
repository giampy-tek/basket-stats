import { useState } from 'react'
import { useStore } from '../store'
import { computeGame } from '../stats'
import { go, Hero, Modal, Field, fmtDate } from '../ui'
import type { Game } from '../types'

const label = (s: Game['status']) => (s === 'todo' ? 'Da iniziare' : s === 'live' ? 'In corso' : 'Terminata')

export default function Games({ selected }: { selected?: string }) {
  const { games, seasons, seasonId, addGame, updateGame, deleteGame, clubName } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const list = games.filter((g) => g.seasonId === seasonId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const toPlay = list.filter((g) => g.status !== 'done')
  const played = list.filter((g) => g.status === 'done')
  const sel = list.find((g) => g.id === selected) ?? toPlay[0] ?? played[played.length - 1]
  const [form, setForm] = useState<null | { id?: string; opponent: string; date: string; time: string; home: boolean }>(null)

  const Item = (g: Game) => {
    const gs = g.status === 'todo' ? null : computeGame(g)
    return (
      <button key={g.id} className={`game-item ${sel?.id === g.id ? 'sel' : ''}`} onClick={() => go(`/games/${g.id}`)}>
        <div>
          <div className="n">{g.opponent}</div>
          <div className="d">{[fmtDate(g.date), g.time, label(g.status)].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="score">{gs ? `${gs.us}–${gs.opp}` : '--'}</div>
      </button>
    )
  }
  const submit = () => {
    if (!form || !form.opponent.trim() || !season) return
    if (form.id) updateGame(form.id, { opponent: form.opponent.trim(), date: form.date, time: form.time, home: form.home })
    else go(`/games/${addGame({ seasonId: season.id, opponent: form.opponent.trim(), date: form.date, time: form.time, home: form.home })}`)
    setForm(null)
  }
  const gs = sel && sel.status !== 'todo' ? computeGame(sel) : null

  return (
    <>
      <Hero title="Partite" sub={season ? `${season.year} ${season.category}` : ''} back={{ label: 'Stagioni', to: '/seasons' }}
        right={<>
          <button className="pill" onClick={() => go('/stats/season')}>▥ Stats stagione</button>
          <button className="pill" onClick={() => setForm({ opponent: '', date: new Date().toISOString().slice(0, 10), time: '19:00', home: true })}>＋ Nuova</button>
        </>} />
      <div className="games-layout">
        <div>
          {toPlay.length > 0 && <div className="section-title" style={{ marginTop: 0 }}>Partite da giocare</div>}
          {toPlay.map(Item)}
          {played.length > 0 && <div className="section-title">Giocate</div>}
          {played.slice().reverse().map(Item)}
          {list.length === 0 && <div className="empty">Nessuna partita. Tocca “Nuova”.</div>}
        </div>
        {sel && (
          <div className="detail">
            <h2>{sel.opponent}</h2>
            <div className="meta">{[fmtDate(sel.date), sel.time, sel.home ? 'casa' : 'trasferta', label(sel.status)].filter(Boolean).join(' · ')}</div>
            {gs && (
              <div className="card pad" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 60 }}>{gs.us} – {gs.opp}</div>
                <div style={{ color: 'var(--muted)' }}>{clubName} – {sel.opponent}</div>
              </div>
            )}
            {sel.status === 'todo' && <button className="btn block" onClick={() => go(`/prepare/${sel.id}`)}>📋 Prepara partita</button>}
            {sel.status === 'live' && <button className="btn block" onClick={() => go(`/record/${sel.id}`)}>▶ Riprendi registrazione</button>}
            {sel.status === 'done' && <button className="btn block" onClick={() => go(`/stats/game/${sel.id}`)}>▥ Vedi statistiche</button>}
            <div className="row-actions">
              {sel.status !== 'done' && sel.status !== 'todo' && <button className="btn ghost" onClick={() => go(`/stats/game/${sel.id}`)}>▥ Statistiche</button>}
              {sel.status === 'done' && <button className="btn ghost" onClick={() => updateGame(sel.id, { status: 'live' })}>↺ Riapri</button>}
              <button className="btn ghost" onClick={() => setForm({ id: sel.id, opponent: sel.opponent, date: sel.date, time: sel.time, home: sel.home })}>✎ Modifica</button>
              <button className="btn danger" onClick={() => { if (confirm(`Eliminare la partita con ${sel.opponent}?`)) { deleteGame(sel.id); go('/games') } }}>Elimina</button>
            </div>
          </div>
        )}
      </div>
      {form && (
        <Modal title={form.id ? 'Modifica partita' : 'Nuova partita'} onClose={() => setForm(null)}>
          <Field label="Avversario"><input value={form.opponent} onChange={(e) => setForm({ ...form, opponent: e.target.value })} autoFocus /></Field>
          <Field label="Data"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Ora"><input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
          <div className="seg" style={{ marginBottom: 16 }}>
            <button className={form.home ? 'on' : ''} onClick={() => setForm({ ...form, home: true })}>Casa</button>
            <button className={!form.home ? 'on' : ''} onClick={() => setForm({ ...form, home: false })}>Trasferta</button>
          </div>
          <div className="row-actions"><button className="btn" onClick={submit}>Salva</button><button className="btn ghost" onClick={() => setForm(null)}>Annulla</button></div>
        </Modal>
      )}
    </>
  )
}
