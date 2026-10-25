import type { Game, PStat } from './types'

const blank = (playerId: string): PStat => ({
  playerId, pts: 0, min: 0, m2: 0, a2: 0, m3: 0, a3: 0, mf: 0, af: 0,
  f: 0, fs: 0, ro: 0, rd: 0, rec: 0, pp: 0, ass: 0, sm: 0, ss: 0, pm: 0, val: 0, pir: 0,
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
/** Valutazione FIBA: punti - tiri sbagliati + rimbalzi + assist - palle perse + recuperi + stoppate date */
export const calcVal = (s: PStat) =>
  s.pts + rt(s) + s.rec + s.ass + s.sm - (s.a2 - s.m2) - (s.a3 - s.m3) - (s.af - s.mf) - s.pp
/** PIR (indice FIP): valutazione FIBA + falli subiti - falli commessi - stoppate subite */
export const calcPir = (s: PStat) => calcVal(s) + s.fs - s.f - s.ss

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

  if (game.imported) {
    // partita importata: minuti e +/- vengono dal file, non dai cambi
    const pick = (arr?: number[]) => (arr ? (q === 0 ? arr.reduce((a, b) => a + (b || 0), 0) : arr[q] || 0) : 0)
    for (const [pid, arr] of Object.entries(game.imported.min)) get(pid).min = pick(arr)
    for (const [pid, arr] of Object.entries(game.imported.pm)) get(pid).pm = pick(arr)
  }

  const total = blank('total')
  const keys = ['pts','min','m2','a2','m3','a3','mf','af','f','fs','ro','rd','rec','pp','ass','sm','ss'] as const
  for (const s of [...Object.values(players), team]) for (const k of keys) total[k] += s[k]
  for (const s of Object.values(players)) { s.val = calcVal(s); s.pir = calcPir(s) }
  team.val = 0
  const us = q === 0 ? perQ.us.reduce((a, b) => a + b, 0) : perQ.us[q]
  const opp = q === 0 ? perQ.opp.reduce((a, b) => a + b, 0) : perQ.opp[q]
  total.pm = us - opp
  total.val = calcVal(total)
  total.pir = calcPir(total)
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
  const team = blank('team')
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
    addStat(team, gs.team)
  }
  return { agg, total, team, games: done.length, oppPts, usPts }
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
    if (e.type !== 'shot') continue
    const z = e.x != null && e.y != null ? zoneOf(e.x, e.y) : e.zone
    if (!z) continue
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

export interface Trend {
  ties: number // quante volte il punteggio è tornato in parità
  leadChanges: number
  maxLeadUs: number
  maxLeadOpp: number
  runUs: number // parziale più lungo (punti consecutivi senza risposta)
  runOpp: number
  bench: number // punti dei giocatori che non erano nel quintetto base
  timeoutsUs: number
  timeoutsOpp: number
  foulsUs: number
  foulsOpp: number
  bonusUs: boolean // siamo in bonus: gli avversari hanno 4+ falli di squadra nel periodo
  bonusOpp: boolean
  sequenceKnown: boolean // false per le partite importate: l'ordine dei canestri non è quello reale
}

/** Andamento di una partita (q = 0) o di un periodo. Il punteggio riparte da 0-0 a ogni periodo. */
export function computeTrend(game: Game, q = 0): Trend {
  const gs = computeGame(game, q)
  const starters = new Set(game.starters)
  let us = 0, opp = 0, ties = 0, lead = 0, leadChanges = 0, maxUs = 0, maxOpp = 0
  let runSide: 'us' | 'opp' | null = null, run = 0, runUs = 0, runOpp = 0, bench = 0
  let curQ = 0
  for (const e of game.events) {
    if (q !== 0 && e.q !== q) continue
    if (q === 0 && e.q !== curQ) { curQ = e.q }
    const pts = e.type === 'shot' && e.made ? e.pts ?? 2 : e.type === 'ft' && e.made ? 1 : 0
    const oppPts = e.type === 'oppPts' ? e.pts ?? 0 : 0
    if (!pts && !oppPts) continue
    if (pts) {
      us += pts
      if (e.playerId && !starters.has(e.playerId)) bench += pts
      if (runSide !== 'us') { runSide = 'us'; run = 0 }
      run += pts; runUs = Math.max(runUs, run)
    } else {
      opp += oppPts
      if (runSide !== 'opp') { runSide = 'opp'; run = 0 }
      run += oppPts; runOpp = Math.max(runOpp, run)
    }
    const d = us - opp
    if (d === 0) ties++
    const sign = Math.sign(d)
    if (sign !== 0) { if (lead !== 0 && sign !== lead) leadChanges++; lead = sign }
    maxUs = Math.max(maxUs, d); maxOpp = Math.max(maxOpp, -d)
  }
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
  const fUs = q === 0 ? sum(gs.foulsUs) : gs.foulsUs[q]
  const fOpp = q === 0 ? sum(gs.foulsOpp) : gs.foulsOpp[q]
  return {
    ties, leadChanges, maxLeadUs: maxUs, maxLeadOpp: maxOpp, runUs, runOpp, bench,
    timeoutsUs: gs.timeoutsUs, timeoutsOpp: gs.timeoutsOpp, foulsUs: fUs, foulsOpp: fOpp,
    bonusUs: q !== 0 && gs.foulsOpp[q] >= 4, bonusOpp: q !== 0 && gs.foulsUs[q] >= 4,
    sequenceKnown: !game.imported,
  }
}
