import { useStore } from './store'

export const PRESETS: [string, string][] = [
  ['Arancio', '#b5440c'], ['Rosso', '#b4262c'], ['Bordeaux', '#7a1f3d'], ['Blu', '#1f4fa3'],
  ['Navy', '#16325c'], ['Azzurro', '#1d7fb8'], ['Verde', '#1f7a45'], ['Turchese', '#0f766e'],
  ['Viola', '#5b2a86'], ['Oro', '#a67c00'], ['Grafite', '#2f3437'],
]

const lum = (r: number, g: number, b: number) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const parse = (hex: string): [number, number, number] => {
  const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#b5440c'
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}
const mix = (c: number[], to: number, t: number) => c.map((v) => Math.round(v + (to - v) * t))
const css = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`
const toHex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')

/** Scurisce i colori troppo chiari, così il testo bianco resta leggibile. */
export function readable(hex: string): string {
  let c: number[] = parse(hex)
  for (let i = 0; i < 12 && lum(c[0], c[1], c[2]) > 0.2; i++) c = mix(c, 0, 0.12)
  return toHex(c)
}

export function applyTheme(hex: string) {
  const base = parse(readable(hex))
  const root = document.documentElement.style
  root.setProperty('--brand', css(base))
  root.setProperty('--brand-dark', css(mix(base, 0, 0.28)))
  root.setProperty('--brand-soft', css(mix(base, 255, 0.88)))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', toHex(base))
}

applyTheme(useStore.getState().brandColor)
useStore.subscribe((s, p) => { if (s.brandColor !== p.brandColor) applyTheme(s.brandColor) })
