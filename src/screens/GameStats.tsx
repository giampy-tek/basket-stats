import { useState } from 'react'
import { useStore } from '../store'
import { computeGame, pct } from '../stats'
import { StatsTable, type Row } from '../StatsTable'
import { Court, ShotDot, go } from '../ui'
import { boxscorePng, shareOrDownload } from '../boxscore'
import { EventList } from '../EventList'
import { zoneOf, type Zone } from '../court'
import { qLabel } from '../eventText'
import type { Game, PStat } from '../types'

export function useRows(game: Game, gs: ReturnType<typeof computeGame>, live: boolean): Row[] {
  const { seasons, players } = useStore()
  const season = seasons.find((s) => s.id === game.seasonId)
  const roster = [...(season?.roster ?? [])].sort((a, b) => a.number - b.number)
  const played = (s: PStat) =>
    s.min > 0 || s.pts > 0 || s.a2 + s.a3 + s.af + s.f + s.fs + s.ro + s.rd + s.rec + s.pp + s.ass + s.sm + s.ss > 0
  return roster
    .map((r) => {
      const p = players.find((x) => x.id === r.playerId)
      const s = gs.players[r.playerId]
      return { key: r.playerId, label: `${r.number} ${p ? p.first[0] + '. ' + p.last : '?'}`, s, onCourt: live && gs.onCourt.includes(r.playerId) }
    })
    .filter((r) => !!r.s && (played(r.s) || r.onCourt))
}

export function GameStatsBody({ game, live = false }: { game: Game; live?: boolean }) {
  const { players, seasons, clubName } = useStore()
  const season = seasons.find((s) => s.id === game.seasonId)
  const [q, setQ] = useState(0)
  const gs = computeGame(game, q)
  const all = computeGame(game)
  const rows = useRows(game, gs, live)
  const numberOf = (id?: string) => season?.roster.find((r) => r.playerId === id)?.number
  const maxQ = Math.max(4, game.quarter)

  const shots = game.events.filter((e) => e.type === 'shot' && e.x != null && (q === 0 || e.q === q))
  const zones: Record<Zone, { m: number; a: number }> = { campana: { m: 0, a: 0 }, media: { m: 0, a: 0 }, da3: { m: 0, a: 0 } }
  const perPlayerZone: Record<string, Record<Zone, { m: number; a: number }>> = {}
  for (const e of shots) {
    const z = zoneOf(e.x!, e.y!)
    zones[z].a++; if (e.made) zones[z].m++
    if (e.playerId) {
      const pz = (perPlayerZone[e.playerId] ??= { campana: { m: 0, a: 0 }, media: { m: 0, a: 0 }, da3: { m: 0, a: 0 } })
      pz[z].a++; if (e.made) pz[z].m++
    }
  }
  const zl: [Zone, string][] = [['campana', 'Campana'], ['media', 'Media'], ['da3', 'Da 3']]
  const made = shots.filter((e) => e.made)
  const missed = shots.filter((e) => !e.made)

  return (
    <div className="stack">
      <div className="seg light" style={{ maxWidth: 520, background: 'var(--cream)' }}>
        <button className={q === 0 ? 'on' : ''} onClick={() => setQ(0)}>Partita</button>
        {Array.from({ length: maxQ }, (_, i) => i + 1).map((i) => (
          <button key={i} className={q === i ? 'on' : ''} onClick={() => setQ(i)}>{qLabel(i)}</button>
        ))}
      </div>
      <div className="card pad" style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h2 style={{ fontSize: 28 }}>{clubName}</h2>
        <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 48 }}>{gs.us} – {gs.opp}</span>
        <h2 style={{ fontSize: 28 }}>{game.opponent}</h2>
      </div>
      <StatsTable rows={rows} team={gs.team} total={{ ...gs.total, val: gs.total.val }} />
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
        S segnati · T tentati · F falli fatti · FS falli subiti · RO/RD/RT rimbalzi off., dif., totali · Rec recuperi · PP palle perse · Ass assist · SM/SS stoppate messe/subite · VAL valutazione · +/- scarto di punti con il giocatore in campo.
      </div>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card pad partials">
          <div className="section-title" style={{ margin: '0 0 6px' }}>Parziali</div>
          <table>
            <thead><tr><th></th>{Array.from({ length: maxQ }, (_, i) => <th key={i}>{qLabel(i + 1)}</th>)}</tr></thead>
            <tbody>
              <tr><td>{clubName}</td>{Array.from({ length: maxQ }, (_, i) => <td key={i} style={{ color: 'var(--brand)' }}>{all.perQ.us[i + 1]}</td>)}</tr>
              <tr><td>{game.opponent}</td>{Array.from({ length: maxQ }, (_, i) => <td key={i}>{all.perQ.opp[i + 1]}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <div className="card pad">
          <div className="section-title" style={{ margin: '0 0 6px' }}>Falli di squadra</div>
          {[clubName, game.opponent].map((n, i) => (
            <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 600 }}>
              <span>{n}</span><span>{q === 0 ? (i === 0 ? all.foulsUs : all.foulsOpp).reduce((a, b) => a + b, 0) : (i === 0 ? all.foulsUs : all.foulsOpp)[q]}</span>
            </div>
          ))}
        </div>
        <div className="card pad">
          <div className="section-title" style={{ margin: '0 0 6px' }}>Timeout</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 600 }}><span>Noi</span><span>{gs.timeoutsUs}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 600 }}><span>Avversari</span><span>{gs.timeoutsOpp}</span></div>
          <div className="section-title" style={{ margin: '10px 0 6px' }}>Rimbalzi avversari</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 600 }}><span>Off. / Dif.</span><span>{gs.oppRo} / {gs.oppRd}</span></div>
        </div>
      </div>

      <div className="card pad">
        <div className="section-title" style={{ margin: '0 0 10px' }}>Tiri per zona</div>
        <div className="zones">
          <div>
            <Court>
              {shots.map((e) => <ShotDot key={e.id} x={e.x!} y={e.y!} made={!!e.made} r={0.22} />)}
            </Court>
            <div className="zone-box">
              {zl.map(([z, name]) => (
                <div key={z}><small>{name.toUpperCase()}</small><b>{pct(zones[z].m, zones[z].a)}</b><span>{zones[z].m}/{zones[z].a}</span></div>
              ))}
            </div>
          </div>
          <div className="tablewrap">
            <table className="stats">
              <thead><tr><th>Giocatore</th>{zl.map(([, n]) => <th key={n}>{n}</th>)}</tr></thead>
              <tbody>
                {rows.filter((r) => perPlayerZone[r.key]).map((r) => (
                  <tr key={r.key}><td>{r.label}</td>{zl.map(([z]) => {
                    const c = perPlayerZone[r.key][z]
                    return <td key={z}>{c.m}/{c.a}<br /><small style={{ color: 'var(--muted)' }}>{pct(c.m, c.a)}</small></td>
                  })}</tr>
                ))}
                <tr className="total"><td>Totale squadra</td>{zl.map(([z]) => <td key={z}>{zones[z].m}/{zones[z].a}</td>)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="maps">
        {[['Segnati', made], ['Sbagliati', missed]].map(([title, list]) => (
          <div key={title as string} className="card" style={{ overflow: 'hidden' }}>
            <div className="map-title"><span>{title as string}</span><span style={{ color: 'var(--muted)' }}>{(list as typeof shots).length}</span></div>
            <Court>
              {(list as typeof shots).map((e) => <ShotDot key={e.id} x={e.x!} y={e.y!} made={!!e.made} label={String(numberOf(e.playerId) ?? '')} r={0.38} />)}
            </Court>
          </div>
        ))}
      </div>
      <div className="card pad">
        <div className="section-title" style={{ margin: '0 0 10px' }}>Modifica azioni {q === 0 ? 'della partita' : `del ${qLabel(q)}`}</div>
        <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: 14 }}>Cambia l’esito di un tiro (✓/✗) o i punti (2P/3P), assegna l’azione a un altro giocatore, eliminala o aggiungine una. Le statistiche si aggiornano subito.</p>
        <EventList game={game} quarter={q} allowAdd />
      </div>
      {void players}
    </div>
  )
}

export default function GameStats({ id }: { id: string }) {
  const game = useStore((s) => s.games.find((g) => g.id === id))
  const { seasons, players, clubName } = useStore()
  const season = seasons.find((s) => s.id === game?.seasonId)
  const exportPng = async () => {
    if (!game || !season) return
    const blob = await boxscorePng(game, season, players, clubName)
    await shareOrDownload(blob, `tabellino-${game.opponent.toLowerCase().replace(/\W+/g, '-')}-${game.date}.png`)
  }
  if (!game) return <div className="page">Partita non trovata</div>
  return (
    <>
      <div className="top-nav">
        <button className="round" onClick={() => history.back()}>‹</button>
        <h1>Stats partita · {game.opponent}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn small" onClick={exportPng}>⬇ Tabellino PNG</button>
          {game.status === 'live' && <button className="btn small ghost" onClick={() => go(`/record/${id}`)}>Registratore</button>}
        </div>
      </div>
      <div className="page"><GameStatsBody game={game} live={game.status === 'live'} /></div>
    </>
  )
}
