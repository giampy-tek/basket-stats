import { useState, type ReactNode, type ThHTMLAttributes } from 'react'
import type { PStat } from './types'
import { rt } from './stats'

export type SortState = { col: string; dir: 'asc' | 'desc' } | null

/** Primo tocco: decrescente (per il nome: A-Z), secondo: il contrario, terzo: ordine originale. */
export function useSort() {
  const [sort, setSort] = useState<SortState>(null)
  const toggle = (col: string) =>
    setSort((s) => {
      const first = col === 'name' ? 'asc' : 'desc'
      if (!s || s.col !== col) return { col, dir: first }
      if (s.dir === first) return { col, dir: first === 'asc' ? 'desc' : 'asc' }
      return null
    })
  return { sort, toggle }
}

export function sortRows<T>(rows: T[], sort: SortState, val: (r: T, col: string) => number | string): T[] {
  if (!sort) return rows
  const m = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = val(a, sort.col)
    const y = val(b, sort.col)
    if (typeof x === 'string' || typeof y === 'string') return m * String(x).localeCompare(String(y), 'it', { numeric: true })
    return m * (x - y)
  })
}

type ThProps = { col: string; sort: SortState; toggle: (c: string) => void; children: ReactNode } & ThHTMLAttributes<HTMLTableCellElement>

export function SortTh({ col, sort, toggle, children, className = '', ...rest }: ThProps) {
  const on = sort?.col === col
  return (
    <th {...rest} className={`sortable ${className}`} onClick={() => toggle(col)}
      aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {children}{on && <span className="sort-arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  )
}

const ratio = (m: number, a: number) => (a === 0 ? -1 : m / a)

/** Valore numerico di una colonna di statistiche, coerente con quello mostrato (totali o medie a partita). */
export function statValue(s: PStat, col: string, g?: number, avg = false): number {
  const d = (n: number) => (avg ? (g ? n / g : 0) : n)
  switch (col) {
    case 'games': return g ?? 0
    case 'pts': return d(s.pts)
    case 'min': return d(s.min)
    case 'pm': return s.min ? s.pts / (s.min / 60) : 0
    case 'm2': return d(s.m2)
    case 'a2': return d(s.a2)
    case 'p2': return ratio(s.m2, s.a2)
    case 'm3': return d(s.m3)
    case 'a3': return d(s.a3)
    case 'p3': return ratio(s.m3, s.a3)
    case 'mf': return d(s.mf)
    case 'af': return d(s.af)
    case 'pf': return ratio(s.mf, s.af)
    case 'f': return d(s.f)
    case 'fs': return d(s.fs)
    case 'ro': return d(s.ro)
    case 'rd': return d(s.rd)
    case 'rt': return d(rt(s))
    case 'rec': return d(s.rec)
    case 'pp': return d(s.pp)
    case 'ass': return d(s.ass)
    case 'sm': return d(s.sm)
    case 'ss': return d(s.ss)
    case 'val': return d(s.val)
    case 'plusminus': return s.pm
    default: return 0
  }
}

/** Il nome si ordina alfabeticamente, ignorando il numero di maglia davanti. */
export const nameKey = (label: string) => label.replace(/^#?\d+\s*/, '')
