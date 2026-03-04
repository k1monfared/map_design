/**
 * Clone SVG element with explicit pixel dimensions.
 */
function prepareSVG(svgEl, widthPx, heightPx) {
  const clone = svgEl.cloneNode(true)
  if (!clone.getAttribute('viewBox') && svgEl.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', svgEl.getAttribute('viewBox'))
  }
  if (widthPx && heightPx) {
    clone.setAttribute('width', widthPx)
    clone.setAttribute('height', heightPx)
  } else {
    const bbox = svgEl.getBoundingClientRect()
    clone.setAttribute('width', bbox.width || 800)
    clone.setAttribute('height', bbox.height || 600)
  }
  return clone
}

function triggerDownload(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/**
 * Download SVG element as an .svg file.
 */
export async function exportSVG(svgEl, filename = 'map.svg') {
  const clone = prepareSVG(svgEl)
  const svgStr = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

/**
 * Export SVG as vector PDF using jsPDF + svg2pdf.js.
 *
 * @param {SVGElement} svgEl
 * @param {string} filename
 * @param {number} widthIn - page width in inches
 * @param {number} heightIn - page height in inches
 */
export async function exportPDF(svgEl, filename = 'map.pdf', widthIn = 11, heightIn = 8.5) {
  const { jsPDF } = await import('jspdf')
  const { svg2pdf } = await import('svg2pdf.js')

  const clone = prepareSVG(svgEl, widthIn * 72, heightIn * 72)
  const doc = new jsPDF({
    orientation: widthIn > heightIn ? 'landscape' : 'portrait',
    unit: 'in',
    format: [widthIn, heightIn],
  })

  await svg2pdf(clone, doc, { x: 0, y: 0, width: widthIn, height: heightIn })
  doc.save(filename)
}

/**
 * Rasterize SVG and export as PNG at the specified DPI and physical size.
 *
 * @param {SVGElement} svgEl
 * @param {string} filename
 * @param {number} dpi
 * @param {number} widthIn
 * @param {number} heightIn
 */
export async function exportPNG(svgEl, filename = 'map.png', dpi = 300, widthIn = 11, heightIn = 8.5) {
  const pixelW = Math.round(dpi * widthIn)
  const pixelH = Math.round(dpi * heightIn)

  if (pixelW * pixelH > 100_000_000) {
    const ok = confirm(
      `Output size ${pixelW}×${pixelH} px (${(pixelW * pixelH / 1e6).toFixed(0)} MP) is very large.\n` +
      `Browsers cap canvas at ~16384px. Consider SVG or PDF instead.\n\nContinue anyway?`
    )
    if (!ok) return
  }

  const clone = prepareSVG(svgEl, pixelW, pixelH)
  const svgStr = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)

  await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelW
      canvas.height = pixelH
      canvas.getContext('2d').drawImage(img, 0, 0, pixelW, pixelH)
      URL.revokeObjectURL(svgUrl)
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        triggerDownload(url, filename)
        setTimeout(() => URL.revokeObjectURL(url), 10000)
        resolve()
      }, 'image/png')
    }
    img.onerror = reject
    img.src = svgUrl
  })
}

/**
 * Rasterize SVG and export as TIFF using UTIF.js.
 *
 * @param {SVGElement} svgEl
 * @param {string} filename
 * @param {number} dpi
 * @param {number} widthIn
 * @param {number} heightIn
 */
export async function exportTIFF(svgEl, filename = 'map.tiff', dpi = 300, widthIn = 11, heightIn = 8.5) {
  const UTIF = await import('utif').then(m => m.default ?? m)
  const pixelW = Math.round(dpi * widthIn)
  const pixelH = Math.round(dpi * heightIn)

  if (pixelW * pixelH > 100_000_000) {
    const ok = confirm(
      `Output size ${pixelW}×${pixelH} px is very large. Consider SVG or PDF instead.\n\nContinue anyway?`
    )
    if (!ok) return
  }

  const clone = prepareSVG(svgEl, pixelW, pixelH)
  const svgStr = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' })
  const svgUrl = URL.createObjectURL(svgBlob)

  const imageData = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = pixelW
      canvas.height = pixelH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, pixelW, pixelH)
      URL.revokeObjectURL(svgUrl)
      resolve(ctx.getImageData(0, 0, pixelW, pixelH))
    }
    img.onerror = reject
    img.src = svgUrl
  })

  const tiffBuffer = UTIF.encodeImage(imageData.data, pixelW, pixelH)
  const blob = new Blob([tiffBuffer], { type: 'image/tiff' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
