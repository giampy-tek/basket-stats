import { useState } from 'react'
import { useStore, playerName } from '../store'
import { Avatar, go, Hero } from '../ui'

const MAX_CALLED = 12

export default function Prepare({ id }: { id: string }) {
  const { games, seasons, players, updateGame } = useStore()
  const game = games.find((g) => g.id === id)
  const season = seasons.find((s) => s.id === game?.seasonId)
  const big = (season?.roster.length ?? 0) > MAX_CALLED // roster più grande di 12: serve la lista dei convocati
  const [called, setCalled] = useState<string[]>(game?.called ?? [])
  const [step, setStep] = useState<'call' | 'five'>(big && !game?.called ? 'call' : 'five')
  const [starters, setStarters] = useState<string[]>(game?.starters ?? [])
  const [len, setLen] = useState(game ? game.quarterLength / 60 : 10)
  if (!game || !season) return <Hero title="Partita non trovata" back={{ label: 'Partite', to: '/games' }} />

  const roster = [...season.roster].sort((a, b) => a.number - b.number)
  const pool = big ? roster.filter((r) => called.includes(r.playerId)) : roster
  const toggleCall = (pid: string) => setCalled((c) => (c.includes(pid) ? c.filter((x) => x !== pid) : c.length < MAX_CALLED ? [...c, pid] : c))
  const toggle = (pid: string) =>
    setStarters((s) => (s.includes(pid) ? s.filter((x) => x !== pid) : s.length < 5 ? [...s, pid] : s))
  const goFive = () => { setStarters((s) => s.filter((x) => called.includes(x))); setStep('five') }
  const start = () => {
    updateGame(game.id, { starters, called: big ? called : undefined, quarterLength: len * 60, status: 'live', quarter: 1 })
    go(`/record/${game.id}`)
  }

  const Card = ({ pid, number, on, onClick }: { pid: string; number: number; on: boolean; onClick: () => void }) => {
    const p = players.find((x) => x.id === pid)
    return (
      <button className={`pick ${on ? 'on' : ''}`} onClick={onClick}>
        <span className="num">{number}</span>
        <Avatar photo={p?.photo} size={40} />
        <span><b>{playerName(p)}</b><br /><small style={{ color: 'var(--muted)' }}>{p?.role}</small></span>
      </button>
    )
  }

  if (step === 'call') {
    return (
      <>
        <Hero title={`vs ${game.opponent}`} sub="1 di 2 · Scegli i convocati" back={{ label: 'Partite', to: `/games/${game.id}` }} />
        <div className="page">
          <div className="section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
            Convocati <span style={{ color: 'var(--brand)' }}>{called.length}/{MAX_CALLED}</span>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>Il roster ha {roster.length} giocatori: tocca i massimo {MAX_CALLED} che giocano questa partita. Gli altri non compaiono in panchina né nelle statistiche.</p>
          <div className="pick-grid">
            {roster.map((r) => <Card key={r.playerId} pid={r.playerId} number={r.number} on={called.includes(r.playerId)} onClick={() => toggleCall(r.playerId)} />)}
          </div>
          <div style={{ marginTop: 28 }}>
            <button className="btn block" disabled={called.length < 5} onClick={goFive}>Avanti: scegli il quintetto →</button>
            {called.length < 5 && <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>Servono almeno 5 convocati.</p>}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Hero title={`vs ${game.opponent}`} sub={big ? `2 di 2 · Quintetto base · ${called.length} convocati` : 'Scegli il quintetto base'}
        back={big ? undefined : { label: 'Partite', to: `/games/${game.id}` }}
        right={big ? <button className="pill" onClick={() => setStep('call')}>‹ Convocati</button> : undefined} />
      <div className="page">
        <div className="section-title" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
          Quintetto base <span style={{ color: 'var(--brand)' }}>{starters.length}/5</span>
        </div>
        <div className="pick-grid">
          {pool.map((r) => <Card key={r.playerId} pid={r.playerId} number={r.number} on={starters.includes(r.playerId)} onClick={() => toggle(r.playerId)} />)}
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
