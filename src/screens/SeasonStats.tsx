import { useState } from 'react'
import { useStore } from '../store'
import { computeSeason, pct, zoneTotals } from '../stats'
import { ShotMapPanel } from './ShotMap'
import { ShotDotsMaps } from '../ShotDots'
import { SeasonTable, type SeasonRow } from '../SeasonTable'
import { Modal } from '../ui'

export default function SeasonStats() {
  const { games, seasons, seasonId, players, clubName } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const [avg, setAvg] = useState(false)
  const [help, setHelp] = useState(false)
  if (!season) return <div className="page">Nessuna stagione</div>
  const agg = computeSeason(games.filter((g) => g.seasonId === seasonId))
  const events = games.filter((g) => g.seasonId === seasonId && g.status === 'done').flatMap((g) => g.events)
  const zt = zoneTotals(events)
  const zl = [['campana', 'Campana'], ['media', 'Media distanza'], ['da3', 'Da 3']] as const
  const rows: SeasonRow[] = season.roster
    .map((r) => ({ r, a: agg.agg[r.playerId] }))
    .filter((x) => x.a)
    .sort((a, b) => b.a.stat.pts - a.a.stat.pts || b.a.stat.min - a.a.stat.min)
    .map(({ r, a }) => {
      const p = players.find((x) => x.id === r.playerId)
      return { key: r.playerId, label: `#${r.number} ${p?.last ?? ''} ${p?.first ?? ''}`.trim(), s: a.stat, games: a.games }
    })
  return (
    <>
      <div className="top-nav">
        <button className="round" onClick={() => history.back()}>‹</button>
        <h1>Stats stagione</h1><span style={{ width: 54 }} />
      </div>
      <div className="page stack">
        <div className="card pad" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.08em' }}>{clubName.toUpperCase()}</div>
            <h2 style={{ fontSize: 32 }}>{season.year} {season.category}</h2>
          </div>
          <div style={{ color: 'var(--muted)', fontWeight: 600, marginLeft: 'auto' }}>
            Partite completate: {agg.games} · Giocatori: {rows.length} · Punti subiti: {agg.oppPts}
          </div>
          <div className="seg light" style={{ background: 'var(--cream)' }}>
            <button className={!avg ? 'on' : ''} onClick={() => setAvg(false)}>Totali</button>
            <button className={avg ? 'on' : ''} onClick={() => setAvg(true)}>Medie</button>
          </div>
          <button className="round" style={{ width: 44, height: 44, fontWeight: 700, color: 'var(--brand)' }} title="Legenda" onClick={() => setHelp(true)}>?</button>
        </div>
        {rows.length === 0 ? <div className="empty card">Nessuna partita terminata: le statistiche appaiono qui appena ne chiudi una.</div> :
          <SeasonTable rows={rows} team={agg.team} total={agg.total} avg={avg} totalGames={agg.games} />}
        {rows.length > 0 && (
          <div className="card pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>Tiri per zona</div>
            </div>
            <div className="zone-box" style={{ marginBottom: 14 }}>
              {zl.map(([z, n]) => <div key={z}><small>{n.toUpperCase()}</small><b>{pct(zt.team[z].m, zt.team[z].a)}</b><span>{zt.team[z].m}/{zt.team[z].a}</span></div>)}
            </div>
            <div className="tablewrap">
              <table className="stats">
                <thead><tr><th>Giocatore</th>{zl.map(([, n]) => <th key={n}>{n}</th>)}</tr></thead>
                <tbody>
                  {rows.filter((r) => zt.players[r.key]).map((r) => (
                    <tr key={r.key}><td>{r.label}</td>{zl.map(([z]) => {
                      const c = zt.players[r.key][z]
                      return <td key={z}>{c.m}/{c.a}<br /><small style={{ color: 'var(--muted)' }}>{pct(c.m, c.a)}</small></td>
                    })}</tr>
                  ))}
                  <tr className="total"><td>Totale squadra</td>{zl.map(([z]) => <td key={z}>{zt.team[z].m}/{zt.team[z].a}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        {rows.length > 0 && (
          <div className="card pad">
            <div className="section-title" style={{ margin: '0 0 10px' }}>Mappa di tiro</div>
            <ShotMapPanel games={games.filter((g) => g.seasonId === seasonId && g.status === 'done')} />
          </div>
        )}
        {rows.length > 0 && (
          <ShotDotsMaps shots={events.filter((e) => e.type === 'shot')} numberOf={(id) => season.roster.find((r) => r.playerId === id)?.number} />
        )}
      </div>
      {help && (
        <Modal title="Legenda" onClose={() => setHelp(false)}>
          <div className="card list" style={{ marginBottom: 12 }}>
            {LEGEND.map(([k, d]) => <div key={k} className="list-row" style={{ padding: '10px 16px' }}><b style={{ width: 64, flex: 'none' }}>{k}</b><span className="s" style={{ color: 'var(--ink)' }}>{d}</span></div>)}
          </div>
          <button className="btn ghost block" onClick={() => setHelp(false)}>Chiudi</button>
        </Modal>
      )}
    </>
  )
}

const LEGEND: [string, string][] = [
  ['G', 'Partite giocate'], ['Min', 'Minuti giocati'], ['Pt', 'Punti'], ['P/M', 'Punti per minuto giocato'],
  ['2P / 3P / TL', 'Segnati (S), tentati (T) e percentuale: tiri da 2, da 3 e liberi'],
  ['F / FS', 'Falli fatti / falli subiti'], ['RO / RD / RT', 'Rimbalzi offensivi, difensivi, totali'],
  ['Rec / PP', 'Palle recuperate / palle perse'], ['Ass', 'Assist'], ['SD / SS', 'Stoppate date / subite'],
  ['PIR', 'Indice di valutazione FIP: VAL + falli subiti − falli commessi − stoppate subite'],
  ['VAL', 'Valutazione: punti − tiri sbagliati + rimbalzi + assist − palle perse + recuperi + stoppate date'],
  ['Medie', 'Ogni valore diviso per le partite giocate'],
]
