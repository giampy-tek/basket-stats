import { create } from 'zustand'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './cloudConfig'
import { useStore, type Role } from './store'
import type { Game } from './types'

/*
 * Sincronizzazione offline-first per SQUADRA. L'app lavora sempre sui dati locali; quando c'è rete
 * i documenti modificati (club + una riga per partita) vanno su Supabase e quelli più recenti
 * vengono scaricati. Conflitto = vince la modifica più recente. Chi ha il ruolo "viewer" scarica
 * soltanto. Si sincronizza la squadra attiva; le altre al momento in cui si aprono.
 */

export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
export const client: SupabaseClient | null = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

type Status = 'off' | 'idle' | 'syncing' | 'offline' | 'error'
interface CloudState {
  email: string | null
  status: Status
  lastSync: number | null
  error: string
  ready: boolean // sessione già letta (evita il lampo della schermata di login)
}
export const useCloud = create<CloudState>(() => ({ email: null, status: cloudEnabled ? 'idle' : 'off', lastSync: null, error: '', ready: !cloudEnabled }))
const setCloud = (p: Partial<CloudState>) => useCloud.setState(p)

// ---- stato di sync locale, uno per squadra ----
interface TeamMeta {
  cursor: string
  mod: Record<string, number> // ultima modifica locale per documento
  del: Record<string, number> // cancellazioni locali (tombstone)
  pushed: Record<string, number> // ultima versione già allineata con il cloud
  adopt?: boolean // primo allineamento: i dati del cloud sono quelli giusti
}
const KEY = 'basket-stats-sync2'
const EPOCH = '1970-01-01T00:00:00.000Z'
const fresh = (): TeamMeta => ({ cursor: EPOCH, mod: {}, del: {}, pushed: {} })
let metas: Record<string, TeamMeta> = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '') as Record<string, TeamMeta> } catch { return {} }
})()
const metaFor = (id: string) => (metas[id] ??= fresh())
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(metas)) } catch { /* quota */ } }

let applying = false
let userId = ''
let timer: ReturnType<typeof setTimeout> | undefined

const activeTeam = () => {
  const s = useStore.getState()
  return { id: s.activeId, role: s.clubs[s.activeId]?.role }
}
const canWrite = (role?: Role) => role === 'owner' || role === 'editor'

const schedule = (ms = 2500) => {
  if (!client || !userId || activeTeam().id === 'local') return
  clearTimeout(timer)
  timer = setTimeout(() => void sync(), ms)
}

// ---- traccia le modifiche locali alla squadra attiva ----
let prev = useStore.getState()
useStore.subscribe((s) => {
  const p = prev
  prev = s
  // cambio squadra o collegamento: non sono modifiche ai dati
  if (applying || s.activeId !== p.activeId || s.activeId === 'local') return
  if (!canWrite(s.clubs[s.activeId]?.role)) return
  const m = metaFor(s.activeId)
  const now = Date.now()
  if (s.clubName !== p.clubName || s.brandColor !== p.brandColor || s.players !== p.players || s.seasons !== p.seasons || s.seasonId !== p.seasonId) {
    m.mod.club = now
  }
  const before = new Map(p.games.map((g) => [g.id, g]))
  for (const g of s.games) if (before.get(g.id) !== g) { m.mod['game:' + g.id] = now; delete m.del['game:' + g.id] }
  const ids = new Set(s.games.map((g) => g.id))
  for (const g of p.games) if (!ids.has(g.id)) { m.del['game:' + g.id] = now; delete m.mod['game:' + g.id] }
  save()
  schedule()
})

const pristine = () => {
  const s = useStore.getState()
  return s.players.length === 0 && s.games.length === 0
}
const clubDoc = (mod: number) => {
  const { clubName, brandColor, players, seasons, seasonId } = useStore.getState()
  return { clubName, brandColor, players, seasons, seasonId, _mod: mod }
}

interface Row { id: string; kind: string; data: (Record<string, unknown> & { _mod?: number }) | null; deleted: boolean; updated_at: string }

function applyRemote(row: Row) {
  applying = true
  try {
    if (row.id === 'club') {
      if (row.data && !row.deleted) {
        const { clubName, brandColor, players, seasons, seasonId } = row.data as never as ReturnType<typeof clubDoc>
        useStore.setState({ clubName, brandColor: brandColor ?? '#b5440c', players, seasons, seasonId })
      }
    } else {
      const gid = row.id.replace(/^game:/, '')
      if (row.deleted || !row.data) {
        useStore.setState((s) => ({ games: s.games.filter((g) => g.id !== gid) }))
      } else {
        const { _mod, ...game } = row.data
        void _mod
        useStore.setState((s) => ({
          games: s.games.some((g) => g.id === gid) ? s.games.map((g) => (g.id === gid ? (game as unknown as Game) : g)) : [...s.games, game as unknown as Game],
        }))
      }
    }
  } finally {
    applying = false
    prev = useStore.getState()
  }
}

let running = false
export async function sync() {
  const { id: teamId, role } = activeTeam()
  if (!client || !userId || teamId === 'local' || running) return
  if (!navigator.onLine) { setCloud({ status: 'offline' }); return }
  running = true
  setCloud({ status: 'syncing', error: '' })
  const meta = metaFor(teamId)
  try {
    // 1) scarica le novità
    const { data, error } = await client.from('team_docs').select('*').eq('team_id', teamId).gt('updated_at', meta.cursor).order('updated_at', { ascending: true }).limit(1000)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    for (const row of rows) {
      const local = meta.mod[row.id] ?? meta.del[row.id]
      const remoteMod = row.data?._mod ?? Date.parse(row.updated_at)
      if (local === undefined) {
        if (row.id === 'club' && !pristine() && !row.deleted && !meta.adopt && canWrite(role)) {
          const keepCloud = confirm('Nel cloud ci sono già dati di questa squadra.\nOK = usa quelli del cloud (sostituisce rosa e stagioni di questo dispositivo)\nAnnulla = carica quelli di questo dispositivo')
          if (!keepCloud) { meta.mod.club = Date.now(); continue }
        }
        applyRemote(row)
        meta.mod[row.id] = remoteMod
        meta.pushed[row.id] = remoteMod
      } else if (remoteMod > local) {
        applyRemote(row)
        delete meta.del[row.id]
        meta.mod[row.id] = remoteMod
        meta.pushed[row.id] = remoteMod
      }
      // altrimenti vince il locale: viene caricato sotto
    }
    if (rows.length) meta.cursor = rows[rows.length - 1].updated_at
    meta.adopt = false

    if (canWrite(role)) {
      // 2) documenti locali mai sincronizzati
      const st = useStore.getState()
      const now = Date.now()
      if (meta.mod.club === undefined && !pristine()) meta.mod.club = now
      for (const g of st.games) if (meta.mod['game:' + g.id] === undefined) meta.mod['game:' + g.id] = now

      // 3) carica le modifiche locali
      const up: { team_id: string; id: string; kind: string; data: unknown; deleted: boolean }[] = []
      const stamps: Record<string, number> = {}
      for (const [id, m] of Object.entries(meta.mod)) {
        if (m <= (meta.pushed[id] ?? 0)) continue
        if (id === 'club') up.push({ team_id: teamId, id, kind: 'club', data: clubDoc(m), deleted: false })
        else {
          const g = st.games.find((x) => 'game:' + x.id === id)
          if (!g) continue
          up.push({ team_id: teamId, id, kind: 'game', data: { ...g, _mod: m }, deleted: false })
        }
        stamps[id] = m
      }
      for (const [id, m] of Object.entries(meta.del)) {
        if (m <= (meta.pushed[id] ?? 0)) continue
        up.push({ team_id: teamId, id, kind: 'game', data: null, deleted: true })
        stamps[id] = m
      }
      if (up.length) {
        const { error: e2 } = await client.from('team_docs').upsert(up, { onConflict: 'team_id,id' })
        if (e2) throw e2
        Object.assign(meta.pushed, stamps)
      }
    }
    save()
    setCloud({ status: 'idle', lastSync: Date.now() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'errore'
    setCloud({ status: navigator.onLine ? 'error' : 'offline', error: msg })
  } finally {
    running = false
  }
}

// ---- squadre ----
const norm = (s: string) => s.trim().toLowerCase()

/** Scarica l'elenco delle squadre di cui sono membro e le allinea allo store. */
export async function refreshTeams(): Promise<string | null> {
  if (!client || !userId) return 'Non sei collegato'
  const { data, error } = await client.from('team_members').select('team_id, role, teams(name)')
  if (error) return error.message
  const list = (data ?? []).map((r) => {
    const t = (r as unknown as { teams: { name: string } | { name: string }[] | null }).teams
    return { id: r.team_id as string, role: r.role as Role, name: (Array.isArray(t) ? t[0]?.name : t?.name) ?? 'Squadra' }
  })
  const st = useStore.getState()
  // la squadra locale (solo su questo dispositivo) con lo stesso nome di una squadra del cloud ancora vuota qui: si collegano
  if (st.activeId === 'local' && st.clubName && !pristine()) {
    const match = list.find((x) => norm(x.name) === norm(st.clubName) && !st.clubs[x.id]?.data?.players.length)
    if (match) {
      useStore.getState().linkClub(match.id, match.role, match.name)
      metas[match.id] = { ...fresh(), adopt: true }
      save()
    }
  }
  useStore.getState().syncClubList(list)
  return null
}

async function rpcCreateTeam(name: string): Promise<{ id?: string; error?: string }> {
  if (!client) return { error: 'Cloud non configurato' }
  if (!navigator.onLine) return { error: 'Serve la connessione per creare la squadra nel cloud.' }
  const { data, error } = await client.rpc('create_team', { p_name: name })
  if (error) return { error: error.message }
  return { id: data as string }
}

/** Carica la squadra attiva (oggi solo su questo dispositivo) nel cloud. */
export async function uploadActiveClub(): Promise<string | null> {
  const st = useStore.getState()
  if (st.activeId !== 'local') return null
  const r = await rpcCreateTeam(st.clubName || 'Squadra')
  if (!r.id) return r.error ?? 'Errore'
  st.linkClub(r.id, 'owner', st.clubName)
  const m = (metas[r.id] = fresh())
  const now = Date.now()
  m.mod.club = now
  for (const g of useStore.getState().games) m.mod['game:' + g.id] = now
  save()
  void sync()
  return null
}

/** Crea una nuova squadra vuota nel cloud e la apre. */
export async function createCloudTeam(name: string, brandColor: string): Promise<{ id?: string; error?: string }> {
  const r = await rpcCreateTeam(name)
  if (!r.id) return r
  useStore.getState().addRemoteClub(r.id, 'owner', name, brandColor)
  const m = (metas[r.id] = fresh())
  m.mod.club = Date.now()
  save()
  return r
}

export function openTeam(id: string) {
  useStore.getState().switchClub(id)
  metaFor(id)
  void sync()
}

// ---- membri ----
export interface Member { user_id: string; email: string; role: Role }
export async function listMembers(teamId: string): Promise<{ members?: Member[]; error?: string }> {
  if (!client) return { error: 'Cloud non configurato' }
  const { data, error } = await client.rpc('list_members', { p_team: teamId })
  return error ? { error: error.message } : { members: (data ?? []) as Member[] }
}
const noCloud = { error: { message: 'Cloud non configurato' } }
export async function addMember(teamId: string, email: string, role: Role): Promise<string | null> {
  const { error } = (await client?.rpc('add_member', { p_team: teamId, p_email: email, p_role: role })) ?? noCloud
  return error ? error.message : null
}
export async function setMemberRole(teamId: string, user: string, role: Role): Promise<string | null> {
  const { error } = (await client?.rpc('set_member_role', { p_team: teamId, p_user: user, p_role: role })) ?? noCloud
  return error ? error.message : null
}
export async function removeMember(teamId: string, user: string): Promise<string | null> {
  const { error } = (await client?.rpc('remove_member', { p_team: teamId, p_user: user })) ?? noCloud
  return error ? error.message : null
}
export const currentUserId = () => userId

// ---- account ----
const errIt = (m: string) =>
  /Invalid login/i.test(m) ? 'Email o password non corretti.'
    : /already registered/i.test(m) ? 'Esiste già un account con questa email.'
    : /Password should be/i.test(m) ? 'La password deve avere almeno 6 caratteri.'
    : /Email not confirmed/i.test(m) ? 'Conferma prima l’email: ti abbiamo mandato un link.'
    : /rate limit/i.test(m) ? 'Troppi tentativi, riprova tra qualche minuto.'
    : m

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!client) return 'Cloud non configurato'
  const { error } = await client.auth.signInWithPassword({ email, password })
  return error ? errIt(error.message) : null
}

/** Ritorna { error } oppure { needsConfirm } se Supabase richiede la conferma email. */
export async function signUp(email: string, password: string): Promise<{ error?: string; needsConfirm?: boolean }> {
  if (!client) return { error: 'Cloud non configurato' }
  const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
  if (error) return { error: errIt(error.message) }
  return { needsConfirm: !data.session }
}

export async function resetPassword(email: string): Promise<string | null> {
  if (!client) return 'Cloud non configurato'
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
  return error ? errIt(error.message) : null
}

export async function signOut(clearLocal: boolean) {
  await client?.auth.signOut()
  if (clearLocal) {
    // iPad condiviso: toglie dal dispositivo i dati di tutte le squadre (restano nel cloud)
    applying = true
    useStore.getState().resetAll()
    applying = false
    prev = useStore.getState()
    metas = {}
    save()
  }
}

/** Cancella dal cloud tutti i documenti della squadra attiva (solo proprietario). I dati locali restano. */
export async function deleteCloudData(): Promise<string | null> {
  const { id, role } = activeTeam()
  if (!client || !userId || id === 'local') return 'Questa squadra non è nel cloud'
  if (role !== 'owner') return 'Solo il proprietario può cancellare i dati dal cloud'
  const { error } = await client.from('team_docs').delete().eq('team_id', id)
  if (error) return error.message
  metas[id] = fresh()
  save()
  return null
}

async function onUser(id: string, email: string) {
  const changed = userId !== id
  userId = id
  setCloud({ email, status: 'idle' })
  if (changed) {
    await refreshTeams()
    void sync()
  }
}

// La sessione resta salvata sul dispositivo: se l'app viene chiusa e riaperta (anche senza rete, con il
// token scaduto) si rientra subito, senza rifare il login. Si esce solo con "Esci" o se il cloud
// revoca l'accesso (evento SIGNED_OUT).
const storedKey = cloudEnabled ? `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token` : ''
function storedUser(): { id: string; email: string } | null {
  try {
    const s = JSON.parse(localStorage.getItem(storedKey) ?? '')
    return s?.user?.id ? { id: s.user.id as string, email: (s.user.email as string) ?? '' } : null
  } catch { return null }
}

if (client) {
  const stored = storedUser()
  if (stored) { void onUser(stored.id, stored.email); setCloud({ ready: true }) }
  client.auth.getSession().then(async ({ data }) => {
    if (data.session && data.session.user.id !== userId) await onUser(data.session.user.id, data.session.user.email ?? '')
    setCloud({ ready: true })
  }).catch(() => setCloud({ ready: true }))
  client.auth.onAuthStateChange((ev, session) => {
    if (session) { if (session.user.id !== userId) void onUser(session.user.id, session.user.email ?? '') }
    else if (ev === 'SIGNED_OUT') { userId = ''; setCloud({ email: null, status: 'idle', lastSync: null }) }
  })
  window.addEventListener('online', () => { schedule(500); void refreshTeams() })
  window.addEventListener('offline', () => userId && setCloud({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { schedule(500); void refreshTeams() } })
  setInterval(() => schedule(100), 60_000)
}
