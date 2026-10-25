/** Ridimensiona una foto scelta dall'utente a un quadrato 160px JPEG (data URL, ~8 KB). */
export async function photoToDataUrl(file: File, size = 160): Promise<string> {
  const bmp = await createImageBitmap(file)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const s = Math.min(bmp.width, bmp.height)
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return c.toDataURL('image/jpeg', 0.8)
}
