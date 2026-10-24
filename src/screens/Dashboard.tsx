import { useState } from 'react'
import { useStore } from '../store'
import { go, Hero, Modal, Field } from '../ui'

export default function Dashboard() {
  const { clubName, seasons, seasonId, setClubName, resetAll, importAll } = useStore()
  const season = seasons.find((s) => s.id === seasonId)
  const [open, setOpen] = useState(false)
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
            <span className="ico">🏀</span><div><div className="t">Partite</div><div className="s">Registra una partita dal vivo</div></div>
          </button>
          <button className="list-row" onClick={() => go('/stats/season')}>
            <span className="ico">▥</span><div><div className="t">Statistiche stagione</div><div className="s">Totali e medie del roster</div></div>
          </button>
          <button className="list-row" onClick={() => { setName(clubName); setOpen(true) }}>
            <span className="ico">⚙</span><div><div className="t">Impostazioni</div><div className="s">Nome del club, dati</div></div>
          </button>
        </div>
      </div>
      {open && (
        <Modal title="Impostazioni" onClose={() => setOpen(false)}>
          <Field label="Nome del club"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="section-title" style={{ marginTop: 6 }}>Backup</div>
          <div className="row-actions" style={{ marginTop: 0, marginBottom: 18 }}>
            <button className="btn ghost" onClick={backup}>⬇ Esporta backup</button>
            <label className="btn ghost">⬆ Importa backup<input type="file" accept="application/json" hidden onChange={(e) => restore(e.target.files?.[0])} /></label>
          </div>
          <div className="row-actions">
            <button className="btn" onClick={() => { setClubName(name.trim() || clubName); setOpen(false) }}>Salva</button>
            <button className="btn danger" onClick={() => { if (confirm('Cancellare tutti i dati e ripartire dai dati iniziali?')) { resetAll(); setOpen(false) } }}>Azzera dati</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
