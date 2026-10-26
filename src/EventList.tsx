import { useState } from 'react'
import { Ic } from './ui'
import { useStore, shortName, useCanEdit } from './store'
import { ADD_PRESETS, eventLabel, qLabel } from './eventText'
import { Modal, Field } from './ui'
import type { Game } from './types'

/** Elenco azioni di una partita (o di un quarto), con modifica: esito tiro, giocatore, elimina, aggiungi. */
export function EventList({ game, quarter = 0, compact = false, allowAdd = false }: {
  game: Game; quarter?: number; compact?: boolean; allowAdd?: boolean
}) {
  const { players, seasons, updateEvent, deleteEvent, addEvent } = useStore()
  const season = seasons.find((s) => s.id === game.seasonId)
  const canEdit = useCanEdit()
  const roster = [...(season?.roster ?? [])].sort((a, b) => a.number - b.number)
  const num = (id?: string) => roster.find((r) => r.playerId === id)?.number
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ preset: 's2+', player: '', q: quarter || game.quarter })

  const list = game.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.type !== 'sub' && e.type !== 'qend' && (quarter === 0 || e.q === quarter))
    .reverse()

  const needsPlayer = (type: string) => !['oppPts', 'timeout'].includes(type)
  const save = () => {
    const pr = ADD_PRESETS.find((x) => x.id === form.preset)!
    if (pr.needsPlayer && !form.player) return
    addEvent(game.id, { q: form.q, playerId: form.player || undefined, ...pr.make() })
    setAdding(false)
  }
  const maxQ = Math.max(4, game.quarter)

  return (
    <div>
      {allowAdd && canEdit && <button className="btn small ghost" style={{ marginBottom: 10 }} onClick={() => { setForm({ preset: 's2+', player: roster[0]?.playerId ?? '', q: quarter || game.quarter }); setAdding(true) }}><Ic name="plus" /> Aggiungi azione</button>}
      {list.length === 0 && <div className="empty">Nessuna azione.</div>}
      <div className="card list">
        {list.map(({ e }) => (
          <div key={e.id} className="ev-row">
            <span className="ev-q">{qLabel(e.q)}</span>
            <span className="ev-n">{e.playerId ? num(e.playerId) : e.type === 'oppPts' || e.side === 'opp' ? 'AV' : '—'}</span>
            <span className="ev-t">
              {!compact && e.playerId ? <b>{shortName(players.find((p) => p.id === e.playerId))} · </b> : compact && e.playerId ? <b>{shortName(players.find((p) => p.id === e.playerId)).split(' ').slice(-1)[0]} · </b> : null}
              {eventLabel(e)}
            </span>
            {canEdit && (e.type === 'shot' || e.type === 'ft') && (
              <button className={`ev-btn ${e.made ? 'ok' : 'ko'}`} title="Cambia esito" onClick={() => updateEvent(game.id, e.id, { made: !e.made })}>{e.made ? '✓' : '✗'}</button>
            )}
            {canEdit && e.type === 'shot' && (
              <button className="ev-btn" title="Cambia 2/3 punti" onClick={() => updateEvent(game.id, e.id, { pts: e.pts === 3 ? 2 : 3 })}>{e.pts}P</button>
            )}
            {canEdit && e.playerId && !compact && (
              <select className="ev-sel" value={e.playerId} onChange={(ev) => updateEvent(game.id, e.id, { playerId: ev.target.value })}>
                {roster.map((r) => <option key={r.playerId} value={r.playerId}>{r.number} {shortName(players.find((p) => p.id === r.playerId))}</option>)}
              </select>
            )}
            {canEdit && <button className="ev-btn del" title="Elimina" onClick={() => deleteEvent(game.id, e.id)}><Ic name="trash" /></button>}
          </div>
        ))}
      </div>
      {adding && (
        <Modal title="Aggiungi azione" onClose={() => setAdding(false)}>
          <Field label="Azione">
            <select value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })}>
              {ADD_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
          {needsPlayer(ADD_PRESETS.find((p) => p.id === form.preset)!.make().type) && (
            <Field label="Giocatore">
              <select value={form.player} onChange={(e) => setForm({ ...form, player: e.target.value })}>
                {roster.map((r) => <option key={r.playerId} value={r.playerId}>{r.number} {shortName(players.find((p) => p.id === r.playerId))}</option>)}
              </select>
            </Field>
          )}
          <Field label="Quarto">
            <select value={form.q} onChange={(e) => setForm({ ...form, q: Number(e.target.value) })}>
              {Array.from({ length: maxQ }, (_, i) => i + 1).map((q) => <option key={q} value={q}>{qLabel(q)}</option>)}
            </select>
          </Field>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Le azioni aggiunte a mano non hanno posizione sul campo: contano nelle statistiche ma non compaiono nelle mappe di tiro.</p>
          <div className="row-actions"><button className="btn" onClick={save}>Aggiungi</button><button className="btn ghost" onClick={() => setAdding(false)}>Annulla</button></div>
        </Modal>
      )}
    </div>
  )
}
