import { useState } from 'react'
import { Ic } from '../ui'
import { useStore } from '../store'
import { Modal, Field, go } from '../ui'
import { AccountModal, SyncBadge } from './Account'
import { cloudEnabled } from '../cloud'
import { ROLE_LABEL, TeamsModal } from './Teams'
import { ColorPicker } from './Setup'
import { buildGame, parseBrpCsv } from '../importBrp'
import { uid } from '../store'

export default function Dashboard() {
  const { clubName, brandColor, seasons, seasonId, setClubName, setBrandColor, resetAll, importAll } = useStore()
  const role = useStore((s) => s.clubs[s.activeId]?.role)
  const canEdit = role !== 'viewer'
  const [teams, setTeams] = useState(false)
  const season = seasons.find((s) => s.id === seasonId)
  const [open, setOpen] = useState(false)
  const [acc, setAcc] = useState(false)
  const [name, setName] = useState(clubName)
  const backup = () => {
    const { clubName, players, seasons, games, seasonId } = useStore.getState()
    const blob = new Blob([JSON.stringify({ clubName, players, seasons, games, seasonId }, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `basket-stats-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  const restore = async (f?: File) => {
    if (!f) return
    try {
      const d = JSON.parse(await f.text())
      if (!Array.isArray(d.players) || !Array.isArray(d.games)) throw new Error()
      if (confirm('Sostituire tutti i dati attuali con quelli del backup?')) { importAll(d); setOpen(false) }
    } catch { alert('File di backup non valido') }
  }
  const [importMsg, setImportMsg] = useState('')
  const importCsv = async (files: FileList | null) => {
    if (!files?.length) return
    const st = useStore.getState()
    const season = st.seasons.find((s) => s.id === st.seasonId)
    if (!season) { setImportMsg('Crea prima una stagione.'); return }
    const out: string[] = []
    let players = st.players
    let roster = season.roster
    const games = [...st.games]
    for (const f of Array.from(files)) {
      try {
        const parsed = parseBrpCsv(await f.text())
        if (games.some((g) => g.seasonId === season.id && g.date === parsed.date && g.opponent.toLowerCase() === parsed.opponent.toLowerCase())) {
          out.push(`⏭ ${parsed.opponent} (${parsed.date}): già presente, saltata.`)
          continue
        }
        const r = buildGame(parsed, { ...season, roster }, players, uid)
        for (const np of r.newPlayers) {
          if (!players.some((p) => p.id === np.player.id)) players = [...players, np.player]
          roster = [...roster, { playerId: np.player.id, number: np.number }]
        }
        games.push(r.game)
        out.push(`✓ ${parsed.opponent} ${parsed.us}-${parsed.opp}${r.newPlayers.length ? ` · ${r.newPlayers.length} nuovi giocatori` : ''}${r.warnings.length ? ` · ⚠ ${r.warnings[0]}` : ''}`)
      } catch (e) {
        out.push(`✗ ${f.name}: ${e instanceof Error ? e.message : 'errore'}`)
      }
    }
    useStore.setState({ players, games, seasons: st.seasons.map((s) => (s.id === season.id ? { ...s, roster } : s)) })
    setImportMsg(out.join('\n'))
  }
  const initials = clubName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 40%) 1fr', minHeight: '100vh' }}>
      <div style={{ background: 'var(--brand)', color: '#fff', padding: '60px 36px', position: 'relative' }}>
        <div style={{ fontFamily: 'var(--display)', letterSpacing: '.3em', fontWeight: 700, fontSize: 18 }}>BASKET STATS</div>
        <div style={{ width: 130, height: 130, borderRadius: '50%', border: '3px solid #fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 56, margin: '50px 0 24px' }}>
          {initials}
        </div>
        <h1 style={{ fontSize: 76, lineHeight: 0.95 }}>{clubName}</h1>
        {season && <div style={{ marginTop: 14, opacity: .9 }}>{season.year} · {season.category}</div>}
      </div>
      <div className="page" style={{ paddingTop: 40 }}>
        {cloudEnabled && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="pill" style={{ background: 'var(--brand)' }} onClick={() => setTeams(true)}><Ic name="swap" /> Squadre{role ? ` · ${ROLE_LABEL[role]}` : ''}</button>
            <button className="pill" style={{ background: 'var(--brand)' }} onClick={() => setAcc(true)}><SyncBadge /></button>
          </div>
        )}
        <div className="grid2">
          <button className="card tile" onClick={() => go('/seasons')}>
            <div><h2>Stagioni</h2><div className="hint">Partite e statistiche</div></div>
            <div className="big">{seasons.length}</div>
          </button>
          <button className="card tile" onClick={() => go('/roster')}>
            <div><h2>Giocatori</h2><div className="hint">Rosa e profili</div></div>
            <div className="big">{season?.roster.length ?? 0}</div>
          </button>
        </div>
        <div className="section-title">Accesso rapido</div>
        <div className="card list">
          <button className="list-row" onClick={() => go('/games')}>
            <span className="ico"><Ic name="ball" size={24} /></span><div><div className="t">Partite</div><div className="s">Registra una partita dal vivo</div></div>
          </button>
          <button className="list-row" onClick={() => go('/stats/season')}>
            <span className="ico"><Ic name="chart" size={24} /></span><div><div className="t">Statistiche stagione</div><div className="s">Totali e medie del roster</div></div>
          </button>
          <button className="list-row" onClick={() => { setName(clubName); setOpen(true) }}>
            <span className="ico"><Ic name="gear" size={24} /></span><div><div className="t">Impostazioni</div><div className="s">Nome del club, dati</div></div>
          </button>
        </div>
      </div>
      {teams && <TeamsModal onClose={() => setTeams(false)} />}
      {acc && <AccountModal onClose={() => setAcc(false)} />}
      {open && (
        <Modal title="Impostazioni" onClose={() => setOpen(false)}>
          {!canEdit && <p style={{ color: 'var(--muted)' }}>Hai accesso in sola lettura a questa squadra: puoi consultare tutto ma non modificare.</p>}
          {canEdit && <Field label="Nome del club"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          {canEdit && <div className="field"><label>Colore della squadra</label><ColorPicker value={brandColor} onChange={setBrandColor} /></div>}
          {canEdit && (<>
          <div className="section-title" style={{ marginTop: 6 }}>Importa da Basket Recorder Pro</div>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 8px' }}>Scegli uno o più file CSV di partita. Le partite entrano nella stagione corrente; i giocatori si abbinano dal numero di maglia.</p>
          <div className="row-actions" style={{ marginTop: 0, marginBottom: 10 }}>
            <label className="btn ghost"><Ic name="upload" /> Importa partite (CSV)<input type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => { void importCsv(e.target.files); e.target.value = '' }} /></label>
          </div>
          {importMsg && <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 12, margin: '0 0 14px', userSelect: 'text' }}>{importMsg}</pre>}
          </>)}
          <div className="section-title" style={{ marginTop: 6 }}>Backup</div>
          <div className="row-actions" style={{ marginTop: 0, marginBottom: 18 }}>
            <button className="btn ghost" onClick={backup}><Ic name="download" /> Esporta backup</button>
            {canEdit && <label className="btn ghost"><Ic name="upload" /> Importa backup<input type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} /></label>}
          </div>
          <div className="row-actions">
            {canEdit && <button className="btn" onClick={() => { setClubName(name.trim() || clubName); setOpen(false) }}>Salva</button>}
            {canEdit && <button className="btn danger" onClick={() => { if (confirm('Cancellare TUTTI i dati (squadra, giocatori, partite) da questo dispositivo? Fai prima un backup se ti serve.')) { resetAll(); setOpen(false) } }}>Azzera dati</button>}
          </div>
        </Modal>
      )}
    </div>
  )
}
