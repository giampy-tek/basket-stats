/*
 * PDF di fine partita: ogni blocco della pagina statistiche marcato con data-pdf viene fotografato
 * (html2canvas) e impaginato su A4 orizzontale (jsPDF). Le librerie si caricano solo quando serve.
 */

/** Fotografa i blocchi data-pdf dentro `root`, nell'ordine in cui compaiono nella pagina. */
export async function captureSections(root: HTMLElement, scale = 1.5): Promise<HTMLCanvasElement[]> {
  const { default: html2canvas } = await import('html2canvas')
  const out: HTMLCanvasElement[] = []
  document.documentElement.classList.add('pdf-capture')
  try {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('[data-pdf]'))) {
      // html2canvas sbaglia gli SVG dimensionati via CSS: ogni campo diventa un'immagine con misure esplicite
      const courts = Array.from(el.querySelectorAll<SVGSVGElement>('svg.court-svg'))
      const imgs = courts.map((s) => {
        const r = s.getBoundingClientRect()
        const c = s.cloneNode(true) as SVGSVGElement
        c.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        c.setAttribute('width', String(r.width)); c.setAttribute('height', String(r.height))
        const vb = c.viewBox.baseVal
        const rect = (extra: Record<string, string>) => {
          const n = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          for (const [k, v] of Object.entries({ x: '0', y: '0', width: String(vb.width), height: String(vb.height), ...extra })) n.setAttribute(k, v)
          return n
        }
        c.insertBefore(rect({ fill: '#f8b878' }), c.firstChild)
        c.appendChild(rect({ fill: 'none', stroke: '#2a1f1a', 'stroke-width': '0.14' }))
        return { w: r.width, h: r.height, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c)) }
      })
      out.push(await html2canvas(el, {
        scale, backgroundColor: '#ffffff', logging: false, ignoreElements: (e) => e.classList?.contains('no-pdf'),
        onclone: (doc, cloned) => {
          cloned.querySelectorAll<SVGSVGElement>('svg.court-svg').forEach((s, i) => {
            if (!imgs[i]) return
            const img = doc.createElement('img')
            img.src = imgs[i].src
            img.style.cssText = `display:block;margin:0 auto;width:${imgs[i].w}px;height:${imgs[i].h}px`
            s.replaceWith(img)
          })
        },
      }))
    }
  } finally {
    document.documentElement.classList.remove('pdf-capture')
  }
  return out
}

export async function buildPdf(root: HTMLElement): Promise<Blob> {
  const [{ jsPDF }, canvases] = await Promise.all([import('jspdf'), captureSections(root)])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 24
  const GAP = 10
  let y = M
  for (const c of canvases) {
    const w = W - 2 * M
    const h = (c.height * w) / c.width
    if (h <= H - 2 * M) {
      if (y + h > H - M) { doc.addPage(); y = M }
      doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', M, y, w, h)
      y += h + GAP
    } else {
      // blocco più alto di una pagina: lo si spezza in fette
      if (y > M) { doc.addPage(); y = M }
      const slice = Math.floor(((H - 2 * M) * c.width) / w)
      for (let off = 0; off < c.height; off += slice) {
        const sh = Math.min(slice, c.height - off)
        const part = document.createElement('canvas')
        part.width = c.width; part.height = sh
        part.getContext('2d')!.drawImage(c, 0, off, c.width, sh, 0, 0, c.width, sh)
        if (off > 0) doc.addPage()
        doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', M, M, w, (sh * w) / c.width)
        y = M + (sh * w) / c.width + GAP
      }
    }
  }
  return doc.output('blob')
}
