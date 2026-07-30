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

export async function exportAnalyticsPDF(element: HTMLElement, title: string) {
  const [canvas, logo] = await Promise.all([
    html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    }),
    loadImage('/exp-logo.png'),
  ])

  const pdf = new jsPDF('p', 'pt', 'a4')
  const pageWidth  = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin     = 32

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

  const contentTop = margin + logoH + 28
  const imgWidth   = pageWidth - margin * 2
  const imgHeight  = (canvas.height / canvas.width) * imgWidth
  const imgData    = canvas.toDataURL('image/png')

  let heightLeft = imgHeight
  let position   = contentTop

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
  heightLeft -= pageHeight - contentTop

  while (heightLeft > 0) {
    pdf.addPage()
    position = -(imgHeight - heightLeft) + margin
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2
  }

  const filename = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '')
  pdf.save(`${filename || 'analytics'}.pdf`)
}
