export interface Player {
  id: string
  first: string
  last: string
  role: string
}

export interface RosterEntry {
  playerId: string
  number: number
}

export interface Season {
  id: string
  year: string // 2026/2027
  category: string // Under 17 Gold
  coach: string
  vice: string
  shirt1: string
  shirt2: string
  roster: RosterEntry[]
}

export type EvType =
  | 'shot' // tiro dal campo (x,y in metri, pts 2|3)
  | 'ft' // tiro libero
  | 'oppPts' // punti avversari
  | 'reb' // kind: off | def
  | 'steal' // recupero (kind: rec) / palla persa (kind: lost)
  | 'foul' // kind: made | drawn
  | 'assist'
  | 'block' // kind: made | suffered
  | 'timeout' // side
  | 'sub'
  | 'qend'

export interface GameEvent {
  id: string
  q: number
  type: EvType
  playerId?: string
  made?: boolean
  pts?: number
  x?: number
  y?: number
  kind?: string
  side?: 'us' | 'opp'
  remaining?: number
  out?: string[]
  in?: string[]
}

export type GameStatus = 'todo' | 'live' | 'done'

export interface Game {
  id: string
  seasonId: string
  opponent: string
  date: string // yyyy-mm-dd
  time: string // HH:MM
  home: boolean
  status: GameStatus
  quarter: number
  quarterLength: number // secondi
  starters: string[]
  events: GameEvent[]
}

export interface PStat {
  playerId: string
  pts: number
  min: number
  m2: number
  a2: number
  m3: number
  a3: number
  mf: number
  af: number
  f: number
  fs: number
  ro: number
  rd: number
  rec: number
  pp: number
  ass: number
  sm: number
  ss: number
  pm: number
  val: number
}
