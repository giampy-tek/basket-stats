import type { PStat } from './types'
import { fmtTime, pct, rt } from './stats'

export interface Row {
  key: string
  label: string
  s: PStat
  games?: number
  onCourt?: boolean
}

const dec = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export function StatsTable({ rows, team, total, mode = 'game', avg = false, totalGames }: {
  rows: Row[]; team?: PStat; total: PStat; mode?: 'game' | 'season'; avg?: boolean; totalGames?: number
}) {
  const season = mode === 'season'
  const v = (n: number, g?: number) => (avg && g ? dec(Math.round((n / g) * 10) / 10) : String(n))
  const cells = (s: PStat, g?: number, isTeam = false) => {
    const sh = (m: number, a: number) => [<td key="m">{isTeam ? '' : v(m, g)}</td>, <td key="a">{isTeam ? '' : v(a, g)}</td>, <td key="p">{isTeam ? '' : pct(m, a)}</td>]
    return (
      <>
        {!isTeam && <td>{v(s.pts, g)}</td>}
        {isTeam && <td></td>}
        <td>{isTeam ? '' : avg && g ? fmtTime(s.min / g) : fmtTime(s.min)}</td>
        {season && <td>{isTeam ? '' : (s.min ? (s.pts / (s.min / 60)).toFixed(2) : '0.00')}</td>}
        {sh(s.m2, s.a2)}{sh(s.m3, s.a3)}{sh(s.mf, s.af)}
        <td>{v(s.f, g)}</td><td>{isTeam ? 0 : v(s.fs, g)}</td>
        <td>{v(s.ro, g)}</td><td>{v(s.rd, g)}</td><td>{avg && g ? dec(Math.round((rt(s) / g) * 10) / 10) : rt(s)}</td>
        <td>{v(s.rec, g)}</td><td>{v(s.pp, g)}</td>
        <td>{isTeam ? '' : v(s.ass, g)}</td><td>{isTeam ? '' : v(s.sm, g)}</td><td>{isTeam ? '' : v(s.ss, g)}</td>
        <td>{isTeam ? '' : v(s.val, g)}</td>
        {!season && <td>{isTeam ? '' : (s.pm > 0 ? `+${s.pm}` : s.pm)}</td>}
      </>
    )
  }
  return (
    <div className="tablewrap">
      <table className="stats">
        <thead>
          <tr>
            <th rowSpan={2}>Giocatore</th>
            {season && <th rowSpan={2}>G</th>}
            <th className="g" colSpan={season ? 2 : 2}>Punteggio</th>
            {season && <th rowSpan={2}>P/M</th>}
            <th className="g" colSpan={3}>2P</th><th className="g" colSpan={3}>3P</th><th className="g" colSpan={3}>TL</th>
            <th className="g" colSpan={2}>Falli</th><th className="g" colSpan={3}>Rimbalzi</th><th className="g" colSpan={5}>Altre</th>
            <th className="g" colSpan={season ? 1 : 2}>{season ? 'Val.' : 'Eff.'}</th>
          </tr>
          <tr>
            <th>Pt</th><th>Min</th>
            <th>S</th><th>T</th><th>%</th><th>S</th><th>T</th><th>%</th><th>S</th><th>T</th><th>%</th>
            <th>F</th><th>FS</th><th>RO</th><th>RD</th><th>RT</th>
            <th>Rec</th><th>PP</th><th>Ass</th><th>SM</th><th>SS</th>
            <th>{season ? 'PIR' : 'VAL'}</th>{!season && <th>+/-</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={r.onCourt ? 'oncourt' : ''}>{r.label}</td>
              {season && <td>{r.games ?? 0}</td>}
              {cells(r.s, r.games)}
            </tr>
          ))}
          {team && (
            <tr className="team"><td>Squadra</td>{season && <td></td>}{cells(team, undefined, true)}</tr>
          )}
          <tr className="total"><td>Totale squadra</td>{season && <td>{totalGames}</td>}{cells(total, totalGames)}</tr>
        </tbody>
      </table>
    </div>
  )
}
