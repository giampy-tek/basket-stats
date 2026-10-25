import { useRoute } from './ui'
import { useStore } from './store'
import Setup from './screens/Setup'
import Dashboard from './screens/Dashboard'
import Seasons from './screens/Seasons'
import Roster from './screens/Roster'
import Games from './screens/Games'
import Prepare from './screens/Prepare'
import Recorder from './screens/Recorder'
import GameStats from './screens/GameStats'
import SeasonStats from './screens/SeasonStats'
import ShotMap from './screens/ShotMap'

export default function App() {
  const [a, b, c] = useRoute()
  const hasClub = useStore((s) => !!s.clubName)
  if (!hasClub) return <div className="screen"><Setup /></div>
  let view
  if (!a) view = <Dashboard />
  else if (a === 'seasons') view = <Seasons />
  else if (a === 'roster') view = <Roster />
  else if (a === 'games') view = <Games selected={b} />
  else if (a === 'prepare') view = <Prepare id={b} />
  else if (a === 'record') view = <Recorder id={b} />
  else if (a === 'stats' && b === 'game') view = <GameStats id={c} />
  else if (a === 'stats' && b === 'season') view = <SeasonStats />
  else if (a === 'stats' && b === 'map') view = <ShotMap />
  else view = <Dashboard />
  return <div className="screen">{view}</div>
}
