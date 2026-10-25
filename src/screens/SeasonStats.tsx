import { useState } from 'react'
import { useStore } from '../store'
import { computeSeason, pct, zoneTotals } from '../stats'
import { go } from '../ui'
import { StatsTable, type Row } from '../StatsTable'

export default function SeasonStats() {
  const { games, seasons, seasonId, players, clubName } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const [avg, setAvg] = useState(false)
  if (!season) return <div className="page">Nessuna stagione</div>
  const agg = computeSeason(games.filter((g) => g.seasonId === seasonId))
  const events = games.filter((g) => g.seasonId === seasonId && g.status === 'done').flatMap((g) => g.events)
  const zt = zoneTotals(events)
  const zl = [['campana', 'Campana'], ['media', 'Media distanza'], ['da3', 'Da 3']] as const
  const rows: Row[] = season.roster
    .map((r) => ({ r, a: agg.agg[r.playerId] }))
    .filter((x) => x.a)
    .sort((a, b) => b.a.stat.val - a.a.stat.val)
    .map(({ r, a }) => {
      const p = players.find((x) => x.id === r.playerId)
      return { key: r.playerId, label: `#${r.number} ${p?.last} ${p?.first}`, s: a.stat, games: a.games }
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
        </div>
        {rows.length === 0 ? <div className="empty card">Nessuna partita terminata: le statistiche appaiono qui appena ne chiudi una.</div> :
          <StatsTable mode="season" rows={rows} total={agg.total} avg={avg} totalGames={agg.games} />}
        {rows.length > 0 && (
          <div className="card pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="section-title" style={{ margin: 0 }}>Tiri per zona</div>
              <button className="btn small" onClick={() => go('/stats/map')}>Mappa di tiro →</button>
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
      </div>
    </>
  )
}
