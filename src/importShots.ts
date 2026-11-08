import type { Game, Season } from './types'
import { zoneOf, type Zone } from './court'

/*
 * File JSON "shot-positions": le posizioni dei tiri di una partita già importata da CSV (che conosce solo la zona).
 * Ogni tiro del file prende il posto di un tiro senza posizione dello stesso giocatore, stesso esito e stessa zona:
 * quarto, punti e totali restano identici, cambia solo dove compare il pallino sulla mappa.
 */
export interface ShotPositions {
  type: 'shot-positions'
  opponent: string
  date: string
  shots: { n: number; made: boolean; x: number; y: number }[]
}

export function parseShotPositions(text: string): ShotPositions | null {
  try {
    const d = JSON.parse(text)
    if (d?.type === 'shot-positions' && Array.isArray(d.shots) && d.opponent && d.date) return d
  } catch { /* non è un file di posizioni */ }
  return null
}

export function applyShotPositions(game: Game, season: Season, file: ShotPositions): { game: Game; applied: number; skipped: number } {
  const events = [...game.events]
  let applied = 0
  for (const s of file.shots) {
    const playerId = season.roster.find((r) => r.number === s.n)?.playerId
    if (!playerId) continue
    const zone: Zone = zoneOf(s.x, s.y)
    const i = events.findIndex((e) => e.type === 'shot' && e.x == null && e.playerId === playerId && !!e.made === s.made && (e.zone ?? (e.pts === 3 ? 'da3' : zone)) === zone)
    if (i < 0) continue
    const { zone: _z, ...rest } = events[i]
    void _z
    events[i] = { ...rest, x: s.x, y: s.y }
    applied++
  }
  return { game: { ...game, events }, applied, skipped: file.shots.length - applied }
}
