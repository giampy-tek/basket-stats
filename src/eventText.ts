import type { GameEvent } from './types'

export const qLabel = (q: number) => (q <= 4 ? `Q${q}` : `OT${q - 4}`)

/** Testo breve dell'azione, es. "Segnato da 3" / "Rimbalzo off." */
export function eventLabel(e: GameEvent): string {
  switch (e.type) {
    case 'shot': return `Tiro da ${e.pts} ${e.made ? 'segnato' : 'sbagliato'}`
    case 'ft': return `Tiro libero ${e.made ? 'segnato' : 'sbagliato'}`
    case 'oppPts': return `Avversari +${e.pts}`
    case 'reb': return `${e.side === 'opp' ? 'Rimbalzo avversario' : 'Rimbalzo'} ${e.kind === 'off' ? 'off.' : 'dif.'}`
    case 'steal': return e.kind === 'rec' ? 'Palla recuperata' : 'Palla persa'
    case 'foul': return e.kind === 'made' ? 'Fallo fatto' : 'Fallo subito'
    case 'assist': return 'Assist'
    case 'block': return e.kind === 'made' ? 'Stoppata fatta' : 'Stoppata subita'
    case 'timeout': return `Timeout ${e.side === 'opp' ? 'avversari' : 'nostro'}`
    case 'sub': return 'Cambio'
    case 'qend': return `Fine ${qLabel(e.q)}`
  }
}

/** Azioni che si possono aggiungere a mano a partita finita. */
export const ADD_PRESETS: { id: string; label: string; needsPlayer: boolean; make: () => Omit<GameEvent, 'id' | 'q'> }[] = [
  { id: 's2+', label: 'Tiro da 2 segnato', needsPlayer: true, make: () => ({ type: 'shot', pts: 2, made: true }) },
  { id: 's2-', label: 'Tiro da 2 sbagliato', needsPlayer: true, make: () => ({ type: 'shot', pts: 2, made: false }) },
  { id: 's3+', label: 'Tiro da 3 segnato', needsPlayer: true, make: () => ({ type: 'shot', pts: 3, made: true }) },
  { id: 's3-', label: 'Tiro da 3 sbagliato', needsPlayer: true, make: () => ({ type: 'shot', pts: 3, made: false }) },
  { id: 'f+', label: 'Tiro libero segnato', needsPlayer: true, make: () => ({ type: 'ft', made: true }) },
  { id: 'f-', label: 'Tiro libero sbagliato', needsPlayer: true, make: () => ({ type: 'ft', made: false }) },
  { id: 'fm', label: 'Fallo fatto', needsPlayer: true, make: () => ({ type: 'foul', kind: 'made' }) },
  { id: 'fd', label: 'Fallo subito', needsPlayer: true, make: () => ({ type: 'foul', kind: 'drawn' }) },
  { id: 'ro', label: 'Rimbalzo offensivo', needsPlayer: true, make: () => ({ type: 'reb', kind: 'off' }) },
  { id: 'rd', label: 'Rimbalzo difensivo', needsPlayer: true, make: () => ({ type: 'reb', kind: 'def' }) },
  { id: 'rec', label: 'Palla recuperata', needsPlayer: true, make: () => ({ type: 'steal', kind: 'rec' }) },
  { id: 'pp', label: 'Palla persa', needsPlayer: true, make: () => ({ type: 'steal', kind: 'lost' }) },
  { id: 'ass', label: 'Assist', needsPlayer: true, make: () => ({ type: 'assist' }) },
  { id: 'bm', label: 'Stoppata fatta', needsPlayer: true, make: () => ({ type: 'block', kind: 'made' }) },
  { id: 'bs', label: 'Stoppata subita', needsPlayer: true, make: () => ({ type: 'block', kind: 'suffered' }) },
]
