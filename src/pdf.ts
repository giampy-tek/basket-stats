/*
 * PDF di fine partita. I blocchi della pagina statistiche marcati data-pdf="N" finiscono sulla pagina N
 * (A4 orizzontale). Ogni blocco viene copiato in una "scena" isolata in alto a sinistra e fotografato
 * con html2canvas: così non dipende dalla posizione di scorrimento né dagli elementi sticky, che su
 * Safari/iPad davano immagini bianche. Se una foto esce bianca si riprova con altri metodi.
 */

type Shot = { url: string; w: number; h: number } // misure in pixel CSS

const isBlank = (c: HTMLCanvasElement) => {
  const s = document.createElement('canvas')
  s.width = s.height = 24
  const g = s.getContext('2d')!
  g.drawImage(c, 0, 0, 24, 24)
  const d = g.getImageData(0, 0, 24, 24).data
  for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return false
  return true
}

/** I campi SVG (dimensionati solo via CSS) diventano immagini con misure esplicite: html2canvas li sbaglia. */
function courtsToImages(scope: HTMLElement) {
  for (const s of Array.from(scope.querySelectorAll<SVGSVGElement>('svg.court-svg'))) {
    const r = s.getBoundingClientRect()
    const c = s.cloneNode(true) as SVGSVGElement
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    c.setAttribute('width', String(r.width)); c.setAttribute('height', String(r.height))
    c.setAttribute('font-family', 'Inter, -apple-system, system-ui, sans-serif') // un SVG-immagine non eredita il font della pagina
    const vb = c.viewBox.baseVal
    const rect = (extra: Record<string, string>) => {
      const n = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      for (const [k, v] of Object.entries({ x: '0', y: '0', width: String(vb.width), height: String(vb.height), ...extra })) n.setAttribute(k, v)
      return n
    }
    c.insertBefore(rect({ fill: '#f8b878' }), c.firstChild)
    c.appendChild(rect({ fill: 'none', stroke: '#2a1f1a', 'stroke-width': '0.14' }))
    const img = document.createElement('img')
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c))
    img.style.cssText = `display:block;margin:0 auto;width:${r.width}px;height:${r.height}px`
    s.replaceWith(img)
  }
}

async function shoot(el: HTMLElement, stage: HTMLElement): Promise<Shot> {
  const { default: html2canvas } = await import('html2canvas')
  const width = el.getBoundingClientRect().width
  const attempts = [{ scale: 1.5, fo: false }, { scale: 1.5, fo: true }, { scale: 1, fo: false }, { scale: 1, fo: true }]
  for (const [ai, a] of attempts.entries()) {
    const t0 = performance.now()
    const clone = el.cloneNode(true) as HTMLElement
    stage.style.width = `${width}px`
    stage.replaceChildren(clone)
    courtsToImages(clone)
    // le immagini dei campi devono essere pronte prima della foto
    await Promise.all(Array.from(clone.querySelectorAll('img')).map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = () => r(null) }))))
    const c = await html2canvas(clone, {
      scale: a.scale, backgroundColor: '#ffffff', logging: false, foreignObjectRendering: a.fo,
      scrollX: 0, scrollY: 0, windowWidth: Math.max(width, 1180),
      // niente copia del resto della pagina (lista azioni, ecc.): solo la scena, i suoi antenati e head (stili)
      ignoreElements: (e) => !(stage.contains(e) || e.contains(stage) || e.closest('head')),
    })
    ;((window as unknown as { __pdfLog?: string[] }).__pdfLog)?.push(`${el.dataset.pdf}: tentativo ${ai + 1} ${Math.round(performance.now() - t0)}ms ${isBlank(c) ? 'BIANCO' : 'ok'}`)
    if (!isBlank(c)) {
      const shot = { url: c.toDataURL('image/jpeg', 0.9), w: c.width / a.scale, h: c.height / a.scale }
      c.width = c.height = 0 // libera la memoria: Safari ha un tetto per i canvas
      stage.replaceChildren()
      return shot
    }
    c.width = c.height = 0
  }
  stage.replaceChildren()
  throw new Error('una parte della pagina non si è generata')
}

export async function buildPdf(root: HTMLElement, footer = ''): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  // pagine: blocchi raggruppati per il numero in data-pdf, nell'ordine in cui compaiono
  const pages = new Map<string, HTMLElement[]>()
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-pdf]'))) {
    const k = el.dataset.pdf || '1'
    pages.set(k, [...(pages.get(k) ?? []), el])
  }
  const stage = document.createElement('div')
  stage.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;background:#fff;pointer-events:none'
  document.body.appendChild(stage)
  document.documentElement.classList.add('pdf-capture')
  const shots: Shot[][] = []
  try {
    for (const els of pages.values()) {
      const row: Shot[] = []
      for (const el of els) row.push(await shoot(el, stage))
      shots.push(row)
    }
  } finally {
    document.documentElement.classList.remove('pdf-capture')
    stage.remove()
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 24, FOOT = 16, GAP = 12
  shots.forEach((row, n) => {
    if (n > 0) doc.addPage()
    // un solo fattore di scala per pagina: i blocchi stanno tutti in larghezza e altezza, senza spezzarsi
    const maxW = Math.max(...row.map((s) => s.w))
    const totH = row.reduce((a, s) => a + s.h, 0) + GAP / 1 * (row.length - 1)
    const f = Math.min((W - 2 * M) / maxW, (H - 2 * M - FOOT) / totH)
    let y = M
    for (const s of row) {
      const w = s.w * f, h = s.h * f
      doc.addImage(s.url, 'JPEG', (W - w) / 2, y, w, h)
      y += h + GAP * f
    }
    doc.setFontSize(8); doc.setTextColor(130)
    doc.text(`${footer}${footer ? '  -  ' : ''}Basket Stats  -  pagina ${n + 1} di ${shots.length}`, W / 2, H - 12, { align: 'center' })
  })
  return doc.output('blob')
}
