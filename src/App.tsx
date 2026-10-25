import { useRoute } from './ui'
import { useStore } from './store'
import Setup from './screens/Setup'
import Login from './screens/Login'
import { Share } from './screens/Teams'
import { cloudEnabled, useCloud } from './cloud'
import { REQUIRE_LOGIN } from './cloudConfig'
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
  const viewer = useStore((s) => s.clubs[s.activeId]?.role === 'viewer')
  const { ready, email } = useCloud()
  // solo in sviluppo (npm run dev): ?nogate salta il login per provare l'interfaccia in locale
  const devBypass = import.meta.env.DEV && new URLSearchParams(location.search).has('nogate')
  if (cloudEnabled && REQUIRE_LOGIN && !devBypass) {
    if (!ready) return <div className="screen" />
    if (!email) return <div className="screen"><Login /></div>
  }
  if (!hasClub) return <div className="screen"><Setup /></div>
  let view
  if (!a) view = <Dashboard />
  else if (a === 'seasons') view = <Seasons />
  else if (a === 'roster') view = <Roster />
  else if (a === 'games') view = <Games selected={b} />
  else if (a === 'prepare') view = viewer ? <Games selected={b} /> : <Prepare id={b} />
  else if (a === 'record') view = viewer ? <Games selected={b} /> : <Recorder id={b} />
  else if (a === 'share') view = <Share />
  else if (a === 'stats' && b === 'game') view = <GameStats id={c} />
  else if (a === 'stats' && b === 'season') view = <SeasonStats />
  else if (a === 'stats' && b === 'map') view = <ShotMap />
  else view = <Dashboard />
  return <div className="screen">{view}</div>
}
