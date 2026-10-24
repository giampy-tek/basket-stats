// Mezzo campo FIBA, coordinate in metri. Origine: angolo della linea di fondo,
// x lungo la linea di fondo (0-15), y verso il centrocampo (0-14). Canestro in alto.
export const COURT_W = 15
export const COURT_L = 14
export const HOOP = { x: 7.5, y: 1.575 }
export const R3 = 6.75
export const CORNER_X = 0.9
export const PAINT = { x1: 5.05, x2: 9.95, y2: 5.8 }
export const FT_R = 1.8
export const RESTRICTED_R = 1.25
export const CORNER_Y = HOOP.y + Math.sqrt(R3 * R3 - (HOOP.x - CORNER_X) ** 2)

export function isThree(x: number, y: number) {
  const d = Math.hypot(x - HOOP.x, y - HOOP.y)
  return d > R3 || x < CORNER_X || x > COURT_W - CORNER_X
}

export type Zone = 'campana' | 'media' | 'da3'

export function zoneOf(x: number, y: number): Zone {
  if (isThree(x, y)) return 'da3'
  if (x >= PAINT.x1 && x <= PAINT.x2 && y <= PAINT.y2) return 'campana'
  return 'media'
}
