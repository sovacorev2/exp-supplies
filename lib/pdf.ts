'use client'

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Split the report into the same atomic units it renders as separate
// pages/cards (cover page, each question's section, the footer) so
// pagination can keep a whole one together instead of cutting it
// wherever a fixed page-height happens to fall. Any wrapper marked
// data-pdf-flatten contributes its children as individual blocks
// instead of being captured as one giant image.
function getBlocks(container: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = []
  Array.from(container.children).forEach(child => {
    const el = child as HTMLElement
    if (el.hasAttribute('data-pdf-flatten')) {
      Array.from(el.children).forEach(grandchild => blocks.push(grandchild as HTMLElement))
    } else {
      blocks.push(el)
    }
  })
  return blocks.length ? blocks : [container]
}

function cropCanvas(source: HTMLCanvasElement, sy: number, sh: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = source.width
  c.height = Math.max(1, Math.round(sh))
  const ctx = c.getContext('2d')!
  ctx.drawImage(source, 0, sy, source.width, c.height, 0, 0, source.width, c.height)
  return c
}

export async function exportAnalyticsPDF(element: HTMLElement, title: string) {
  const blocks = getBlocks(element)

  const [canvases, logo] = await Promise.all([
    Promise.all(blocks.map(block => html2canvas(block, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    }))),
    loadImage('/exp-logo.png'),
  ])

  const pdf = new jsPDF('p', 'pt', 'a4')
  const pageWidth    = pdf.internal.pageSize.getWidth()
  const pageHeight   = pdf.internal.pageSize.getHeight()
  const margin       = 32
  const gap          = 14
  const contentWidth = pageWidth - margin * 2
  const usableHeight = pageHeight - margin * 2

  const logoW = 90
  const logoH = (logo.height / logo.width) * logoW
  pdf.addImage(logo, 'PNG', margin, margin, logoW, logoH)
  pdf.setFontSize(16)
  pdf.setTextColor(20, 20, 20)
  pdf.text(title, margin + logoW + 16, margin + logoH / 2 - 2)
  pdf.setFontSize(10)
  pdf.setTextColor(120, 120, 120)
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin + logoW + 16, margin + logoH / 2 + 14)
  pdf.setDrawColor(230, 230, 230)
  pdf.line(margin, margin + logoH + 12, pageWidth - margin, margin + logoH + 12)

  let cursorY = margin + logoH + 28

  for (const canvas of canvases) {
    const imgHeight = (canvas.height / canvas.width) * contentWidth

    if (imgHeight > usableHeight) {
      // This one block is taller than a full page on its own — slice
      // just this block cleanly, page-aligned, without touching neighbors.
      const pxPerPt = canvas.height / imgHeight
      let offsetPt = 0
      while (offsetPt < imgHeight) {
        if (cursorY >= pageHeight - margin - 20) {
          pdf.addPage()
          cursorY = margin
        }
        const spaceLeftPt   = pageHeight - margin - cursorY
        const sliceHeightPt = Math.min(imgHeight - offsetPt, spaceLeftPt)
        const slice          = cropCanvas(canvas, offsetPt * pxPerPt, sliceHeightPt * pxPerPt)
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, cursorY, contentWidth, sliceHeightPt)
        cursorY  += sliceHeightPt
        offsetPt += sliceHeightPt
        if (offsetPt < imgHeight) {
          pdf.addPage()
          cursorY = margin
        }
      }
      cursorY += gap
    } else {
      if (cursorY + imgHeight > pageHeight - margin) {
        pdf.addPage()
        cursorY = margin
      }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, cursorY, contentWidth, imgHeight)
      cursorY += imgHeight + gap
    }
  }

  const filename = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  pdf.save(`${filename || 'analytics'}.pdf`)
}
