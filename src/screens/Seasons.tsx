import { useState } from 'react'
import { useStore, useCanEdit } from '../store'
import { go, Hero, Modal, Field } from '../ui'

export default function Seasons() {
  const { seasons, seasonId, setSeason, games, addSeason, updateSeason, deleteSeason } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const canEdit = useCanEdit()
  const [edit, setEdit] = useState<'new' | 'edit' | null>(null)
  const [f, setF] = useState({ year: '', category: '', coach: '', vice: '', shirt1: '#0000FF', shirt2: '#FFFFFF' })

  const openForm = (m: 'new' | 'edit') => {
    setF(m === 'edit' && season ? { year: season.year, category: season.category, coach: season.coach, vice: season.vice, shirt1: season.shirt1, shirt2: season.shirt2 }
      : { year: '2026/2027', category: '', coach: '', vice: '', shirt1: '#0000FF', shirt2: '#FFFFFF' })
    setEdit(m)
  }
  const save = () => {
    if (edit === 'new') addSeason(f)
    else if (season) updateSeason(season.id, f)
    setEdit(false as unknown as null)
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const count = (id: string) => games.filter((g) => g.seasonId === id).length

  return (
    <>
      <Hero title="Stagioni" sub={useStore.getState().clubName} back={{ label: 'Dashboard', to: '/' }}
        right={canEdit ? <button className="pill" onClick={() => openForm('new')}>＋ Nuova</button> : undefined} />
      <div className="page" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 28 }}>
        <div>
          {seasons.map((s) => (
            <button key={s.id} className={`game-item ${s.id === seasonId ? 'sel' : ''}`} onClick={() => setSeason(s.id)}>
              <div>
                <div className="n">{s.category}</div>
                <div className="d">{s.year} · {count(s.id)} partite · {s.roster.length} giocatori</div>
              </div>
            </button>
          ))}
        </div>
        {season && (
          <div>
            <h2 style={{ fontSize: 60 }}>{season.year}</h2>
            <div style={{ color: 'var(--muted)', fontSize: 18, marginBottom: 16 }}>{season.category}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', gap: 12 }}>
              <button className="card tile" style={{ background: 'var(--brand)', color: '#fff', minHeight: 150 }} onClick={() => go('/games')}>
                <h2>Partite</h2><div className="big" style={{ color: '#fff', fontSize: 64 }}>{count(season.id)}</div>
              </button>
              <button className="card tile" style={{ minHeight: 150 }} onClick={() => go('/roster')}>
                <h2>Roster</h2><div className="big" style={{ fontSize: 64 }}>{season.roster.length}</div>
              </button>
              <button className="card tile" style={{ minHeight: 150 }} onClick={() => go('/stats/season')}>
                <h2>Statistiche</h2><div className="hint">Squadra e giocatori</div>
              </button>
            </div>
            <div className="section-title">Staff tecnico</div>
            <div className="card list">
              <div className="list-row"><span className="s" style={{ width: 100 }}>Coach</span><span style={{ marginLeft: 'auto', fontWeight: 600 }}>{season.coach || '—'}</span></div>
              <div className="list-row"><span className="s" style={{ width: 100 }}>Vice coach</span><span style={{ marginLeft: 'auto', fontWeight: 600 }}>{season.vice || '—'}</span></div>
            </div>
            <div className="section-title">Maglie</div>
            <div className="card list">
              <div className="list-row"><span style={{ width: 34, height: 34, borderRadius: 8, background: season.shirt1, border: '1px solid var(--line)' }} /><div><div className="t">Prima maglia</div><div className="s">{season.shirt1}</div></div></div>
              <div className="list-row"><span style={{ width: 34, height: 34, borderRadius: 8, background: season.shirt2, border: '1px solid var(--line)' }} /><div><div className="t">Seconda maglia</div><div className="s">{season.shirt2}</div></div></div>
            </div>
            {canEdit && <div className="row-actions">
              <button className="btn ghost" onClick={() => openForm('edit')}>✎ Modifica</button>
              <button className="btn danger" onClick={() => { if (confirm('Eliminare la stagione e tutte le sue partite?')) deleteSeason(season.id) }}>Elimina</button>
            </div>}
          </div>
        )}
      </div>
      {edit && (
        <Modal title={edit === 'new' ? 'Nuova stagione' : 'Modifica stagione'} onClose={() => setEdit(null)}>
          <Field label="Anno"><input value={f.year} onChange={set('year')} /></Field>
          <Field label="Categoria"><input value={f.category} onChange={set('category')} placeholder="Under 17 Gold" /></Field>
          <Field label="Coach"><input value={f.coach} onChange={set('coach')} /></Field>
          <Field label="Vice coach"><input value={f.vice} onChange={set('vice')} /></Field>
          <div style={{ display: 'flex', gap: 14 }}>
            <Field label="Prima maglia"><input type="color" value={f.shirt1} onChange={set('shirt1')} /></Field>
            <Field label="Seconda maglia"><input type="color" value={f.shirt2} onChange={set('shirt2')} /></Field>
          </div>
          <div className="row-actions"><button className="btn" onClick={save}>Salva</button><button className="btn ghost" onClick={() => setEdit(null)}>Annulla</button></div>
        </Modal>
      )}
    </>
  )
}
