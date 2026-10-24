import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Game, GameEvent, Player, Season } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

interface State {
  clubName: string
  players: Player[]
  seasons: Season[]
  games: Game[]
  seasonId: string
  setClubName: (n: string) => void
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
  resetAll: () => void
  importAll: (data: Partial<State>) => void
}

function seed() {
  const players: Player[] = []
  const season: Season = {
    id: uid(), year: '2026/2027', category: 'Under 17',
    coach: '', vice: '', shirt1: '#0000FF', shirt2: '#FFFFFF',
    roster: [],
  }
  const games: Game[] = []
  return { clubName: 'Jolly Basket', players, seasons: [season], games, seasonId: season.id }
}

const patchSeason = (s: State, id: string, fn: (x: Season) => Season) => ({
  seasons: s.seasons.map((x) => (x.id === id ? fn(x) : x)),
})

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...seed(),
      setClubName: (clubName) => set({ clubName }),
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
      resetAll: () => set({ ...seed() }),
      importAll: (d) => set({ clubName: d.clubName ?? '', players: d.players ?? [], seasons: d.seasons ?? [], games: d.games ?? [], seasonId: d.seasonId ?? d.seasons?.[0]?.id ?? '' }),
    }),
    {
      name: 'basket-stats-v1',
      version: 2,
      // v2: via le partite di prova/vecchie, resta il roster
      migrate: (old, v) => (v < 2 ? { ...(old as State), games: [] } : (old as State)),
    },
  ),
)

export const playerName = (p?: Player) => (p ? `${p.last} ${p.first}` : '')
export const shortName = (p?: Player) => (p ? `${p.first[0]}. ${p.last}` : '')
