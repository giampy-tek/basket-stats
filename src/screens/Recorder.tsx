import { useMemo, useState } from 'react'
import { useStore, shortName } from '../store'
import { computeGame, fmtTime, pct, rt } from '../stats'
import { Court, ShotDot, go } from '../ui'
import { isThree } from '../court'
import type { Game, GameEvent } from '../types'
import { GameStatsBody } from './GameStats'

const qLabel = (q: number) => (q <= 4 ? `Q${q}` : `OT${q - 4}`)

function describe(e: GameEvent, name: (id?: string) => string) {
  const who = e.playerId ? name(e.playerId) : 'Squadra'
  switch (e.type) {
    case 'shot': return `${who} · ${e.pts}P ${e.made ? 'segnato' : 'sbagliato'}`
    case 'ft': return `${who} · TL ${e.made ? 'segnato' : 'sbagliato'}`
    case 'oppPts': return `Avversari +${e.pts}`
    case 'reb': return `${who} · rimbalzo ${e.kind === 'off' ? 'off.' : 'dif.'}`
    case 'steal': return `${who} · ${e.kind === 'rec' ? 'recupero' : 'palla persa'}`
    case 'foul': return `${who} · fallo ${e.kind === 'made' ? 'fatto' : 'subito'}`
    case 'assist': return `${who} · assist`
    case 'block': return `${who} · stoppata ${e.kind === 'made' ? 'fatta' : 'subita'}`
    case 'timeout': return `Timeout ${e.side === 'opp' ? 'avversari' : 'noi'}`
    case 'sub': return 'Cambio'
    case 'qend': return `Fine ${qLabel(e.q)}`
  }
}

export default function Recorder({ id }: { id: string }) {
  const game = useStore((s) => s.games.find((g) => g.id === id))
  const { players, seasons, clubName, pushEvent, undo, updateGame } = useStore()
  const [sel, setSel] = useState<string>('')
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null)
  const [ft, setFt] = useState(false)
  const [panel, setPanel] = useState<null | 'subs' | 'stats'>(null)

  const season = seasons.find((s) => s.id === game?.seasonId)
  const gs = useMemo(() => (game ? computeGame(game) : null), [game])
  const gq = useMemo(() => (game ? computeGame(game, game.quarter) : null), [game])
  if (!game || !gs || !gq || !season) return <div className="page">Partita non trovata</div>

  const numberOf = (pid: string) => season.roster.find((r) => r.playerId === pid)?.number ?? 0
  const nameOf = (pid?: string) => shortName(players.find((p) => p.id === pid))
  const onCourt = [...gs.onCourt].sort((a, b) => numberOf(a) - numberOf(b))
  const cur = sel === 'team' || onCourt.includes(sel) ? sel : onCourt[0]
  const isTeam = cur === 'team'
  const s = isTeam ? gs.team : gs.players[cur]
  const sq = isTeam ? gq.team : gq.players[cur]
  const q = game.quarter

  const push = (e: Omit<GameEvent, 'id' | 'q'>) =>
    pushEvent(game.id, { q, playerId: e.type === 'oppPts' || e.type === 'timeout' ? undefined : isTeam ? undefined : cur, ...e })

  const commitShot = (made: boolean) => {
    if (isTeam) return
    if (ft) { push({ type: 'ft', made }); return }
    if (!pt) return
    push({ type: 'shot', made, pts: isThree(pt.x, pt.y) ? 3 : 2, x: pt.x, y: pt.y })
    setPt(null)
  }

  const last = game.events[game.events.length - 1]
  const fl = (n: number) => (n >= 5 ? 'r' : n >= 4 ? 'w' : '')
  const bonus = (n: number) => n >= 5

  const endQuarter = () => {
    if (!confirm(`Chiudere ${qLabel(q)}?`)) return
    pushEvent(game.id, { q, type: 'qend' })
    if (q >= 4 && gs.us !== gs.opp) {
      updateGame(game.id, { status: 'done' })
      go(`/stats/game/${game.id}`)
    } else if (q >= 4 && gs.us === gs.opp && !confirm('Parità: iniziare un supplementare?\n(Annulla = chiudi la partita)')) {
      updateGame(game.id, { status: 'done' })
      go(`/stats/game/${game.id}`)
    } else {
      updateGame(game.id, { quarter: q + 1 })
    }
    setPt(null)
  }

  const Row = ({ mid, left, right, lv, rv, lcls, rcls, onL, onR }: {
    mid: string; left: string; right: string; lv?: number; rv?: number; lcls: string; rcls: string; onL: () => void; onR: () => void
  }) => (
    <div className="rowbtn">
      <button className={`side l ${lcls}`} onClick={onL}><small>◀</small>{lv != null && <span>{lv}</span>}<span style={{ fontSize: 16 }}>{left}</span></button>
      <div className="mid">{mid}</div>
      <button className={`side r ${rcls}`} onClick={onR}><span style={{ fontSize: 16 }}>{right}</span>{rv != null && <span>{rv}</span>}<small>▶</small></button>
    </div>
  )

  return (
    <div className="rec">
      <div className="rec-top">
        <button className="rec-back" onClick={() => go(`/games/${game.id}`)}>←</button>
        <div className="scoreboard">
          <div className="team"><div className="nm">{clubName}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`fl ${bonus(gq.foulsUs[q]) ? 'bonus' : ''}`}>{gq.foulsUs[q]} Falli</span><span className="pts">{gs.us}</span>
            </div></div>
          <span className="qbadge">{qLabel(q)}</span>
          <div className="team"><div className="nm">{game.opponent}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="pts">{gs.opp}</span><span className={`fl ${bonus(gq.foulsOpp[q]) ? 'bonus' : ''}`}>Falli {gq.foulsOpp[q]}</span>
            </div></div>
        </div>
        <button className="endq" onClick={endQuarter}>Fine {qLabel(q)}</button>
      </div>

      <div className="rec-body">
        {/* colonna sinistra: giocatori in campo */}
        <div className="col">
          {onCourt.map((pid) => {
            const st = gs.players[pid]
            const sqp = gq.players[pid]
            return (
              <button key={pid} className={`pcard ${cur === pid ? 'sel' : ''} ${cur === pid && st.f >= 5 ? 'foulout' : ''}`} onClick={() => { setSel(pid); setFt(false) }}>
                <span className="nn">{numberOf(pid)}</span>
                <span><div className="nm">{nameOf(pid)}</div><div className="pt">{st.pts} Pt · {sqp?.pts ?? 0} nel Q</div></span>
                <span className="fouls">Falli<b className={fl(st.f)}>{st.f}</b></span>
              </button>
            )
          })}
          <div className="btnrow" style={{ flex: 'none' }}>
            <button className="dark" onClick={() => setPanel('subs')}>Cambi</button>
            <button className="dark deep" onClick={() => setPanel('stats')}>Statistiche</button>
            <button className={`dark ${isTeam ? '' : 'soft'}`} style={{ gridColumn: '1 / -1' }} onClick={() => { setSel('team'); setFt(false); setPt(null) }}>
              Squadra (senza giocatore)
            </button>
          </div>
        </div>

        {/* colonna centrale: giocatore */}
        <div className="col">
          <div className="phead">
            {!isTeam && <span className="badge">{numberOf(cur)}</span>}
            <span className="nm">{isTeam ? 'Squadra' : nameOf(cur).replace(/^\w\. /, '')}</span>
            {!isTeam && <span className="pp"><b>{s.pts}</b>PUNTI<br />{sq?.pts ?? 0} nel quarto<br />VAL {s.val}</span>}
          </div>
          {!isTeam ? (
            <div className="shoot">
              <div className="r">2P<span className="v" style={{ marginLeft: 'auto' }}>{s.m2}/{s.a2}</span><span className="p">{pct(s.m2, s.a2)}</span></div>
              <div className="r">3P<span className="v" style={{ marginLeft: 'auto' }}>{s.m3}/{s.a3}</span><span className="p">{pct(s.m3, s.a3)}</span></div>
              <div className="r">TL<span className="v" style={{ marginLeft: 'auto' }}>{s.mf}/{s.af}</span><span className="p">{pct(s.mf, s.af)}</span></div>
            </div>
          ) : <div className="ghostbox">Falli, palle e rimbalzi senza giocatore</div>}
          <div className="panel partials">
            <table>
              <thead><tr><th></th>{Array.from({ length: Math.max(4, q) }, (_, i) => <th key={i}>{qLabel(i + 1)}</th>)}</tr></thead>
              <tbody>
                <tr><td>{clubName}</td>{Array.from({ length: Math.max(4, q) }, (_, i) => <td key={i} style={{ color: 'var(--brand)' }}>{gs.perQ.us[i + 1]}</td>)}</tr>
                <tr><td>{game.opponent}</td>{Array.from({ length: Math.max(4, q) }, (_, i) => <td key={i}>{gs.perQ.opp[i + 1]}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <Row mid="Timeout" left="Avv" right="Noi" lv={gq.timeoutsOpp} rv={gq.timeoutsUs} lcls="" rcls=""
            onL={() => push({ type: 'timeout', side: 'opp' })} onR={() => push({ type: 'timeout', side: 'us' })} />
          <div className="rowbtn" style={{ gridTemplateColumns: '1fr', padding: 0 }}>
            <button className="dark soft" style={{ textAlign: 'left', padding: '14px 16px', background: '#fff' }} disabled={!last} onClick={() => undo(game.id)}>
              <span style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em' }}>↶ ANNULLA</span>
              <div style={{ fontWeight: 600, fontSize: 17 }}>{last ? describe(last, nameOf) : 'Niente da annullare'}</div>
            </button>
          </div>
        </div>

        {/* colonna destra: campo + azioni */}
        <div className="col">
          <div className="court-row">
            <div className="shot-btns">
              <button className="made" disabled={isTeam || (!pt && !ft)} onClick={() => commitShot(true)}>▲<span>Segnato</span></button>
              <button className={`tl ${ft ? 'on' : ''}`} disabled={isTeam} onClick={() => { setFt(!ft); setPt(null) }}>TL</button>
              <button className="miss" disabled={isTeam || (!pt && !ft)} onClick={() => commitShot(false)}><span>Sbagliato</span>▼</button>
            </div>
            <Court onTap={(x, y) => { setPt({ x, y }); setFt(false) }}>
              {game.events.filter((e) => e.type === 'shot' && e.q === q && e.x != null).map((e) => (
                <ShotDot key={e.id} x={e.x!} y={e.y!} made={!!e.made} r={0.28} />
              ))}
              {pt && <g><circle cx={pt.x} cy={pt.y} r={0.42} fill="none" stroke="#2a1f1a" strokeWidth={0.12} /><circle cx={pt.x} cy={pt.y} r={0.1} fill="#2a1f1a" /></g>}
            </Court>
          </div>
          <div className="hintline">
            {isTeam ? 'Seleziona un giocatore per registrare un tiro' : ft ? 'Tiro libero: scegli Segnato o Sbagliato' : pt ? (isThree(pt.x, pt.y) ? 'Tiro da 3' : 'Tiro da 2') + ' · scegli Segnato o Sbagliato' : 'Tocca il campo dove ha tirato'}
          </div>
          <div className="section-title" style={{ margin: '4px 0 0', fontSize: 13 }}>Punti avversario</div>
          <div className="opp-pts">
            {[1, 2, 3].map((n) => <button key={n} onClick={() => push({ type: 'oppPts', pts: n })}>+{n}</button>)}
          </div>
          <Row mid="Rimbalzo" left="Off" right="Dif" lv={s?.ro} rv={s?.rd} lcls="pos" rcls="pos"
            onL={() => push({ type: 'reb', kind: 'off' })} onR={() => push({ type: 'reb', kind: 'def' })} />
          <Row mid="Palla" left="Persa" right="Rec" lv={s?.pp} rv={s?.rec} lcls="neg" rcls="pos"
            onL={() => push({ type: 'steal', kind: 'lost' })} onR={() => push({ type: 'steal', kind: 'rec' })} />
          <Row mid="Fallo" left="Fatto" right="Subito" lv={s?.f} rv={s?.fs} lcls="neg" rcls="pos"
            onL={() => push({ type: 'foul', kind: 'made' })} onR={() => push({ type: 'foul', kind: 'drawn' })} />
          <div className="rowbtn">
            <span /><div className="mid">Assist</div>
            <button className="side r pos" onClick={() => !isTeam && push({ type: 'assist' })} disabled={isTeam}><span style={{ fontSize: 16 }}>Dato</span><span>{s?.ass}</span><small>▶</small></button>
          </div>
          <Row mid="Stoppata" left="Presa" right="Fatta" lv={s?.ss} rv={s?.sm} lcls="neg" rcls="pos"
            onL={() => !isTeam && push({ type: 'block', kind: 'suffered' })} onR={() => !isTeam && push({ type: 'block', kind: 'made' })} />
          {void rt}
        </div>
      </div>

      {panel === 'subs' && <Subs game={game} gs={gs} onClose={() => setPanel(null)} />}
      {panel === 'stats' && (
        <div className="overlay">
          <div className="top-nav">
            <h1>Statistiche</h1>
            <button className="btn" onClick={() => setPanel(null)}>✕ Torna al registratore</button>
          </div>
          <div className="page"><GameStatsBody game={game} live /></div>
        </div>
      )}
    </div>
  )
}

function Subs({ game, gs, onClose }: { game: Game; gs: ReturnType<typeof computeGame>; onClose: () => void }) {
  const { seasons, players, pushEvent } = useStore()
  const season = seasons.find((s) => s.id === game.seasonId)!
  const q = game.quarter
  const L = game.quarterLength
  const lastSub = [...game.events].reverse().find((e) => e.q === q && e.type === 'sub')
  const [remaining, setRemaining] = useState(lastSub?.remaining ?? L)
  const [outSel, setOutSel] = useState<string[]>([])
  const [inSel, setInSel] = useState<string[]>([])
  const roster = [...season.roster].sort((a, b) => a.number - b.number)
  const onIds = roster.filter((r) => gs.onCourt.includes(r.playerId))
  const offIds = roster.filter((r) => !gs.onCourt.includes(r.playerId))
  const adj = (d: number) => setRemaining((r) => Math.min(L, Math.max(0, r + d)))
  const tog = (arr: string[], set: (a: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  const ok = outSel.length > 0 && outSel.length === inSel.length
  const save = () => {
    pushEvent(game.id, { q, type: 'sub', remaining, out: outSel, in: inSel })
    onClose()
  }
  const List = ({ items, sel, set, title }: { items: typeof roster; sel: string[]; set: (a: string[]) => void; title: string }) => (
    <div>
      <h2 style={{ fontSize: 26, display: 'flex', justifyContent: 'space-between' }}>{title}<span style={{ fontSize: 16, color: 'var(--muted)' }}>{items.length}</span></h2>
      <div className="card list" style={{ marginTop: 8 }}>
        {items.map((r) => {
          const p = players.find((x) => x.id === r.playerId)
          const st = gs.players[r.playerId]
          return (
            <button key={r.playerId} className={`sub-row ${sel.includes(r.playerId) ? 'sel' : ''}`} onClick={() => tog(sel, set, r.playerId)}>
              <span className="n">{r.number}</span><span>{p?.last} {p?.first}</span>
              <span className="m">{fmtTime(st?.min ?? 0)}</span><span>{st?.f ?? 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
  return (
    <div className="overlay">
      <div className="top-nav"><button className="round" onClick={onClose}>‹</button><h1>Cambi</h1><span style={{ width: 54 }} /></div>
      <div className="page stack">
        <div className="subs-time">
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>TEMPO RIMANENTE NEL PERIODO ({qLabel(q)})</div>
          <div className="clock">{fmtTime(remaining)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <button className="btn" onClick={() => adj(60)}>+1:00</button>
            <button className="btn" onClick={() => adj(5)}>+5s</button>
            <button className="btn" onClick={() => adj(-5)}>−5s</button>
            <button className="btn" onClick={() => adj(-60)}>−1:00</button>
          </div>
        </div>
        <div className="sub-lists">
          <List title="In campo" items={onIds} sel={outSel} set={setOutSel} />
          <List title="Fuori" items={offIds} sel={inSel} set={setInSel} />
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Tocca chi esce e chi entra (stesso numero di giocatori), poi salva. Il cronometro serve a calcolare minuti e +/-.</div>
        <div className="sub-lists">
          <button className="btn ghost" onClick={onClose}>Annulla</button>
          <button className="btn" disabled={!ok} onClick={save}>Salva cambio</button>
        </div>
      </div>
    </div>
  )
}
