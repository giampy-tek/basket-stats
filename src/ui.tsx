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
export function Court({ onTap, children, under, plain = false, lineWidth = 0.07, hoopTop = true }: {
  onTap?: (x: number, y: number) => void; children?: ReactNode; under?: ReactNode; plain?: boolean; lineWidth?: number; hoopTop?: boolean
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
        <rect x={PAINT.x1} y={0} width={PAINT.x2 - PAINT.x1} height={PAINT.y2} />
        <path d={`M ${HOOP.x - FT_R} ${ftY} A ${FT_R} ${FT_R} 0 0 0 ${HOOP.x + FT_R} ${ftY}`} />
        <path d={`M ${HOOP.x - FT_R} ${ftY} A ${FT_R} ${FT_R} 0 0 1 ${HOOP.x + FT_R} ${ftY}`} strokeDasharray="0.25 0.2" />
        <path d={`M ${CORNER_X} 0 L ${CORNER_X} ${CORNER_Y} A ${R3} ${R3} 0 0 0 ${COURT_W - CORNER_X} ${CORNER_Y} L ${COURT_W - CORNER_X} 0`} />
        <path d={`M ${HOOP.x - RESTRICTED_R} ${HOOP.y} A ${RESTRICTED_R} ${RESTRICTED_R} 0 0 0 ${HOOP.x + RESTRICTED_R} ${HOOP.y}`} />
        <line x1={HOOP.x - 0.9} y1={0.6} x2={HOOP.x + 0.9} y2={0.6} />
        <circle cx={HOOP.x} cy={HOOP.y} r={0.23} />
      </g>
      {children}
    </svg>
  )
}

export function ShotDot({ x, y, made, label, r = 0.36 }: { x: number; y: number; made: boolean; label?: string; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={made ? '#1f7a45' : '#c0252d'} stroke="#fff" strokeWidth={0.06} />
      {label && (
        <text x={x} y={y + 0.01} textAnchor="middle" dominantBaseline="central" fontSize={r * 1.15} fontWeight={700} fill="#fff">
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
