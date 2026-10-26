import { useEffect, useState, type ReactNode, type MouseEvent } from 'react'
import { COURT_W, COURT_L, HOOP, R3, CORNER_X, CORNER_Y, PAINT, FT_R, RESTRICTED_R } from './court'

export function useRoute() {
  const [hash, setHash] = useState(() => location.hash.slice(1) || '/')
  useEffect(() => {
    const on = () => setHash(location.hash.slice(1) || '/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash.split('/').filter(Boolean)
}
export const go = (path: string) => { location.hash = path }

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export function fmtDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  if (!y) return d
  return `${day} ${MONTHS[m - 1]} ${y}`
}

export function Hero({ title, sub, back, right }: {
  title: string; sub?: string; back?: { label: string; to: string }; right?: ReactNode
}) {
  return (
    <div className="hero">
      <svg className="lines" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#fff" strokeWidth="2">
        <line x1="600" y1="-10" x2="600" y2="210" />
        <circle cx="600" cy="100" r="60" />
        <circle cx="600" cy="100" r="190" />
        <path d="M290 40 A 110 110 0 0 1 290 160" />
        <path d="M910 40 A 110 110 0 0 0 910 160" />
        <line x1="290" y1="-10" x2="290" y2="210" />
      </svg>
      <div className="row">
        {back ? <button className="pill" onClick={() => go(back.to)}>‹ {back.label}</button> : <span />}
        <div style={{ display: 'flex', gap: 10 }}>{right}</div>
      </div>
      <h1>{title}</h1>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

/** Mezzo campo in SVG, coordinate in metri. */
export function Court({ onTap, children, under, plain = false, lineWidth = 0.07, detail = true, hoopTop = true }: {
  onTap?: (x: number, y: number) => void; children?: ReactNode; under?: ReactNode; plain?: boolean; lineWidth?: number; detail?: boolean; hoopTop?: boolean
}) {
  const handle = (e: MouseEvent<SVGSVGElement>) => {
    if (!onTap) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * COURT_W
    const y = ((e.clientY - r.top) / r.height) * COURT_L
    onTap(Math.min(COURT_W, Math.max(0, x)), Math.min(COURT_L, Math.max(0, y)))
  }
  const L = 'rgba(255,255,255,.95)'
  const ftY = PAINT.y2
  void hoopTop
  return (
    <svg className="court-svg" viewBox={`0 0 ${COURT_W} ${COURT_L}`} onClick={handle}>
      {!plain && <rect x={PAINT.x1} y={0} width={PAINT.x2 - PAINT.x1} height={PAINT.y2} fill="var(--paint)" />}
      {under}
      <g fill="none" stroke={L} strokeWidth={lineWidth} strokeLinecap="round" strokeLinejoin="round">
        {detail && <rect x={PAINT.x1} y={0} width={PAINT.x2 - PAINT.x1} height={PAINT.y2} />}
        {detail && <path d={`M ${HOOP.x - FT_R} ${ftY} A ${FT_R} ${FT_R} 0 0 0 ${HOOP.x + FT_R} ${ftY}`} />}
        {detail && <path d={`M ${HOOP.x - FT_R} ${ftY} A ${FT_R} ${FT_R} 0 0 1 ${HOOP.x + FT_R} ${ftY}`} strokeDasharray="0.25 0.2" />}
        {detail && <path d={`M ${CORNER_X} 0 L ${CORNER_X} ${CORNER_Y} A ${R3} ${R3} 0 0 0 ${COURT_W - CORNER_X} ${CORNER_Y} L ${COURT_W - CORNER_X} 0`} />}
        {detail && <path d={`M ${HOOP.x - RESTRICTED_R} ${HOOP.y} A ${RESTRICTED_R} ${RESTRICTED_R} 0 0 0 ${HOOP.x + RESTRICTED_R} ${HOOP.y}`} />}
        <line x1={HOOP.x - 0.9} y1={0.6} x2={HOOP.x + 0.9} y2={0.6} />
        <circle cx={HOOP.x} cy={HOOP.y} r={0.23} />
      </g>
      {children}
    </svg>
  )
}

export function ShotDot({ x, y, made, label, r = 0.36 }: { x: number; y: number; made: boolean; label?: string; r?: number }) {
  // il numero va al centro esatto del cerchio: niente dominantBaseline (Safari lo interpreta male), si usa dy
  const size = r * (label && label.length >= 2 ? 1.12 : 1.4)
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={made ? '#1f7a45' : '#c0252d'} stroke="#fff" strokeWidth={0.06} />
      {label && (
        <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={size} fontWeight={700} fill="#fff" style={{ fontFamily: 'var(--body)', pointerEvents: 'none' }}>
          {label}
        </text>
      )}
    </g>
  )
}

export function Avatar({ photo, size = 52, label }: { photo?: string; size?: number; label?: string }) {
  if (photo) return <img src={photo} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: size / 4, objectFit: 'cover', flex: 'none' }} />
  return (
    <span style={{ width: size, height: size, borderRadius: size / 4, background: 'linear-gradient(#cfc8c0,#8f867d)', display: 'grid', placeItems: 'center', flex: 'none', color: '#fff', fontSize: size * 0.4, fontWeight: 700 }}>
      {label ?? <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>}
    </span>
  )
}

const ICONS: Record<string, string> = {
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.7 5.7c3 3 3 9.6 0 12.6M18.3 5.7c-3 3-3 9.6 0 12.6"/>',
  chart: '<path d="M5 20V11M12 20V4M19 20v-6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  clipboard: '<rect x="5.5" y="4" width="13" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 17V5M7 9l5-5 5 5M4 21h16"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5l3 3L8 19zM14 7l3 3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14c2.7 0 4.5 2 4.5 5"/>',
  swap: '<path d="M4 8h14M14.5 4L18.500 8l-4 4M20 16H6M9.5 12L5.500 16l4 4"/>',
  trash: '<path d="M4 7h16M9.500 7V4h5v3M6.500 7l1 13h9l1-13M10 11v6M14 11v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.5-5.800M20 4v5h-5"/>',
  reopen: '<path d="M4 12a8 8 0 1 0 2.500-5.800M4 4v5h5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
}

/** Icona SVG: prende il colore del testo (currentColor), quindi segue il colore della squadra dove serve. */
export function Ic({ name, size }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? '' }} />
  )
}
