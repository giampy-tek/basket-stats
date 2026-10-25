import type { Game, GameEvent, Player, Season } from './types'

/*
 * Importa il CSV "partita" esportato da Basket Recorder Pro.
 * Il file contiene solo totali per giocatore e per periodo (niente cronologia né coordinate dei tiri):
 * da quei totali ricostruiamo le azioni, in modo che statistiche, parziali, falli e zone (campana /
 * media / da 3) tornino identici. Minuti e +/- vengono copiati così come sono.
 */

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

interface Row { number: number; name: string; v: Record<string, number>; min: number }
interface Section { rows: Row[]; team: Record<string, number>; opp: number }

export interface ParsedGame {
  club: string
  opponent: string
  us: number
  opp: number
  date: string
  home: boolean
  year: string
  category: string
  total: Section
  periods: Section[]
  timeouts: { us: number; opp: number }[]
}

const num = (s?: string) => {
  if (s == null) return 0
  const t = s.trim().replace('+', '')
  if (t === '' || t === '-') return 0
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}
/** "16.05" = 16 minuti e 5 secondi */
const minSec = (s?: string) => {
  if (!s) return 0
  const [m, f = '0'] = s.trim().split('.')
  return (parseInt(m, 10) || 0) * 60 + (parseInt(f.padEnd(2, '0').slice(0, 2), 10) || 0)
}

export function parseBrpCsv(text: string): ParsedGame {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const title = lines[0]?.split(' · ') ?? []
  const m0 = /^(.*?) - (.*) (\d+)-(\d+)$/.exec(title[0] ?? '')
  if (!m0) throw new Error('Non sembra un CSV di Basket Recorder Pro (riga del titolo non riconosciuta).')
  const md = /^(\d{1,2}) (\w{3}) (\d{4})$/.exec((title[1] ?? '').trim())
  if (!md || MONTHS.indexOf(md[2].toLowerCase()) < 0) throw new Error('Data della partita non riconosciuta.')
  const date = `${md[3]}-${String(MONTHS.indexOf(md[2].toLowerCase()) + 1).padStart(2, '0')}-${md[1].padStart(2, '0')}`
  const my = /^(\d{4}\/\d{4})\s*(.*)$/.exec((title[2] ?? '').trim())

  const sections: { name: string; sec: Section }[] = []
  let cur: Section | null = null
  let idx: Record<string, number> = {}
  let andHdr: Record<string, number> | null = null
  let andRows: { name: string; cells: string[] }[] = []
  let afterTotal = false

  for (const line of lines.slice(1)) {
    const l = line.trim()
    if (!l) { continue }
    const sm = /^(Partita|\d+° periodo)$/.exec(l)
    if (sm) { cur = { rows: [], team: {}, opp: 0 }; sections.push({ name: sm[1], sec: cur }); afterTotal = false; andHdr = null; continue }
    const c = l.split(';')
    if (c[0] === 'Giocatore') { idx = Object.fromEntries(c.map((h, i) => [h, i])); continue }
    if (c[0] === 'Periodo') { andHdr = Object.fromEntries(c.map((h, i) => [h, i])); cur = null; continue }
    if (andHdr) { if (/^(Partita|\d+° periodo)$/.test(c[0])) andRows.push({ name: c[0], cells: c }); continue }
    if (!cur) continue
    if (c[0].startsWith('#')) {
      const mm = /^#(\d+)\s+(.*)$/.exec(c[0])
      if (!mm) continue
      const v: Record<string, number> = {}
      for (const [h, i] of Object.entries(idx)) if (h !== 'Giocatore' && h !== 'Min') v[h] = num(c[i])
      cur.rows.push({ number: Number(mm[1]), name: mm[2].trim(), v, min: minSec(c[idx['Min']]) })
    } else if (c[0] === 'Squadra') {
      for (const h of ['F', 'FS', 'RO', 'RD', 'Rec', 'PP']) cur.team[h] = num(c[idx[h]])
    } else if (c[0] === 'Totale squadra') {
      afterTotal = true
    } else if (afterTotal && /^[^;]+;;\d+$/.test(l)) {
      cur.opp = num(c[2])
      afterTotal = false
    }
  }

  const total = sections.find((s) => s.name === 'Partita')?.sec
  const periods = sections.filter((s) => s.name !== 'Partita').map((s) => s.sec)
  if (!total || periods.length === 0) throw new Error('Nel file mancano la tabella della partita o dei periodi.')

  const timeouts = periods.map((_, i) => {
    const r = andRows.find((x) => x.name === `${i + 1}° periodo`)
    return { us: r && andHdr ? num(r.cells[andHdr['Timeout noi']]) : 0, opp: r && andHdr ? num(r.cells[andHdr['Timeout loro']]) : 0 }
  })

  return {
    club: m0[1], opponent: m0[2].trim(), us: Number(m0[3]), opp: Number(m0[4]), date,
    home: /casa/i.test(title[3] ?? ''), year: my?.[1] ?? '', category: my?.[2] ?? '',
    total, periods, timeouts,
  }
}

export interface BuildResult {
  game: Game
  newPlayers: { player: Player; number: number }[]
  warnings: string[]
}

/** Costruisce la partita: i giocatori si abbinano per numero di maglia (e nome); quelli nuovi vengono creati. */
export function buildGame(p: ParsedGame, season: Season, players: Player[], uid: () => string): BuildResult {
  const warnings: string[] = []
  const newPlayers: BuildResult['newPlayers'] = []
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zà-ú]/g, '')
  const ids = new Map<number, string>()

  const allRows = [...p.total.rows, ...p.periods.flatMap((s) => s.rows)]
  for (const r of allRows) {
    if (ids.has(r.number)) continue
    const inRoster = season.roster.find((x) => x.number === r.number)
    const pl = inRoster ? players.find((x) => x.id === inRoster.playerId) : undefined
    if (pl && norm(`${pl.last}${pl.first}`) === norm(r.name)) { ids.set(r.number, pl.id); continue }
    // stesso nome ma numero diverso
    const byName = players.find((x) => norm(`${x.last}${x.first}`) === norm(r.name))
    if (byName) {
      ids.set(r.number, byName.id)
      if (!season.roster.some((x) => x.playerId === byName.id)) newPlayers.push({ player: byName, number: r.number })
      else warnings.push(`#${r.number} ${r.name}: nel roster ha un numero diverso.`)
      continue
    }
    if (pl) warnings.push(`#${r.number}: nel roster c'è ${pl.last} ${pl.first}, nel file ${r.name}. Uso il giocatore del file.`)
    const [last, ...rest] = r.name.split(' ')
    const np: Player = { id: uid(), last, first: rest.join(' '), role: '' }
    newPlayers.push({ player: np, number: r.number })
    ids.set(r.number, np.id)
  }

  const events: GameEvent[] = []
  const imported = { min: {} as Record<string, number[]>, pm: {} as Record<string, number[]> }
  const ev = (q: number, e: Omit<GameEvent, 'id' | 'q'>, n = 1) => { for (let i = 0; i < n; i++) events.push({ id: uid(), q, ...e }) }

  p.periods.forEach((sec, i) => {
    const q = i + 1
    for (const r of sec.rows) {
      const pid = ids.get(r.number)!
      const v = r.v
      ;(imported.min[pid] ??= [])[q] = r.min
      ;(imported.pm[pid] ??= [])[q] = v['+/-'] ?? 0
      const base = { playerId: pid }
      // tiri da 2: campana, media distanza e (se ci sono) senza posizione
      const cT = v['Campana T'] ?? 0, cS = v['Campana S'] ?? 0
      const mT = v['Media distanza T'] ?? 0, mS = v['Media distanza S'] ?? 0
      const uT = Math.max(0, (v['2P T'] ?? 0) - cT - mT)
      const uS = Math.min(uT, Math.max(0, (v['2P S'] ?? 0) - cS - mS))
      ev(q, { ...base, type: 'shot', pts: 2, made: true, zone: 'campana' }, cS)
      ev(q, { ...base, type: 'shot', pts: 2, made: false, zone: 'campana' }, cT - cS)
      ev(q, { ...base, type: 'shot', pts: 2, made: true, zone: 'media' }, mS)
      ev(q, { ...base, type: 'shot', pts: 2, made: false, zone: 'media' }, mT - mS)
      ev(q, { ...base, type: 'shot', pts: 2, made: true }, uS)
      ev(q, { ...base, type: 'shot', pts: 2, made: false }, uT - uS)
      ev(q, { ...base, type: 'shot', pts: 3, made: true, zone: 'da3' }, v['3P S'] ?? 0)
      ev(q, { ...base, type: 'shot', pts: 3, made: false, zone: 'da3' }, (v['3P T'] ?? 0) - (v['3P S'] ?? 0))
      ev(q, { ...base, type: 'ft', made: true }, v['TL S'] ?? 0)
      ev(q, { ...base, type: 'ft', made: false }, (v['TL T'] ?? 0) - (v['TL S'] ?? 0))
      ev(q, { ...base, type: 'assist' }, v['Ass'] ?? 0)
      ev(q, { ...base, type: 'reb', kind: 'off' }, v['RO'] ?? 0)
      ev(q, { ...base, type: 'reb', kind: 'def' }, v['RD'] ?? 0)
      ev(q, { ...base, type: 'steal', kind: 'rec' }, v['Rec'] ?? 0)
      ev(q, { ...base, type: 'steal', kind: 'lost' }, v['PP'] ?? 0)
      ev(q, { ...base, type: 'foul', kind: 'made' }, v['F'] ?? 0)
      ev(q, { ...base, type: 'foul', kind: 'drawn' }, v['FS'] ?? 0)
      ev(q, { ...base, type: 'block', kind: 'made' }, v['SD'] ?? 0)
      ev(q, { ...base, type: 'block', kind: 'suffered' }, v['SS'] ?? 0)
      // controllo: i punti ricostruiti devono coincidere con quelli del file
      const pts = (v['2P S'] ?? 0) * 2 + (v['3P S'] ?? 0) * 3 + (v['TL S'] ?? 0)
      if (pts !== (v['Pt'] ?? 0)) warnings.push(`#${r.number} ${r.name} ${q}° periodo: punti ${pts} ≠ ${v['Pt']} nel file.`)
    }
    // azioni di squadra (senza giocatore)
    ev(q, { type: 'foul', kind: 'made' }, sec.team['F'] ?? 0)
    ev(q, { type: 'foul', kind: 'drawn' }, sec.team['FS'] ?? 0)
    ev(q, { type: 'reb', kind: 'off' }, sec.team['RO'] ?? 0)
    ev(q, { type: 'reb', kind: 'def' }, sec.team['RD'] ?? 0)
    ev(q, { type: 'steal', kind: 'rec' }, sec.team['Rec'] ?? 0)
    ev(q, { type: 'steal', kind: 'lost' }, sec.team['PP'] ?? 0)
    // punti avversari (il file non dice come sono stati fatti: li registro come canestri da 2 + un libero)
    let o = sec.opp
    while (o >= 2) { ev(q, { type: 'oppPts', pts: 2 }); o -= 2 }
    if (o === 1) ev(q, { type: 'oppPts', pts: 1 })
    ev(q, { type: 'timeout', side: 'us' }, p.timeouts[i]?.us ?? 0)
    ev(q, { type: 'timeout', side: 'opp' }, p.timeouts[i]?.opp ?? 0)
    ev(q, { type: 'qend' })
  })

  const game: Game = {
    id: uid(), seasonId: season.id, opponent: p.opponent, date: p.date, time: '', home: p.home,
    status: 'done', quarter: p.periods.length, quarterLength: 600,
    starters: p.total.rows.filter((r) => r.v['Q'] === 1).map((r) => ids.get(r.number)!),
    events, imported,
  }
  const us = events.reduce((a, e) => a + (e.type === 'shot' && e.made ? e.pts ?? 0 : e.type === 'ft' && e.made ? 1 : 0), 0)
  const opp = events.reduce((a, e) => a + (e.type === 'oppPts' ? e.pts ?? 0 : 0), 0)
  if (us !== p.us || opp !== p.opp) warnings.push(`Punteggio ricostruito ${us}-${opp}, nel file ${p.us}-${p.opp}.`)
  return { game, newPlayers, warnings }
}
