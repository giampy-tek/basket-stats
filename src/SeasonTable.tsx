import type { PStat } from './types'
import { fmtTime, rt } from './stats'
import { SortTh, nameKey, sortRows, statValue, useSort } from './sort'

export interface SeasonRow { key: string; label: string; s: PStat; games: number }

const DASH = '—'
const f1 = (n: number) => n.toFixed(1)
const pc = (m: number, a: number) => (a === 0 ? DASH : `${((m / a) * 100).toFixed(1)}%`)

/** Tabella "Stats stagione", stessa struttura dell'app originale: totali o medie a partita. */
export function SeasonTable({ rows, team, total, totalGames, avg }: {
  rows: SeasonRow[]; team: PStat; total: PStat; totalGames: number; avg: boolean
}) {
  // medie: ogni valore diviso per le partite giocate (dal giocatore o dalla squadra)
  const v = (n: number, g: number) => (avg ? (g ? f1(n / g) : DASH) : String(n))
  const pm = (s: PStat) => (s.min ? (s.pts / (s.min / 60)).toFixed(2) : '0.00')
  const cells = (s: PStat, g: number) => [
    g ? (avg ? fmtTime(s.min / g) : fmtTime(s.min)) : fmtTime(0),
    v(s.pts, g), pm(s),
    v(s.m2, g), v(s.a2, g), pc(s.m2, s.a2),
    v(s.m3, g), v(s.a3, g), pc(s.m3, s.a3),
    v(s.mf, g), v(s.af, g), pc(s.mf, s.af),
    v(s.f, g), v(s.fs, g),
    v(s.ro, g), v(s.rd, g), v(rt(s), g),
    v(s.rec, g), v(s.pp, g), v(s.ass, g), v(s.sm, g), v(s.ss, g),
    v(s.val, g),
  ]
  const GROUPS: [string, [string, string][]][] = [
    ['Tempo', [['G', 'games'], ['Min', 'min']]], ['Punti', [['Pt', 'pts'], ['P/M', 'pm']]],
    ['2P', [['S', 'm2'], ['T', 'a2'], ['%', 'p2']]], ['3P', [['S', 'm3'], ['T', 'a3'], ['%', 'p3']]], ['TL', [['S', 'mf'], ['T', 'af'], ['%', 'pf']]],
    ['Falli', [['F', 'f'], ['FS', 'fs']]], ['Rimbalzi', [['RO', 'ro'], ['RD', 'rd'], ['RT', 'rt']]],
    ['Altre', [['Rec', 'rec'], ['PP', 'pp'], ['Ass', 'ass'], ['SD', 'sm'], ['SS', 'ss']]], ['Valutazione', [['VAL', 'val']]],
  ]
  const { sort, toggle } = useSort()
  const shown = sortRows(rows, sort, (r, col) => (col === 'name' ? nameKey(r.label) : statValue(r.s, col, r.games, avg)))
  return (
    <div className="tablewrap">
      <table className="stats season">
        <thead>
          <tr>
            <SortTh col="name" sort={sort} toggle={toggle} rowSpan={2} className="namecol">Giocatore</SortTh>
            {GROUPS.map(([g, cols]) => <th key={g} className="g" colSpan={cols.length}>{g}</th>)}
          </tr>
          <tr>{GROUPS.flatMap(([g, cols]) => cols.map(([label, col]) => <SortTh key={g + col} col={col} sort={sort} toggle={toggle}>{label}</SortTh>))}</tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const c = cells(r.s, r.games)
            return (
              <tr key={r.key}>
                <td className="namecol">{r.label}</td>
                <td>{r.games}</td>
                {c.map((x, i) => <td key={i}>{x}</td>)}
              </tr>
            )
          })}
          <tr className="team">
            <td className="namecol">Squadra</td>
            {/* eventi senza giocatore: solo falli, rimbalzi, recuperi, palle perse */}
            <td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td>
            <td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td>
            <td>{v(team.f, totalGames)}</td><td>{v(team.fs, totalGames)}</td>
            <td>{v(team.ro, totalGames)}</td><td>{v(team.rd, totalGames)}</td><td>{v(rt(team), totalGames)}</td>
            <td>{v(team.rec, totalGames)}</td><td>{v(team.pp, totalGames)}</td>
            <td>{DASH}</td><td>{DASH}</td><td>{DASH}</td><td>{DASH}</td>
          </tr>
          <tr className="total">
            <td className="namecol">Totale squadra</td>
            <td>{totalGames}</td>
            {cells(total, totalGames).map((x, i) => <td key={i}>{x}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
