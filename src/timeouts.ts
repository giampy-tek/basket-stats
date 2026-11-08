import type { Game } from './types'

export type TimeoutRule = 'fiba' | 'quarter'

export const TIMEOUT_RULES: Record<TimeoutRule, string> = {
  fiba: 'FIBA: 2 nel 1° tempo, 3 nel 2°, 1 per supplementare',
  quarter: '1 per ogni quarto',
}

/** Quarti che dividono lo stesso blocco di timeout e quanti se ne possono chiamare in quel blocco. */
export function timeoutBlock(rule: TimeoutRule, q: number) {
  if (q > 4) return { qs: [q], limit: 1, label: 'suppl.' }
  if (rule === 'quarter') return { qs: [q], limit: 1, label: `Q${q}` }
  // shortcut: manca il tetto di 2 timeout negli ultimi 2' del 4° quarto, si controlla a mano
  return q <= 2 ? { qs: [1, 2], limit: 2, label: '1° tempo' } : { qs: [3, 4], limit: 3, label: '2° tempo' }
}

/** Timeout già chiamati e massimo consentito per una squadra nel blocco del quarto in corso. */
export function timeoutInfo(game: Game, side: 'us' | 'opp') {
  const b = timeoutBlock(game.timeoutRule ?? 'fiba', game.quarter)
  const used = game.events.filter((e) => e.type === 'timeout' && (e.side ?? 'us') === side && b.qs.includes(e.q)).length
  return { used, limit: b.limit, label: b.label, full: used >= b.limit }
}
