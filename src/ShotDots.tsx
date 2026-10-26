import { Court, ShotDot } from './ui'
import type { GameEvent } from './types'

/** Due campi: tiri segnati e sbagliati, con il numero di maglia. Solo i tiri con la posizione registrata. */
export function ShotDotsMaps({ shots, numberOf }: { shots: GameEvent[]; numberOf: (id?: string) => number | undefined }) {
  const pos = shots.filter((e) => e.type === 'shot' && e.x != null && e.y != null)
  const lists: [string, GameEvent[]][] = [['Segnati', pos.filter((e) => e.made)], ['Sbagliati', pos.filter((e) => !e.made)]]
  return (
    <div className="maps">
      {lists.map(([title, list]) => (
        <div key={title} className="card" style={{ overflow: 'hidden' }}>
          <div className="map-title"><span>{title}</span><span style={{ color: 'var(--muted)' }}>{list.length}</span></div>
          <Court>
            {list.map((e) => <ShotDot key={e.id} x={e.x!} y={e.y!} made={!!e.made} label={String(numberOf(e.playerId) ?? '')} r={0.5} />)}
          </Court>
        </div>
      ))}
    </div>
  )
}
