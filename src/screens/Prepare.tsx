import { useState } from 'react'
import { useStore, playerName } from '../store'
import { go, Hero } from '../ui'

export default function Prepare({ id }: { id: string }) {
  const { games, seasons, players, updateGame } = useStore()
  const game = games.find((g) => g.id === id)
  const season = seasons.find((s) => s.id === game?.seasonId)
  const [starters, setStarters] = useState<string[]>(game?.starters ?? [])
  const [len, setLen] = useState(game ? game.quarterLength / 60 : 10)
  if (!game || !season) return <Hero title="Partita non trovata" back={{ label: 'Partite', to: '/games' }} />

  const roster = [...season.roster].sort((a, b) => a.number - b.number)
  const toggle = (pid: string) =>
    setStarters((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : s.length < 5 ? [...s, pid] : s))
  const start = () => {
    updateGame(game.id, { starters, quarterLength: len * 60, status: 'live', quarter: 1 })
    go(`/record/${game.id}`)
  }

  return (
    <>
      <Hero title={`vs ${game.opponent}`} sub="Scegli il quintetto base" back={{ label: 'Partite', to: `/games/${game.id}` }} />
      <div className="page">
        <div className="section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
          Quintetto base <span style={{ color: 'var(--brand)' }}>{starters.length}/5</span>
        </div>
        <div className="pick-grid">
          {roster.map((r) => {
            const p = players.find((x) => x.id === r.playerId)
            return (
              <button key={r.playerId} className={`pick ${starters.includes(r.playerId) ? 'on' : ''}`} onClick={() => toggle(r.playerId)}>
                <span className="num">{r.number}</span>
                <span><b>{playerName(p)}</b><br /><small style={{ color: 'var(--muted)' }}>{p?.role}</small></span>
              </button>
            )
          })}
        </div>
        <div className="section-title">Durata quarto</div>
        <div className="seg" style={{ maxWidth: 360 }}>
          {[8, 10, 12].map((m) => <button key={m} className={len === m ? 'on' : ''} onClick={() => setLen(m)}>{m} min</button>)}
        </div>
        <div style={{ marginTop: 28 }}>
          <button className="btn block" disabled={starters.length !== 5} onClick={start}>▶ Inizia partita</button>
        </div>
      </div>
    </>
  )
}
