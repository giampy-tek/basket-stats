import type { Game, PStat } from './types'

const blank = (playerId: string): PStat => ({
  playerId, pts: 0, min: 0, m2: 0, a2: 0, m3: 0, a3: 0, mf: 0, af: 0,
  f: 0, fs: 0, ro: 0, rd: 0, rec: 0, pp: 0, ass: 0, sm: 0, ss: 0, pm: 0, val: 0,
})

export interface GameStats {
  players: Record<string, PStat>
  team: PStat // riga "Squadra": eventi senza giocatore
  total: PStat
  us: number
  opp: number
  perQ: { us: number[]; opp: number[] }
  foulsUs: number[] // per quarto (indice 1..)
  foulsOpp: number[]
  timeoutsUs: number
  timeoutsOpp: number
  oppRo: number
  oppRd: number
  onCourt: string[]
}

export const rt = (s: PStat) => s.ro + s.rd
export const calcVal = (s: PStat) =>
  s.pts + rt(s) + s.rec + s.ass + s.sm + s.fs -
  (s.a2 - s.m2) - (s.a3 - s.m3) - (s.af - s.mf) - s.pp - s.ss - s.f

/** q = 0 -> tutta la partita, altrimenti solo quel quarto */
export function computeGame(game: Game, q = 0): GameStats {
  const players: Record<string, PStat> = {}
  const get = (id: string) => (players[id] ??= blank(id))
  const team = blank('team')
  const perQ = { us: [0, 0, 0, 0, 0, 0, 0, 0], opp: [0, 0, 0, 0, 0, 0, 0, 0] }
  const foulsUs = [0, 0, 0, 0, 0, 0, 0, 0]
  const foulsOpp = [0, 0, 0, 0, 0, 0, 0, 0]
  let timeoutsUs = 0
  let timeoutsOpp = 0
  let oppRo = 0
  let oppRd = 0
  const L = game.quarterLength
  const onCourt = new Set(game.starters)
  const entered: Record<string, number> = {}
  game.starters.forEach((p) => (entered[p] = 0))
  game.starters.forEach(get)

  const credit = (p: string, abs: number, evQ: number) => {
    const d = Math.max(0, abs - (entered[p] ?? 0))
    if (q === 0 || q === evQ) get(p).min += d
    entered[p] = abs
  }
  const inScope = (evQ: number) => q === 0 || q === evQ
  const addPm = (v: number, evQ: number) => {
    if (!inScope(evQ)) return
    onCourt.forEach((p) => (get(p).pm += v))
  }

  for (const e of game.events) {
    const S = e.playerId ? get(e.playerId) : team
    const sc = inScope(e.q)
    switch (e.type) {
      case 'sub': {
        const abs = (e.q - 1) * L + (L - (e.remaining ?? L))
        e.out?.forEach((p) => { credit(p, abs, e.q); onCourt.delete(p) })
        e.in?.forEach((p) => { get(p); onCourt.add(p); entered[p] = abs })
        break
      }
      case 'qend': {
        const abs = e.q * L
        onCourt.forEach((p) => credit(p, abs, e.q))
        break
      }
      case 'shot': {
        const three = e.pts === 3
        if (e.made) { perQ.us[e.q] += e.pts ?? 2; addPm(e.pts ?? 2, e.q) }
        if (!sc) break
        if (three) { S.a3++; if (e.made) { S.m3++; S.pts += 3 } }
        else { S.a2++; if (e.made) { S.m2++; S.pts += 2 } }
        break
      }
      case 'ft':
        if (e.made) { perQ.us[e.q] += 1; addPm(1, e.q) }
        if (!sc) break
        S.af++
        if (e.made) { S.mf++; S.pts += 1 }
        break
      case 'oppPts':
        perQ.opp[e.q] += e.pts ?? 0
        addPm(-(e.pts ?? 0), e.q)
        break
      case 'reb':
        if (e.side === 'opp') { if (sc) { if (e.kind === 'off') oppRo++; else oppRd++ } break }
        if (sc) { if (e.kind === 'off') S.ro++; else S.rd++ }
        break
      case 'steal': if (sc) { if (e.kind === 'rec') S.rec++; else S.pp++ } break
      case 'foul':
        if (e.kind === 'made') foulsUs[e.q]++
        else foulsOpp[e.q]++
        if (sc) { if (e.kind === 'made') S.f++; else S.fs++ }
        break
      case 'assist': if (sc) S.ass++; break
      case 'block': if (sc) { if (e.kind === 'made') S.sm++; else S.ss++ } break
      case 'timeout':
        if (sc) { if (e.side === 'opp') timeoutsOpp++; else timeoutsUs++ }
        break
    }
  }

  const total = blank('total')
  const keys = ['pts','min','m2','a2','m3','a3','mf','af','f','fs','ro','rd','rec','pp','ass','sm','ss'] as const
  for (const s of [...Object.values(players), team]) for (const k of keys) total[k] += s[k]
  for (const s of Object.values(players)) s.val = calcVal(s)
  team.val = 0
  const us = q === 0 ? perQ.us.reduce((a, b) => a + b, 0) : perQ.us[q]
  const opp = q === 0 ? perQ.opp.reduce((a, b) => a + b, 0) : perQ.opp[q]
  total.pm = us - opp
  total.val = Object.values(players).reduce((a, s) => a + s.val, 0)
  return { players, team, total, us, opp, perQ, foulsUs, foulsOpp, timeoutsUs, timeoutsOpp, oppRo, oppRd, onCourt: [...onCourt] }
}

export function addStat(a: PStat, b: PStat) {
  for (const k of Object.keys(a) as (keyof PStat)[]) {
    if (k !== 'playerId') (a[k] as number) += b[k] as number
  }
}

export interface SeasonAgg {
  stat: PStat
  games: number
}

export function computeSeason(games: Game[]) {
  const agg: Record<string, SeasonAgg> = {}
  const total = blank('total')
  let oppPts = 0
  let usPts = 0
  const done = games.filter((g) => g.status === 'done')
  for (const g of done) {
    const gs = computeGame(g)
    oppPts += gs.opp
    usPts += gs.us
    for (const [id, s] of Object.entries(gs.players)) {
      const a = (agg[id] ??= { stat: blank(id), games: 0 })
      addStat(a.stat, s)
      if (s.min > 0 || s.pts > 0 || s.a2 + s.a3 + s.af > 0) a.games++
    }
    addStat(total, gs.total)
  }
  return { agg, total, games: done.length, oppPts, usPts }
}

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function pct(m: number, a: number, digits = 0) {
  return a === 0 ? '–' : `${((m / a) * 100).toFixed(digits)}%`
}

import type { GameEvent } from './types'
import { zoneOf, type Zone } from './court'

export type ZoneCount = Record<Zone, { m: number; a: number }>
const emptyZones = (): ZoneCount => ({ campana: { m: 0, a: 0 }, media: { m: 0, a: 0 }, da3: { m: 0, a: 0 } })

/** Tiri per zona (campana / media / da 3), totale squadra e per giocatore. */
export function zoneTotals(events: GameEvent[]) {
  const team = emptyZones()
  const players: Record<string, ZoneCount> = {}
  for (const e of events) {
    if (e.type !== 'shot' || e.x == null || e.y == null) continue
    const z = zoneOf(e.x, e.y)
    team[z].a++
    if (e.made) team[z].m++
    if (e.playerId) {
      const pz = (players[e.playerId] ??= emptyZones())
      pz[z].a++
      if (e.made) pz[z].m++
    }
  }
  return { team, players }
}
