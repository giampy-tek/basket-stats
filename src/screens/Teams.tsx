import { useEffect, useState } from 'react'
import { useStore, type Role } from '../store'
import { Field, Modal, go } from '../ui'
import { ColorPicker } from './Setup'
import { addMember, cloudEnabled, createCloudTeam, currentUserId, listMembers, openTeam, removeMember, setMemberRole, uploadActiveClub, useCloud, type Member } from '../cloud'

export const ROLE_LABEL: Record<Role, string> = { owner: 'Proprietario', editor: 'Può modificare', viewer: 'Sola lettura' }
const seasonYear = () => {
  const d = new Date()
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}/${y + 1}`
}

/** Elenco delle squadre di questo account: cambia squadra, creane una nuova, caricala nel cloud. */
export function TeamsModal({ onClose }: { onClose: () => void }) {
  const { activeId, clubs, clubName, addSeason, brandColor } = useStore()
  const { email, status } = useCloud()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('#1f4fa3')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const items = Object.values(clubs).filter((c) => c.id !== activeId)
  const active = { id: activeId, name: clubName || clubs[activeId]?.name || 'Squadra', role: clubs[activeId]?.role }
  const all = [active, ...items]
  const roleText = (id: string, role?: Role) => (id === 'local' ? 'Solo su questo dispositivo' : role ? ROLE_LABEL[role] : '')

  const create = async () => {
    if (!name.trim()) return
    setBusy(true); setMsg('')
    const r = await createCloudTeam(name.trim(), color)
    if (r.error) { setMsg(r.error); setBusy(false); return }
    addSeason({ year: seasonYear(), category: category.trim(), coach: '', vice: '', shirt1: color, shirt2: '#FFFFFF' })
    setBusy(false)
    onClose()
  }

  return (
    <Modal title="Le tue squadre" onClose={onClose}>
      <div className="card list" style={{ marginBottom: 14 }}>
        {all.map((c) => (
          <button key={c.id} className="list-row" onClick={() => { if (c.id !== activeId) openTeam(c.id); onClose() }}>
            <span className="ico" style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 20 }}>{c.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <div className="t">{c.name}</div>
              <div className="s">{roleText(c.id, c.role)}</div>
            </div>
            {c.id === activeId && <span className="chip live" style={{ marginLeft: 'auto' }}>Aperta</span>}
          </button>
        ))}
      </div>
      {activeId === 'local' && cloudEnabled && email && clubName && (
        <div className="card pad" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600 }}>Questa squadra è solo su questo dispositivo</div>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 10px' }}>Caricala nel cloud per ritrovarla su altri dispositivi e poterla condividere.</p>
          <button className="btn small" disabled={busy || status === 'offline'} onClick={async () => { setBusy(true); setMsg((await uploadActiveClub()) ?? ''); setBusy(false) }}>⬆ Carica nel cloud</button>
        </div>
      )}
      {activeId !== 'local' && (
        <button className="btn ghost block" style={{ marginBottom: 10 }} onClick={() => { onClose(); go('/share') }}>👥 Membri e condivisione</button>
      )}
      {creating ? (
        <div className="card pad">
          <Field label="Nome della squadra"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Salzano U14 F" autoFocus /></Field>
          <Field label="Categoria (facoltativo)"><input value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
          <div className="field"><label>Colore</label><ColorPicker value={color} onChange={setColor} /></div>
          <div className="row-actions" style={{ marginTop: 0 }}>
            <button className="btn" disabled={!name.trim() || busy} onClick={create}>Crea squadra</button>
            <button className="btn ghost" onClick={() => setCreating(false)}>Annulla</button>
          </div>
        </div>
      ) : (
        cloudEnabled && email && <button className="btn block" onClick={() => { setColor(brandColor); setCreating(true) }}>＋ Nuova squadra</button>
      )}
      {msg && <p style={{ color: 'var(--red)', fontWeight: 500 }}>{msg}</p>}
    </Modal>
  )
}

/** Pagina "Membri e condivisione" della squadra attiva. */
export function Share() {
  const { activeId, clubs, clubName } = useStore()
  const role = clubs[activeId]?.role
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('editor')
  const [msg, setMsg] = useState('')
  const me = currentUserId()
  const isOwner = role === 'owner'

  const load = async () => {
    const r = await listMembers(activeId)
    if (r.error) setError(r.error); else { setMembers(r.members ?? []); setError('') }
  }
  useEffect(() => { if (activeId !== 'local') void load() }, [activeId])

  const run = async (p: Promise<string | null>) => { const e = await p; setMsg(e ?? ''); if (!e) await load() }

  return (
    <>
      <div className="top-nav">
        <button className="round" onClick={() => history.back()}>‹</button>
        <h1>Membri · {clubName}</h1><span style={{ width: 54 }} />
      </div>
      <div className="page stack" style={{ maxWidth: 760 }}>
        {activeId === 'local' && <div className="card pad">Questa squadra è solo su questo dispositivo. Caricala nel cloud dal menu delle squadre per poterla condividere.</div>}
        {error && <div className="card pad" style={{ color: 'var(--red)' }}>{error}</div>}
        {members && (
          <div className="card list">
            {members.map((m) => (
              <div key={m.user_id} className="list-row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div className="t">{m.email}{m.user_id === me ? ' (tu)' : ''}</div>
                  {!isOwner && <div className="s">{ROLE_LABEL[m.role]}</div>}
                </div>
                {isOwner ? (
                  <>
                    <select className="ev-sel" value={m.role} onChange={(e) => void run(setMemberRole(activeId, m.user_id, e.target.value as Role))}>
                      {(['owner', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button className="ev-btn del" title="Togli" onClick={() => { if (confirm(`Togliere ${m.email} dalla squadra?`)) void run(removeMember(activeId, m.user_id)) }}>✕</button>
                  </>
                ) : m.user_id === me && (
                  <button className="btn danger small" onClick={async () => { if (confirm('Uscire da questa squadra? Non potrai più vederla.')) { const e = await removeMember(activeId, m.user_id); if (e) setMsg(e); else { history.back() } } }}>Esci dalla squadra</button>
                )}
              </div>
            ))}
          </div>
        )}
        {isOwner && (
          <div className="card pad">
            <div className="section-title" style={{ margin: '0 0 10px' }}>Aggiungi una persona</div>
            <Field label="Email dell'account"><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.it" /></Field>
            <div className="seg" style={{ marginBottom: 12 }}>
              {(['editor', 'viewer', 'owner'] as Role[]).map((r) => <button key={r} className={newRole === r ? 'on' : ''} onClick={() => setNewRole(r)}>{ROLE_LABEL[r]}</button>)}
            </div>
            <button className="btn" disabled={!email.trim()} onClick={async () => { const e = await addMember(activeId, email.trim(), newRole); setMsg(e ?? ''); if (!e) { setEmail(''); await load() } }}>Aggiungi</button>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 0 }}>La persona deve già avere un account (lo crei tu in Supabase → Authentication → Users). Poi la inserisci qui con la sua email e il ruolo. “Sola lettura” vede tutto ma non può modificare nulla.</p>
          </div>
        )}
        {msg && <p style={{ color: 'var(--red)', fontWeight: 500 }}>{msg}</p>}
      </div>
    </>
  )
}
