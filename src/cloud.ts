import { create } from 'zustand'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './cloudConfig'
import { useStore } from './store'
import type { Game } from './types'

/*
 * Sincronizzazione offline-first: l'app lavora sempre sui dati locali; quando c'è rete e un
 * account, i documenti modificati (club + una riga per partita) vengono caricati su Supabase e
 * quelli più recenti dal cloud vengono scaricati. Conflitto = vince la modifica più recente.
 */

export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const client: SupabaseClient | null = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

type Status = 'off' | 'idle' | 'syncing' | 'offline' | 'error'
interface CloudState {
  email: string | null
  status: Status
  lastSync: number | null
  error: string
}
export const useCloud = create<CloudState>(() => ({ email: null, status: cloudEnabled ? 'idle' : 'off', lastSync: null, error: '' }))
const setCloud = (p: Partial<CloudState>) => useCloud.setState(p)

// ---- stato di sync locale (per utente) ----
interface SyncMeta {
  user: string
  cursor: string
  mod: Record<string, number> // ultima modifica locale per documento
  del: Record<string, number> // cancellazioni locali (tombstone)
  pushed: Record<string, number> // ultima versione già allineata con il cloud
}
const KEY = 'basket-stats-sync'
const EPOCH = '1970-01-01T00:00:00.000Z'
const fresh = (user = ''): SyncMeta => ({ user, cursor: EPOCH, mod: {}, del: {}, pushed: {} })
let meta: SyncMeta = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '') as SyncMeta } catch { return fresh() }
})()
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(meta)) } catch { /* quota */ } }

let applying = false
let userId = ''
let timer: ReturnType<typeof setTimeout> | undefined

const schedule = (ms = 2500) => {
  if (!client || !userId) return
  clearTimeout(timer)
  timer = setTimeout(() => void sync(), ms)
}

// ---- traccia le modifiche locali ----
let prev = useStore.getState()
useStore.subscribe((s) => {
  if (!applying) {
    const p = prev
    const now = Date.now()
    if (s.clubName !== p.clubName || s.players !== p.players || s.seasons !== p.seasons || s.seasonId !== p.seasonId) {
      meta.mod.club = now
    }
    const before = new Map(p.games.map((g) => [g.id, g]))
    for (const g of s.games) if (before.get(g.id) !== g) { meta.mod['game:' + g.id] = now; delete meta.del['game:' + g.id] }
    const ids = new Set(s.games.map((g) => g.id))
    for (const g of p.games) if (!ids.has(g.id)) { meta.del['game:' + g.id] = now; delete meta.mod['game:' + g.id] }
    save()
    schedule()
  }
  prev = s
})

const pristine = () => {
  const s = useStore.getState()
  return s.players.length === 0 && s.games.length === 0
}
const clubDoc = (mod: number) => {
  const { clubName, players, seasons, seasonId } = useStore.getState()
  return { clubName, players, seasons, seasonId, _mod: mod }
}

interface Row { id: string; kind: string; data: (Record<string, unknown> & { _mod?: number }) | null; deleted: boolean; updated_at: string }

function applyRemote(row: Row) {
  applying = true
  try {
    if (row.id === 'club') {
      if (row.data && !row.deleted) {
        const { clubName, players, seasons, seasonId } = row.data as never as ReturnType<typeof clubDoc>
        useStore.setState({ clubName, players, seasons, seasonId })
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
  if (!client || !userId || running) return
  if (!navigator.onLine) { setCloud({ status: 'offline' }); return }
  running = true
  setCloud({ status: 'syncing', error: '' })
  try {
    // 1) scarica le novità
    const { data, error } = await client.from('docs').select('*').gt('updated_at', meta.cursor).order('updated_at', { ascending: true }).limit(1000)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    for (const row of rows) {
      const local = meta.mod[row.id] ?? meta.del[row.id]
      const remoteMod = row.data?._mod ?? Date.parse(row.updated_at)
      if (local === undefined) {
        if (row.id === 'club' && !pristine() && !row.deleted) {
          const keepCloud = confirm('Nel cloud ci sono già dati di questo account.\nOK = usa quelli del cloud (sostituisce rosa e stagioni di questo dispositivo)\nAnnulla = carica quelli di questo dispositivo')
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

    // 2) documenti locali mai sincronizzati
    const st = useStore.getState()
    const now = Date.now()
    if (meta.mod.club === undefined && !pristine()) meta.mod.club = now
    for (const g of st.games) if (meta.mod['game:' + g.id] === undefined) meta.mod['game:' + g.id] = now

    // 3) carica le modifiche locali
    const up: { user_id: string; id: string; kind: string; data: unknown; deleted: boolean }[] = []
    const stamps: Record<string, number> = {}
    for (const [id, m] of Object.entries(meta.mod)) {
      if (m <= (meta.pushed[id] ?? 0)) continue
      if (id === 'club') up.push({ user_id: userId, id, kind: 'club', data: clubDoc(m), deleted: false })
      else {
        const g = st.games.find((x) => 'game:' + x.id === id)
        if (g) up.push({ user_id: userId, id, kind: 'game', data: { ...g, _mod: m }, deleted: false })
        else continue
      }
      stamps[id] = m
    }
    for (const [id, m] of Object.entries(meta.del)) {
      if (m <= (meta.pushed[id] ?? 0)) continue
      up.push({ user_id: userId, id, kind: 'game', data: null, deleted: true })
      stamps[id] = m
    }
    if (up.length) {
      const { error: e2 } = await client.from('docs').upsert(up, { onConflict: 'user_id,id' })
      if (e2) throw e2
      Object.assign(meta.pushed, stamps)
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
    // iPad condiviso: toglie i dati di questo account dal dispositivo (restano nel cloud)
    applying = true
    useStore.getState().resetAll()
    applying = false
    prev = useStore.getState()
    meta = fresh()
    save()
  }
}

/** Cancella dal cloud tutti i dati dell'account (restano quelli locali). */
export async function deleteCloudData(): Promise<string | null> {
  if (!client || !userId) return 'Non sei collegato'
  const { error } = await client.from('docs').delete().eq('user_id', userId)
  if (error) return error.message
  meta = fresh(userId)
  save()
  return null
}

function onUser(id: string, email: string) {
  userId = id
  if (meta.user !== id) { meta = fresh(id) ; save() } // altro account: riparti da zero
  setCloud({ email, status: 'idle' })
  void sync()
}

if (client) {
  client.auth.getSession().then(({ data }) => {
    if (data.session) onUser(data.session.user.id, data.session.user.email ?? '')
  })
  client.auth.onAuthStateChange((_ev, session) => {
    if (session) { if (session.user.id !== userId) onUser(session.user.id, session.user.email ?? '') }
    else { userId = ''; setCloud({ email: null, status: 'idle', lastSync: null }) }
  })
  window.addEventListener('online', () => schedule(500))
  window.addEventListener('offline', () => userId && setCloud({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(500) })
  setInterval(() => schedule(100), 60_000)
}
