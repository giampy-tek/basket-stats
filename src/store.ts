import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Game, GameEvent, Player, Season } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export type Role = 'owner' | 'editor' | 'viewer'
export interface ClubData { clubName: string; brandColor: string; players: Player[]; seasons: Season[]; games: Game[]; seasonId: string }
/** Squadra nota a questo dispositivo. Quella attiva vive nei campi piatti dello store; le altre in `data`. */
export interface ClubRef { id: string; name: string; role?: Role; data?: ClubData }
export interface RemoteTeam { id: string; name: string; role: Role }

interface State {
  activeId: string // 'local' = squadra solo su questo dispositivo, altrimenti id della squadra nel cloud
  clubs: Record<string, ClubRef>
  clubName: string
  brandColor: string
  players: Player[]
  seasons: Season[]
  games: Game[]
  seasonId: string
  setClubName: (n: string) => void
  setBrandColor: (c: string) => void
  setSeason: (id: string) => void
  addSeason: (s: Omit<Season, 'id' | 'roster'>) => string
  updateSeason: (id: string, patch: Partial<Season>) => void
  deleteSeason: (id: string) => void
  addPlayer: (p: Omit<Player, 'id'>, seasonId: string, number: number) => void
  updatePlayer: (id: string, patch: Partial<Player>) => void
  setNumber: (seasonId: string, playerId: string, number: number) => void
  removeFromRoster: (seasonId: string, playerId: string) => void
  addToRoster: (seasonId: string, playerId: string, number: number) => void
  deletePlayer: (id: string) => void
  addGame: (g: Omit<Game, 'id' | 'status' | 'quarter' | 'starters' | 'events' | 'quarterLength'>) => string
  updateGame: (id: string, patch: Partial<Game>) => void
  deleteGame: (id: string) => void
  pushEvent: (gameId: string, e: Omit<GameEvent, 'id'>) => void
  undo: (gameId: string) => void
  updateEvent: (gameId: string, eventId: string, patch: Partial<GameEvent>) => void
  deleteEvent: (gameId: string, eventId: string) => void
  addEvent: (gameId: string, e: Omit<GameEvent, 'id'>) => void
  switchClub: (id: string) => void
  syncClubList: (list: RemoteTeam[]) => void
  linkClub: (id: string, role: Role, name: string) => void
  addRemoteClub: (id: string, role: Role, name: string, brandColor: string) => void
  resetAll: () => void
  importAll: (data: Partial<State>) => void
}

/** Stato iniziale: nessuna squadra, si parte dalla schermata di primo avvio. */
const emptyData = (name = ''): ClubData => ({ clubName: name, brandColor: '#b5440c', players: [], seasons: [], games: [], seasonId: '' })
const flatOf = (s: State): ClubData => ({ clubName: s.clubName, brandColor: s.brandColor, players: s.players, seasons: s.seasons, games: s.games, seasonId: s.seasonId })

function seed() {
  return { activeId: 'local', clubs: {} as Record<string, ClubRef>, clubName: '', brandColor: '#b5440c', players: [] as Player[], seasons: [] as Season[], games: [] as Game[], seasonId: '' }
}

const patchSeason = (s: State, id: string, fn: (x: Season) => Season) => ({
  seasons: s.seasons.map((x) => (x.id === id ? fn(x) : x)),
})

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...seed(),
      switchClub: (id) =>
        set((st) => {
          if (id === st.activeId || !st.clubs[id]) return st
          const saved: ClubRef = { id: st.activeId, name: st.clubName || st.clubs[st.activeId]?.name || '', role: st.clubs[st.activeId]?.role, data: flatOf(st) }
          const next = st.clubs[id]
          return { clubs: { ...st.clubs, [st.activeId]: saved }, activeId: id, ...(next.data ?? emptyData(next.name)) }
        }),
      syncClubList: (list) =>
        set((st) => {
          const clubs = { ...st.clubs }
          const ids = new Set(list.map((x) => x.id))
          for (const x of list) clubs[x.id] = { id: x.id, name: x.name, role: x.role, data: clubs[x.id]?.data }
          for (const id of Object.keys(clubs)) if (id !== 'local' && !ids.has(id)) delete clubs[id]
          let { activeId } = st
          let patch: Partial<ClubData> = {}
          const activeGone = activeId !== 'local' && !ids.has(activeId)
          const localEmpty = activeId === 'local' && !st.clubName && list.length > 0
          if (activeGone || localEmpty) {
            const target = list[0]
            if (target) { activeId = target.id; patch = clubs[target.id].data ?? emptyData(target.name) }
            else { activeId = 'local'; patch = clubs['local']?.data ?? emptyData() }
          }
          return { clubs, activeId, ...patch }
        }),
      linkClub: (id, role, name) =>
        set((st) => {
          const clubs = { ...st.clubs }
          delete clubs[st.activeId]
          clubs[id] = { id, name, role }
          return { clubs, activeId: id }
        }),
      addRemoteClub: (id, role, name, brandColor) =>
        set((st) => {
          const saved: ClubRef = { id: st.activeId, name: st.clubName || st.clubs[st.activeId]?.name || '', role: st.clubs[st.activeId]?.role, data: flatOf(st) }
          return {
            clubs: { ...st.clubs, [st.activeId]: saved, [id]: { id, name, role } },
            activeId: id,
            ...emptyData(name), brandColor,
          }
        }),
      setClubName: (clubName) => set({ clubName }),
      setBrandColor: (brandColor) => set({ brandColor }),
      setSeason: (seasonId) => set({ seasonId }),
      addSeason: (s) => {
        const id = uid()
        set((st) => ({ seasons: [...st.seasons, { ...s, id, roster: [] }], seasonId: id }))
        return id
      },
      updateSeason: (id, patch) => set((st) => patchSeason(st, id, (x) => ({ ...x, ...patch }))),
      deleteSeason: (id) =>
        set((st) => {
          const seasons = st.seasons.filter((x) => x.id !== id)
          return {
            seasons,
            games: st.games.filter((g) => g.seasonId !== id),
            seasonId: st.seasonId === id ? seasons[0]?.id ?? '' : st.seasonId,
          }
        }),
      addPlayer: (p, seasonId, number) =>
        set((st) => {
          const id = uid()
          return {
            players: [...st.players, { ...p, id }],
            ...patchSeason(st, seasonId, (x) => ({ ...x, roster: [...x.roster, { playerId: id, number }] })),
          }
        }),
      updatePlayer: (id, patch) =>
        set((st) => ({ players: st.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      setNumber: (seasonId, playerId, number) =>
        set((st) =>
          patchSeason(st, seasonId, (x) => ({
            ...x, roster: x.roster.map((r) => (r.playerId === playerId ? { ...r, number } : r)),
          })),
        ),
      removeFromRoster: (seasonId, playerId) =>
        set((st) => patchSeason(st, seasonId, (x) => ({ ...x, roster: x.roster.filter((r) => r.playerId !== playerId) }))),
      addToRoster: (seasonId, playerId, number) =>
        set((st) => patchSeason(st, seasonId, (x) => ({ ...x, roster: [...x.roster, { playerId, number }] }))),
      deletePlayer: (id) =>
        set((st) => ({
          players: st.players.filter((p) => p.id !== id),
          seasons: st.seasons.map((s) => ({ ...s, roster: s.roster.filter((r) => r.playerId !== id) })),
        })),
      addGame: (g) => {
        const id = uid()
        set((st) => ({
          games: [...st.games, { ...g, id, status: 'todo', quarter: 1, quarterLength: 600, starters: [], events: [] }],
        }))
        return id
      },
      updateGame: (id, patch) => set((st) => ({ games: st.games.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGame: (id) => set((st) => ({ games: st.games.filter((g) => g.id !== id) })),
      pushEvent: (gameId, e) =>
        set((st) => ({
          games: st.games.map((g) => (g.id === gameId ? { ...g, events: [...g.events, { ...e, id: uid() }] } : g)),
        })),
      updateEvent: (gameId, eventId, patch) =>
        set((st) => ({
          games: st.games.map((g) => (g.id === gameId ? { ...g, events: g.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) } : g)),
        })),
      deleteEvent: (gameId, eventId) =>
        set((st) => ({ games: st.games.map((g) => (g.id === gameId ? { ...g, events: g.events.filter((e) => e.id !== eventId) } : g)) })),
      addEvent: (gameId, e) =>
        set((st) => ({
          games: st.games.map((g) => {
            if (g.id !== gameId) return g
            // inserisce in coda al quarto scelto (prima della sua "fine quarto")
            let idx = -1
            g.events.forEach((x, i) => { if (x.q === e.q && x.type !== 'qend') idx = i })
            if (idx < 0) g.events.forEach((x, i) => { if (x.q < e.q) idx = i })
            const events = [...g.events]
            events.splice(idx + 1, 0, { ...e, id: uid() })
            return { ...g, events }
          }),
        })),
      undo: (gameId) =>
        set((st) => ({
          games: st.games.map((g) => {
            if (g.id !== gameId || !g.events.length) return g
            const last = g.events[g.events.length - 1]
            // annullare una fine quarto riporta al quarto precedente e riapre la partita
            if (last.type === 'qend') {
              return { ...g, events: g.events.slice(0, -1), quarter: last.q, status: 'live' }
            }
            return { ...g, events: g.events.slice(0, -1) }
          }),
        })),
      resetAll: () => set({ ...seed(), clubs: {}, activeId: 'local' }),
      importAll: (d) => set({ clubName: d.clubName ?? '', brandColor: d.brandColor ?? '#b5440c', players: d.players ?? [], seasons: d.seasons ?? [], games: d.games ?? [], seasonId: d.seasonId ?? d.seasons?.[0]?.id ?? '' }),
    }),
    {
      name: 'basket-stats-v1',
      version: 2,
      // v2: via le partite di prova/vecchie, resta il roster
      migrate: (old, v) => (v < 2 ? { ...(old as State), games: [] } : (old as State)),
    },
  ),
)

/** Ruolo nella squadra attiva: undefined = squadra locale (si può modificare tutto). */
export const useRole = () => useStore((s) => s.clubs[s.activeId]?.role)
/** False solo per chi ha il ruolo "sola lettura". */
export const useCanEdit = () => useStore((s) => s.clubs[s.activeId]?.role !== 'viewer')

export const playerName = (p?: Player) => (p ? `${p.last} ${p.first}` : '')
export const shortName = (p?: Player) => (p ? `${p.first[0]}. ${p.last}` : '')
