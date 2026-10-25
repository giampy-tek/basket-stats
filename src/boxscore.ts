import type { Game, Player, Season } from './types'
import { computeGame, fmtTime, pct, rt } from './stats'

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const DAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']

/** Disegna il tabellino su canvas e restituisce il PNG. */
export async function boxscorePng(game: Game, season: Season, players: Player[], clubName: string): Promise<Blob> {
  await document.fonts.ready
  const gs = computeGame(game)
  const rows = [...season.roster]
    .sort((a, b) => a.number - b.number)
    .map((r) => ({ r, p: players.find((x) => x.id === r.playerId), s: gs.players[r.playerId] }))
    .filter((x) => x.s && (x.s.min > 0 || x.s.pts > 0 || x.s.a2 + x.s.a3 + x.s.af + x.s.f + x.s.fs + x.s.ro + x.s.rd + x.s.rec + x.s.pp + x.s.ass + x.s.sm + x.s.ss > 0))
  const top = Math.max(0, ...rows.map((x) => x.s.pts))

  const W = 1600, HEAD = 160, TH = 84, RH = 56
  const H = HEAD + TH + RH * (rows.length + 2) + 120
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  const DISP = "'Barlow Condensed', 'Arial Narrow', sans-serif"
  const BODY = "'Inter', -apple-system, system-ui, sans-serif"
  const BRAND = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#b5440c', INK = '#2a1f1a', MUTED = '#7a6a60', LINE = '#e6dfd7'

  g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, W, H)
  g.fillStyle = BRAND; g.fillRect(0, 0, W, HEAD)

  const [y, m, d] = game.date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const text = (t: string, x: number, yy: number, font: string, color: string, align: CanvasTextAlign = 'left') => {
    g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(t, x, yy)
  }
  const spaced = (t: string, x: number, yy: number, font: string, color: string) => {
    g.font = font; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle'
    ;(g as unknown as { letterSpacing: string }).letterSpacing = '4px'
    g.fillText(t, x, yy)
    ;(g as unknown as { letterSpacing: string }).letterSpacing = '0px'
  }
  spaced(`${season.year} ${season.category}`.toUpperCase() + ' · TABELLINO', 48, 42, `600 20px ${DISP}`, 'rgba(255,255,255,.8)')
  const home = game.home
  const title = home ? `${clubName} – ${game.opponent}` : `${game.opponent} – ${clubName}`
  text(title, 48, 82, `700 46px ${DISP}`, '#fff')
  text(`${DAYS[dt.getDay()]} ${d} ${MONTHS[m - 1]} ${y} · ${home ? 'in casa' : 'in trasferta'}`, 48, 120, `400 20px ${BODY}`, 'rgba(255,255,255,.8)')
  const score = home ? `${gs.us} – ${gs.opp}` : `${gs.opp} – ${gs.us}`
  const nq = Math.max(4, game.quarter)
  const bw = 68, bx0 = W - 48 - nq * (bw + 6) + 6
  text(score, bx0 - 36, 80, `700 96px ${DISP}`, '#fff', 'right')
  for (let i = 1; i <= nq; i++) {
    const x = bx0 + (i - 1) * (bw + 6)
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(x, 40, bw, 82, 10); g.fill()
    text(i <= 4 ? `${i}°Q` : `OT${i - 4}`, x + bw / 2, 56, `600 14px ${BODY}`, 'rgba(255,255,255,.8)', 'center')
    const [a, b] = home ? [gs.perQ.us[i], gs.perQ.opp[i]] : [gs.perQ.opp[i], gs.perQ.us[i]]
    text(String(a), x + bw / 2, 82, `700 26px ${DISP}`, '#fff', 'center')
    text(String(b), x + bw / 2, 106, `700 26px ${DISP}`, '#fff', 'center')
  }

  // colonne: [titolo, larghezza, gruppo]
  const cols: [string, number, string][] = [
    ['Pt', 56, ''], ['Min', 84, ''],
    ['S', 46, 'TIRI DA 2'], ['T', 46, 'TIRI DA 2'], ['%', 84, 'TIRI DA 2'],
    ['S', 46, 'TIRI DA 3'], ['T', 46, 'TIRI DA 3'], ['%', 84, 'TIRI DA 3'],
    ['S', 46, 'TIRI LIBERI'], ['T', 46, 'TIRI LIBERI'], ['%', 84, 'TIRI LIBERI'],
    ['F', 46, 'FALLI'], ['S', 46, 'FALLI'],
    ['RO', 50, 'RIMBALZI'], ['RD', 50, 'RIMBALZI'], ['RT', 50, 'RIMBALZI'],
    ['Rec', 54, ''], ['PP', 50, ''], ['Ass', 54, ''],
    ['SM', 54, 'STOPPATE'], ['SS', 54, 'STOPPATE'], ['VAL', 62, ''], ['+/-', 62, ''],
  ]
  const tableW = W - 96
  const fixed = 120 + 52
  const sum = cols.reduce((a, x) => a + x[1], 0)
  const k = (tableW - fixed) / sum
  const xs: number[] = []
  let cx = 48 + fixed
  for (const col of cols) { xs.push(cx); cx += col[1] * k }
  const right = (i: number) => xs[i] + cols[i][1] * k - 10

  const T = HEAD + 18
  g.fillStyle = '#fff'; g.beginPath(); g.roundRect(48, T, tableW, TH + RH * (rows.length + 1) , 18); g.fill()
  // gruppi
  const groups = [...new Set(cols.map((x) => x[2]).filter(Boolean))]
  for (const gname of groups) {
    const idx = cols.map((x, i) => (x[2] === gname ? i : -1)).filter((i) => i >= 0)
    const x1 = xs[idx[0]], x2 = right(idx[idx.length - 1]) + 10
    spaced(gname, (x1 + x2) / 2 - gname.length * 4.2, T + 24, `700 15px ${BODY}`, BRAND)
  }
  text('N°', 48 + 28, T + 58, `600 17px ${BODY}`, MUTED, 'center')
  text('Giocatore', 48 + 70, T + 58, `600 17px ${BODY}`, MUTED)
  cols.forEach((col, i) => text(col[0], right(i), T + 58, `600 17px ${BODY}`, MUTED, 'right'))
  g.fillStyle = LINE; g.fillRect(48, T + TH - 6, tableW, 1)

  const line = (yy: number) => { g.fillStyle = LINE; g.fillRect(48, yy, tableW, 1) }
  const vals = (s: ReturnType<typeof computeGame>['total'], isTeam = false) => {
    const pm = s.pm > 0 ? `+${s.pm}` : String(s.pm)
    return [
      isTeam ? '' : s.pts, isTeam ? '' : fmtTime(s.min),
      isTeam ? '' : s.m2, isTeam ? '' : s.a2, isTeam ? '' : pct(s.m2, s.a2),
      isTeam ? '' : s.m3, isTeam ? '' : s.a3, isTeam ? '' : pct(s.m3, s.a3),
      isTeam ? '' : s.mf, isTeam ? '' : s.af, isTeam ? '' : pct(s.mf, s.af),
      s.f, isTeam ? 0 : s.fs, s.ro, s.rd, rt(s), s.rec, s.pp,
      isTeam ? '' : s.ass, isTeam ? '' : s.sm, isTeam ? '' : s.ss, isTeam ? '' : s.val, isTeam ? '' : pm,
    ].map(String)
  }
  let yy = T + TH
  rows.forEach(({ r, p, s }) => {
    const mid = yy + RH / 2
    const star = s.pts === top && top > 0
    text(String(r.number), 48 + 40, mid, `600 24px ${DISP}`, star ? BRAND : MUTED, 'right')
    text(p ? `${p.first[0]}. ${p.last}` : '?', 48 + 70, mid, `${star ? 700 : 500} 22px ${BODY}`, star ? BRAND : INK)
    vals(s).forEach((v, i) => text(v, right(i), mid, `${i === 0 ? 600 : 400} 22px ${BODY}`, v === '–' ? MUTED : INK, 'right'))
    yy += RH; line(yy)
  })
  // squadra
  g.fillStyle = '#f4f1ec'; g.fillRect(48, yy, tableW, RH)
  text('Squadra', 48 + 70, yy + RH / 2, `500 22px ${BODY}`, MUTED)
  vals(gs.team, true).forEach((v, i) => text(v, right(i), yy + RH / 2, `400 22px ${BODY}`, INK, 'right'))
  yy += RH
  // totale
  g.fillStyle = INK; g.beginPath(); g.roundRect(48, yy, tableW, RH, [0, 0, 18, 18]); g.fill()
  text('Totale', 48 + 70, yy + RH / 2, `700 22px ${BODY}`, '#fff')
  vals(gs.total).forEach((v, i) => text(i === 0 ? String(gs.us) : v, right(i), yy + RH / 2, `700 22px ${BODY}`, '#fff', 'right'))
  yy += RH

  text('S segnati · T tentati · F falli fatti · S subiti · RO/RD/RT rimbalzi offensivi, difensivi, totali · Rec recuperi · PP palle perse', 48, yy + 56, `400 16px ${BODY}`, MUTED)
  text('Ass assist · SM/SS stoppate messe/subite · VAL valutazione · +/- del totale: scarto di punti', 48, yy + 82, `400 16px ${BODY}`, MUTED)
  text('Basket Stats', W - 48, yy + 70, `700 28px ${DISP}`, BRAND, 'right')

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG non generato'))), 'image/png'))
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: filename }); return } catch { /* annullato: scarica */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
