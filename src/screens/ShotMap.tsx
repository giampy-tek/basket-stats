import { useState } from 'react'
import { useStore } from '../store'
import { Court, ShotDot } from '../ui'
import { COURT_W, COURT_L, CORNER_X, CORNER_Y, HOOP, PAINT, R3, FRONT_ANGLE, zoneDetail, type Zone9 } from '../court'
import { pct } from '../stats'

const A = (FRONT_ANGLE * Math.PI) / 180
const yArc = (x: number) => HOOP.y + Math.sqrt(R3 * R3 - (x - HOOP.x) ** 2)
const PL = [HOOP.x - R3 * Math.sin(A), HOOP.y + R3 * Math.cos(A)]
const PR = [HOOP.x + R3 * Math.sin(A), HOOP.y + R3 * Math.cos(A)]
const rayX = HOOP.x - Math.tan(A) * (COURT_L - HOOP.y)
const f = (n: number) => n.toFixed(3)
const R = `${R3} ${R3} 0 0`

const ZONES: { id: Zone9; name: string; path: string; lx: number; ly: number }[] = [
  { id: 'campSx', name: 'Campana sinistra', path: `M${PAINT.x1} 0H${HOOP.x}V${PAINT.y2}H${PAINT.x1}Z`, lx: 6.3, ly: 3.2 },
  { id: 'campDx', name: 'Campana destra', path: `M${HOOP.x} 0H${PAINT.x2}V${PAINT.y2}H${HOOP.x}Z`, lx: 8.7, ly: 3.2 },
  { id: 'medSx', name: 'Media sinistra', path: `M${CORNER_X} 0H${PAINT.x1}V${f(yArc(PAINT.x1))}A${R} 1 ${CORNER_X} ${f(CORNER_Y)}Z`, lx: 3.0, ly: 3.6 },
  { id: 'medC', name: 'Media centrale', path: `M${PAINT.x1} ${PAINT.y2}H${PAINT.x2}V${f(yArc(PAINT.x2))}A${R} 1 ${PAINT.x1} ${f(yArc(PAINT.x1))}Z`, lx: 7.5, ly: 6.95 },
  { id: 'medDx', name: 'Media destra', path: `M${COURT_W - CORNER_X} 0H${PAINT.x2}V${f(yArc(PAINT.x2))}A${R} 0 ${COURT_W - CORNER_X} ${f(CORNER_Y)}Z`, lx: 12.0, ly: 3.6 },
  { id: 'angSx', name: 'Angolo sinistro', path: `M0 0H${CORNER_X}V${f(CORNER_Y)}H0Z`, lx: 0.45, ly: 1.5 },
  { id: 'angDx', name: 'Angolo destro', path: `M${COURT_W} 0H${COURT_W - CORNER_X}V${f(CORNER_Y)}H${COURT_W}Z`, lx: 14.55, ly: 1.5 },
  { id: 'alaSx', name: 'Ala sinistra', path: `M0 ${f(CORNER_Y)}H${CORNER_X}A${R} 0 ${f(PL[0])} ${f(PL[1])}L${f(rayX)} ${COURT_L}H0Z`, lx: 2.3, ly: 9.6 },
  { id: 'alaDx', name: 'Ala destra', path: `M${COURT_W} ${f(CORNER_Y)}H${COURT_W - CORNER_X}A${R} 1 ${f(PR[0])} ${f(PR[1])}L${f(COURT_W - rayX)} ${COURT_L}H${COURT_W}Z`, lx: 12.7, ly: 9.6 },
  { id: 'front', name: 'Frontale', path: `M${f(PL[0])} ${f(PL[1])}A${R} 0 ${f(PR[0])} ${f(PR[1])}L${f(COURT_W - rayX)} ${COURT_L}H${f(rayX)}Z`, lx: 7.5, ly: 11.6 },
]

const STOPS: [number, number[]][] = [[0.3, [75, 121, 183]], [0.375, [169, 191, 221]], [0.45, [236, 227, 215]], [0.525, [242, 164, 92]], [0.6, [181, 68, 12]]]
function heat(p: number) {
  if (p <= STOPS[0][0]) return `rgb(${STOPS[0][1]})`
  for (let i = 1; i < STOPS.length; i++) {
    if (p <= STOPS[i][0]) {
      const [p0, c0] = STOPS[i - 1]; const [p1, c1] = STOPS[i]
      const t = (p - p0) / (p1 - p0)
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * t))})`
    }
  }
  return `rgb(${STOPS[STOPS.length - 1][1]})`
}

export default function ShotMap() {
  const { games, seasons, seasonId, players } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const [who, setWho] = useState('all')
  const [period, setPeriod] = useState(0)
  const [outcome, setOutcome] = useState<'all' | 'made' | 'miss'>('all')
  const [view, setView] = useState<'zone' | 'dots'>('zone')
  if (!season) return <div className="page">Nessuna stagione</div>

  const seasonGames = games.filter((g) => g.seasonId === seasonId && g.events.some((e) => e.type === 'shot'))
  const all = seasonGames.flatMap((g) => g.events).filter((e) => e.type === 'shot' && e.x != null && e.y != null)
  const base = all.filter((e) => (who === 'all' || e.playerId === who) && (period === 0 || e.q === period))
  const zones = Object.fromEntries(ZONES.map((z) => [z.id, { m: 0, a: 0 }])) as Record<Zone9, { m: number; a: number }>
  for (const e of base) { const z = zoneDetail(e.x!, e.y!); zones[z].a++; if (e.made) zones[z].m++ }
  const shown = base.filter((e) => outcome === 'all' || (outcome === 'made') === !!e.made)
  const made = base.filter((e) => e.made).length
  const roster = [...season.roster].sort((a, b) => a.number - b.number)
  const nameOf = (id: string) => { const p = players.find((x) => x.id === id); return p ? `${p.first[0]}. ${p.last}` : '?' }

  return (
    <>
      <div className="top-nav">
        <button className="round" onClick={() => history.back()}>‹</button>
        <h1>Mappa di tiro</h1><span style={{ width: 54 }} />
      </div>
      <div className="page" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card pad">
          <div className="section-title" style={{ margin: '0 0 8px' }}>Chi</div>
          <div className="chips">
            <button className={who === 'all' ? 'on' : ''} onClick={() => setWho('all')}>Squadra</button>
            {roster.map((r) => <button key={r.playerId} className={who === r.playerId ? 'on' : ''} onClick={() => setWho(r.playerId)}>{nameOf(r.playerId)}</button>)}
          </div>
          <div className="section-title" style={{ margin: '16px 0 8px' }}>Periodo</div>
          <div className="chips">
            {[0, 1, 2, 3, 4].map((q) => <button key={q} className={period === q ? 'on' : ''} onClick={() => setPeriod(q)}>{q === 0 ? 'Tutti' : `${q}°`}</button>)}
          </div>
          <div className="section-title" style={{ margin: '16px 0 8px', opacity: view === 'dots' ? 1 : 0.4 }}>Esito · vista a punti</div>
          <div className="chips" style={{ opacity: view === 'dots' ? 1 : 0.4 }}>
            {([['all', 'Tutti'], ['made', 'Segnati'], ['miss', 'Sbagliati']] as const).map(([k, l]) => <button key={k} className={outcome === k ? 'on' : ''} onClick={() => setOutcome(k)}>{l}</button>)}
          </div>
        </div>
        <div className="card pad">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.08em' }}>{season.year} {season.category.toUpperCase()}</div>
              <h2 style={{ fontSize: 30 }}>{who === 'all' ? 'Squadra' : nameOf(who)}</h2>
              <div style={{ color: 'var(--muted)' }}>{base.length} tiri dal campo · {made} segnati · {pct(made, base.length)} · {seasonGames.length} partite</div>
            </div>
            <div className="seg light" style={{ background: 'var(--cream)' }}>
              <button className={view === 'zone' ? 'on' : ''} onClick={() => setView('zone')}>Zone</button>
              <button className={view === 'dots' ? 'on' : ''} onClick={() => setView('dots')}>Punti</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, marginTop: 14, alignItems: 'start' }}>
            <Court plain under={view === 'zone' ? (
              <g>
                <defs>
                  <pattern id="hatch" width="0.4" height="0.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="0.4" height="0.4" fill="#ece5da" /><line x1="0" y1="0" x2="0" y2="0.4" stroke="#fff" strokeWidth="0.12" />
                  </pattern>
                </defs>
                {ZONES.map((z) => <path key={z.id} d={z.path} fill={zones[z.id].a < 3 ? 'url(#hatch)' : heat(zones[z.id].m / zones[z.id].a)} />)}
              </g>
            ) : undefined}>
              {view === 'zone' && ZONES.map((z) => {
                const c = zones[z.id]
                const p = c.a ? c.m / c.a : 0
                const light = c.a >= 3 && (p < 0.34 || p > 0.56)
                const small = z.id === 'angSx' || z.id === 'angDx'
                const fill = light ? '#fff' : '#2a1f1a'
                return (
                  <g key={z.id} textAnchor="middle" fontWeight={700} fill={fill} style={{ pointerEvents: 'none' }}>
                    <text x={z.lx} y={z.ly} fontSize={small ? 0.5 : 0.8} dominantBaseline="central">{c.a < 3 && c.a === 0 ? '–' : pct(c.m, c.a)}</text>
                    <text x={z.lx} y={z.ly + (small ? 0.55 : 0.85)} fontSize={small ? 0.38 : 0.55} fontWeight={500} dominantBaseline="central">{c.m}/{c.a}</text>
                  </g>
                )
              })}
              {view === 'dots' && shown.map((e) => <ShotDot key={e.id} x={e.x!} y={e.y!} made={!!e.made} r={0.26} />)}
            </Court>
            <div>
              <div className="tablewrap">
                <table className="stats">
                  <thead><tr><th>Zona</th><th>S/T</th><th>%</th></tr></thead>
                  <tbody>
                    {ZONES.map((z) => (
                      <tr key={z.id}><td>{z.name}</td><td>{zones[z.id].m}/{zones[z.id].a}</td><td>{pct(zones[z.id].m, zones[z.id].a)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 12 }}>Meno di 3 tiri: zona grigia. Destra e sinistra dal punto di vista di chi tira, rivolto al canestro.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
