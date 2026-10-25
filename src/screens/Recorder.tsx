import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore, shortName } from '../store'
import { computeGame, fmtTime, pct } from '../stats'
import { Avatar, Court, Modal, ShotDot, go } from '../ui'
import { isThree } from '../court'
import { eventLabel, qLabel } from '../eventText'
import { EventList } from '../EventList'
import type { Game, GameEvent } from '../types'
import { GameStatsBody } from './GameStats'

type Panel = null | 'subs' | 'stats' | 'bench' | 'team' | 'oppreb'

/** Riga azione: si trascina il pallino centrale a sinistra/destra (oppure si tocca il lato). */
function DragRow({ mid, left, right, lv, rv, lcls = '', rcls = '', onL, onR, noLeft }: {
  mid: string; left?: string; right: string; lv?: number; rv?: number; lcls?: string; rcls?: string
  onL?: () => void; onR: () => void; noLeft?: boolean
}) {
  const [dx, setDx] = useState(0)
  const [drag, setDrag] = useState(false)
  const [flash, setFlash] = useState<'l' | 'r' | null>(null)
  const x0 = useRef(0)
  const fire = (s: 'l' | 'r') => {
    if (s === 'l') onL?.(); else onR()
    setFlash(s)
    setTimeout(() => setFlash(null), 260)
  }
  const TH = 46
  const end = () => {
    if (!drag) return
    if (dx <= -TH && !noLeft) fire('l')
    else if (dx >= TH) fire('r')
    setDx(0); setDrag(false)
  }
  return (
    <div className="rowbtn">
      {noLeft ? <span /> : (
        <button className={`side l ${lcls} ${flash === 'l' ? 'flash' : ''}`} onClick={() => fire('l')}>
          <small>◀</small>{lv != null && <span>{lv}</span>}<span style={{ fontSize: 16 }}>{left}</span>
        </button>
      )}
      <div className="midwrap">
        {!noLeft && <span className="arrow l" />}
        <div
          className={`mid ${drag ? 'dragging' : ''}`}
          style={{ transform: `translateX(${dx}px)` }}
          onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ok */ } x0.current = e.clientX; setDrag(true) }}
          onPointerMove={(e) => { if (drag) setDx(Math.max(noLeft ? 0 : -90, Math.min(90, e.clientX - x0.current))) }}
          onPointerUp={end}
          onPointerCancel={() => { setDx(0); setDrag(false) }}
        >{mid}</div>
        <span className="arrow r" />
      </div>
      <button className={`side r ${rcls} ${flash === 'r' ? 'flash' : ''}`} onClick={() => fire('r')}>
        <span style={{ fontSize: 16 }}>{right}</span>{rv != null && <span>{rv}</span>}<small>▶</small>
      </button>
    </div>
  )
}

export default function Recorder({ id }: { id: string }) {
  const game = useStore((s) => s.games.find((g) => g.id === id))
  const { players, seasons, clubName, pushEvent, undo, updateGame } = useStore()
  const [sel, setSel] = useState('')
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [drawer, setDrawer] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [redo, setRedo] = useState<GameEvent[]>([])

  // pagina unica: niente scroll né rimbalzo della pagina mentre si registra
  useEffect(() => {
    document.documentElement.classList.add('no-scroll')
    return () => document.documentElement.classList.remove('no-scroll')
  }, [])

  const season = seasons.find((s) => s.id === game?.seasonId)
  const gs = useMemo(() => (game ? computeGame(game) : null), [game])
  const gq = useMemo(() => (game ? computeGame(game, game.quarter) : null), [game])
  if (!game || !gs || !gq || !season) return <div className="page">Partita non trovata</div>

  const numberOf = (pid: string) => season.roster.find((r) => r.playerId === pid)?.number ?? 0
  const playerOf = (pid?: string) => players.find((p) => p.id === pid)
  const nameOf = (pid?: string) => shortName(playerOf(pid))
  const onCourt = [...gs.onCourt].sort((a, b) => numberOf(a) - numberOf(b))
  const bench = [...season.roster].filter((r) => (!game.called || game.called.includes(r.playerId)) && !gs.onCourt.includes(r.playerId)).sort((a, b) => a.number - b.number)
  const cur = onCourt.includes(sel) ? sel : onCourt[0]
  const s = gs.players[cur]
  const sq = gq.players[cur]
  const q = game.quarter

  const rec = (e: Omit<GameEvent, 'id' | 'q'>) => { pushEvent(game.id, { q, ...e }); setRedo([]) }
  const recP = (e: Omit<GameEvent, 'id' | 'q' | 'playerId'>) => rec({ playerId: cur, ...e })
  const last = game.events[game.events.length - 1]

  const doUndo = () => {
    if (!last) return
    if (last.type === 'qend') setRedo([])
    else setRedo((r) => [...r, last])
    undo(game.id)
  }
  const doRedo = () => {
    const e = redo[redo.length - 1]
    if (!e) return
    const { id: _id, ...rest } = e
    void _id
    pushEvent(game.id, rest)
    setRedo((r) => r.slice(0, -1))
  }

  const shot = (made: boolean) => {
    if (!pt) return
    recP({ type: 'shot', made, pts: isThree(pt.x, pt.y) ? 3 : 2, x: pt.x, y: pt.y })
    setPt(null)
  }

  const fl = (n: number) => (n >= 5 ? 'r' : n >= 4 ? 'w' : '')
  const endQuarter = () => {
    if (!confirm(`Chiudere ${qLabel(q)}?`)) return
    pushEvent(game.id, { q, type: 'qend' })
    setRedo([])
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

  const courtShots = game.events.filter((e) => e.type === 'shot' && e.x != null && (showAll || e.playerId === cur))
  const close = () => setPanel(null)
  const team = (e: Omit<GameEvent, 'id' | 'q'>) => { rec(e); close() }

  return (
    <div className="rec">
      <div className="rec-top">
        <button className="rec-back" onClick={() => go(`/games/${game.id}`)}>←</button>
        <div className="scoreboard">
          <div className="team"><div className="nm">{clubName}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`fl ${gq.foulsUs[q] >= 4 ? 'bonus' : ''}`}>{gq.foulsUs[q]} Falli</span><span className="pts">{gs.us}</span>
            </div></div>
          <span className="qbadge">{qLabel(q)}</span>
          <div className="team"><div className="nm">{game.opponent}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="pts">{gs.opp}</span><span className={`fl ${gq.foulsOpp[q] >= 4 ? 'bonus' : ''}`}>Falli {gq.foulsOpp[q]}</span>
            </div></div>
        </div>
        <button className="endq" onClick={endQuarter}>Fine {qLabel(q)}</button>
      </div>

      <div className="rec-body">
        {/* sinistra: in campo */}
        <div className="col">
          {onCourt.map((pid) => {
            const st = gs.players[pid]
            const sqp = gq.players[pid]
            return (
              <button key={pid} className={`pcard ${cur === pid ? 'sel' : ''}`} onClick={() => setSel(pid)}>
                <Avatar photo={playerOf(pid)?.photo} size={54} />
                <span>
                  <div className="nm"><span className="nn2">{numberOf(pid)}</span> {nameOf(pid)}</div>
                  <div className="pt">{st.pts} Pt · {sqp?.pts ?? 0} nel Q</div>
                </span>
                <span className="fouls">Falli<b className={fl(st.f)}>{st.f}</b></span>
              </button>
            )
          })}
          <div className="btnrow" style={{ flex: 'none' }}>
            <button className="dark" onClick={() => setPanel('subs')}>Cambi</button>
            <button className="dark deep" onClick={() => setPanel('stats')}>Statistiche</button>
            <button className="dark deep" onClick={() => setPanel('bench')}>Panchina</button>
          </div>
        </div>

        {/* centro: giocatore selezionato */}
        <div className="col">
          <div className="phead">
            <span className="badge">{numberOf(cur)}</span>
            <span className="nm">{playerOf(cur)?.last}</span>
            <span className="pp"><b>{s.pts}</b>PUNTI<br />{sq?.pts ?? 0} nel quarto<br />VAL {s.val}</span>
          </div>
          <div className="pmid">
            <Avatar photo={playerOf(cur)?.photo} size={112} />
            <div className="shoot">
              <div className="r">2P<span className="v">{s.m2}/{s.a2}</span><span className="p">{pct(s.m2, s.a2)}</span></div>
              <div className="r">3P<span className="v">{s.m3}/{s.a3}</span><span className="p">{pct(s.m3, s.a3)}</span></div>
              <div className="r">TL<span className="v">{s.mf}/{s.af}</span><span className="p">{pct(s.mf, s.af)}</span></div>
            </div>
          </div>
          <div className="panel partials">
            <table>
              <thead><tr><th>Parziali</th>{Array.from({ length: Math.max(4, q) }, (_, i) => <th key={i}>{qLabel(i + 1)}</th>)}</tr></thead>
              <tbody>
                <tr><td>{clubName}</td>{Array.from({ length: Math.max(4, q) }, (_, i) => <td key={i} style={{ color: 'var(--brand)' }}>{gs.perQ.us[i + 1]}</td>)}</tr>
                <tr><td>{game.opponent}</td>{Array.from({ length: Math.max(4, q) }, (_, i) => <td key={i}>{gs.perQ.opp[i + 1]}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <DragRow mid="Timeout" left="Avv" right="Noi" lv={gq.timeoutsOpp} rv={gq.timeoutsUs}
            onL={() => rec({ type: 'timeout', side: 'opp' })} onR={() => rec({ type: 'timeout', side: 'us' })} />
          <button className="bigbtn" onClick={() => setPanel('team')}>
            <b>Squadra</b><span>Palle perse, falli e rimbalzi senza giocatore</span>
          </button>
          <button className="bigbtn" onClick={() => setPanel('oppreb')}>
            <b>Rimbalzi avversari</b><span><i className="neg">{gq.oppRo} Off</i> · <i>{gq.oppRd} Dif</i></span>
          </button>
          <div className="undo-row">
            <button className="undo" disabled={redo.length === 0} onClick={doRedo}>
              <small>↷ RIPETI</small>
              <div>{redo.length ? eventLabel(redo[redo.length - 1]) : 'Niente da ripetere'}</div>
            </button>
            <button className="undo" disabled={!last} onClick={doUndo}>
              <small>↶ ANNULLA</small>
              <div>{last ? `${last.playerId ? nameOf(last.playerId) + ' · ' : ''}${eventLabel(last)}` : 'Niente da annullare'}</div>
            </button>
          </div>
        </div>

        {/* destra: campo e azioni */}
        <div className="col">
          <div className="court-row">
            <div className="shot-btns">
              <button className="made" onClick={() => recP({ type: 'ft', made: true })}>
                <span>▲</span><b>{s.mf}</b><span>TL<br />segnato</span>
              </button>
              <button className="miss" onClick={() => recP({ type: 'ft', made: false })}>
                <span>TL<br />sbagliato</span><b>{s.af - s.mf}</b><span>▼</span>
              </button>
            </div>
            <div>
              <Court onTap={(x, y) => setPt({ x, y })}>
                {courtShots.map((e) => (
                  <ShotDot key={e.id} x={e.x!} y={e.y!} made={!!e.made} r={0.3} label={showAll ? String(numberOf(e.playerId ?? '')) : undefined} />
                ))}
                {pt && <g><circle cx={pt.x} cy={pt.y} r={0.45} fill="none" stroke="#2a1f1a" strokeWidth={0.12} /><circle cx={pt.x} cy={pt.y} r={0.1} fill="#2a1f1a" /></g>}
              </Court>
              <div className="hintline" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Tocca il campo dove ha tirato</span>
                <button className={`chip-btn ${showAll ? 'on' : ''}`} onClick={() => setShowAll(!showAll)}>{showAll ? 'Tutta la squadra' : 'Solo ' + (playerOf(cur)?.last ?? '')}</button>
              </div>
            </div>
          </div>
          <div className="section-title" style={{ margin: '2px 0 0', fontSize: 13 }}>Punti avversario</div>
          <div className="opp-pts">
            {[1, 2, 3].map((n) => <button key={n} onClick={() => rec({ type: 'oppPts', pts: n })}>+{n}</button>)}
          </div>
          <DragRow mid="Rimbalzo" left="Off" right="Dif" lv={s.ro} rv={s.rd} lcls="pos" rcls="pos"
            onL={() => recP({ type: 'reb', kind: 'off' })} onR={() => recP({ type: 'reb', kind: 'def' })} />
          <DragRow mid="Palla" left="Persa" right="Rec" lv={s.pp} rv={s.rec} lcls="neg" rcls="pos"
            onL={() => recP({ type: 'steal', kind: 'lost' })} onR={() => recP({ type: 'steal', kind: 'rec' })} />
          <DragRow mid="Fallo" left="Fatto" right="Subito" lv={s.f} rv={s.fs} lcls="neg" rcls="pos"
            onL={() => recP({ type: 'foul', kind: 'made' })} onR={() => recP({ type: 'foul', kind: 'drawn' })} />
          <DragRow mid="Assist" right="Dato" rv={s.ass} rcls="pos" noLeft onR={() => recP({ type: 'assist' })} />
          <DragRow mid="Stoppata" left="Presa" right="Fatta" lv={s.ss} rv={s.sm} lcls="neg" rcls="pos"
            onL={() => recP({ type: 'block', kind: 'suffered' })} onR={() => recP({ type: 'block', kind: 'made' })} />
        </div>
      </div>

      <button className="ev-strip" onClick={() => setDrawer(true)}><span>‹</span><span className="v">EVENTI</span></button>
      {drawer && (
        <>
          <div className="drawer-back" onClick={() => setDrawer(false)} />
          <div className="ev-drawer">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ fontSize: 28 }}>Azioni {qLabel(q)}</h2>
              <button className="round" style={{ width: 44, height: 44 }} onClick={() => setDrawer(false)}>✕</button>
            </div>
            <EventList game={game} quarter={q} compact />
          </div>
        </>
      )}

      {pt && (
        <Modal title={`Tiro da ${isThree(pt.x, pt.y) ? '3' : '2'} · ${numberOf(cur)} ${nameOf(cur)}`} onClose={() => setPt(null)}>
          <div className="choice">
            <button className="made" onClick={() => shot(true)}>▲ Segnato</button>
            <button className="miss" onClick={() => shot(false)}>▼ Sbagliato</button>
          </div>
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => setPt(null)}>Annulla</button>
        </Modal>
      )}

      {panel === 'team' && (
        <Modal title="Squadra" onClose={close}>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>Azioni della squadra non attribuite a un giocatore.</p>
          <div className="choice grid">
            <button className="miss" onClick={() => team({ type: 'steal', kind: 'lost' })}>Palla persa<b>{gq.team.pp}</b></button>
            <button className="made" onClick={() => team({ type: 'steal', kind: 'rec' })}>Palla recuperata<b>{gq.team.rec}</b></button>
            <button className="miss" onClick={() => team({ type: 'foul', kind: 'made' })}>Fallo fatto<b>{gq.team.f}</b></button>
            <button className="made" onClick={() => team({ type: 'reb', kind: 'off' })}>Rimbalzo off.<b>{gq.team.ro}</b></button>
            <button className="made" onClick={() => team({ type: 'reb', kind: 'def' })}>Rimbalzo dif.<b>{gq.team.rd}</b></button>
          </div>
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={close}>Chiudi</button>
        </Modal>
      )}
      {panel === 'oppreb' && (
        <Modal title="Rimbalzo avversario" onClose={close}>
          <div className="choice">
            <button className="miss" onClick={() => team({ type: 'reb', side: 'opp', kind: 'off' })}>Offensivo<b>{gq.oppRo}</b></button>
            <button className="made" onClick={() => team({ type: 'reb', side: 'opp', kind: 'def' })}>Difensivo<b>{gq.oppRd}</b></button>
          </div>
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={close}>Chiudi</button>
        </Modal>
      )}
      {panel === 'bench' && (
        <Modal title="Panchina" onClose={close}>
          <div className="card list">
            {bench.length === 0 && <div className="empty">Tutti in campo.</div>}
            <div className="bench-head"><span /><span>Giocatore</span><span>Pt</span><span>Falli</span><span>Min</span></div>
            {bench.map((r) => {
              const st = gs.players[r.playerId]
              return (
                <div key={r.playerId} className="bench-row">
                  <Avatar photo={playerOf(r.playerId)?.photo} size={44} />
                  <span><b className="nn2">{r.number}</b> {nameOf(r.playerId)}</span>
                  <b>{st?.pts ?? 0}</b>
                  <b className={fl(st?.f ?? 0)} style={{ color: (st?.f ?? 0) >= 5 ? 'var(--red)' : (st?.f ?? 0) >= 4 ? '#d98a00' : undefined }}>{st?.f ?? 0}</b>
                  <span style={{ color: 'var(--muted)' }}>{fmtTime(st?.min ?? 0)}</span>
                </div>
              )
            })}
          </div>
          <button className="btn ghost block" style={{ marginTop: 12 }} onClick={close}>Chiudi</button>
        </Modal>
      )}
      {panel === 'subs' && <Subs game={game} gs={gs} onClose={close} onDone={() => setRedo([])} />}
      {panel === 'stats' && (
        <div className="overlay">
          <div className="top-nav">
            <h1>Statistiche</h1>
            <button className="btn" onClick={close}>✕ Torna al registratore</button>
          </div>
          <div className="page"><GameStatsBody game={game} live /></div>
        </div>
      )}
    </div>
  )
}

/** Pulsante che si ripete tenendolo premuto. */
function Hold({ onStep, children }: { onStep: () => void; children: ReactNode }) {
  const t = useRef<ReturnType<typeof setTimeout>>()
  const iv = useRef<ReturnType<typeof setInterval>>()
  const stop = () => { clearTimeout(t.current); clearInterval(iv.current) }
  return (
    <button
      className="btn"
      style={{ fontSize: 26, padding: '22px 0' }}
      onPointerDown={(e) => { e.preventDefault(); onStep(); t.current = setTimeout(() => { iv.current = setInterval(onStep, 90) }, 450) }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
    >{children}</button>
  )
}

function Subs({ game, gs, onClose, onDone }: { game: Game; gs: ReturnType<typeof computeGame>; onClose: () => void; onDone: () => void }) {
  const { seasons, players, pushEvent } = useStore()
  const season = seasons.find((s) => s.id === game.seasonId)!
  const q = game.quarter
  const L = game.quarterLength
  const lastSub = [...game.events].reverse().find((e) => e.q === q && e.type === 'sub')
  const [remaining, setRemaining] = useState(lastSub?.remaining ?? L)
  const [outSel, setOutSel] = useState<string[]>([])
  const [inSel, setInSel] = useState<string[]>([])
  const roster = [...season.roster].filter((r) => !game.called || game.called.includes(r.playerId) || gs.onCourt.includes(r.playerId)).sort((a, b) => a.number - b.number)
  const onIds = roster.filter((r) => gs.onCourt.includes(r.playerId))
  const offIds = roster.filter((r) => !gs.onCourt.includes(r.playerId))
  const adj = (d: number) => setRemaining((r) => Math.min(L, Math.max(0, r + d)))
  const tog = (arr: string[], set: (a: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  const ok = outSel.length > 0 && outSel.length === inSel.length
  const save = () => {
    pushEvent(game.id, { q, type: 'sub', remaining, out: outSel, in: inSel })
    onDone()
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
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>TEMPO RIMANENTE NEL PERIODO ({qLabel(q)}) · passo di 5 secondi, tieni premuto per scorrere</div>
          <div className="clock">{fmtTime(remaining)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Hold onStep={() => adj(5)}>+5s</Hold>
            <Hold onStep={() => adj(-5)}>−5s</Hold>
          </div>
        </div>
        <div className="sub-lists">
          <List title="In campo" items={onIds} sel={outSel} set={setOutSel} />
          <List title="Fuori" items={offIds} sel={inSel} set={setInSel} />
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Tocca chi esce e chi entra (stesso numero di giocatori), poi salva. Il tempo serve a calcolare minuti e +/-.</div>
        <div className="sub-lists">
          <button className="btn ghost" onClick={onClose}>Annulla</button>
          <button className="btn" disabled={!ok} onClick={save}>Salva cambio</button>
        </div>
      </div>
    </div>
  )
}
