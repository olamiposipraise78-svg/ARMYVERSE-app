// Shared image handling: guarantees a graceful fallback when an image fails
// to load so the layout never shows a broken icon or a blank container.

export const FALLBACK_IMG = '/images/fallback.svg'

// Default themed placeholder shown whenever a source fails to load.
export const fallbackFor = (label = 'BTS') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">`,
      `<defs>`,
      `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
      `<stop offset="0" stop-color="#07111F"/><stop offset=".5" stop-color="#0f3b5c"/><stop offset="1" stop-color="#0A1730"/>`,
      `</linearGradient>`,
      `<radialGradient id="r" cx=".5" cy=".38" r=".55"><stop offset="0" stop-color="#7DD3FC" stop-opacity=".9"/><stop offset="1" stop-color="#0f3b5c" stop-opacity="0"/></radialGradient>`,
      `</defs>`,
      `<rect width="600" height="600" fill="url(#g)"/>`,
      `<rect width="600" height="600" fill="url(#r)"/>`,
      `<path d="M300 200c-38 0-60 26-60 56 0 40 60 74 60 74s60-34 60-74c0-30-22-56-60-56z"/>`,
      `<circle cx="300" cy="252" r="13" fill="#fff"/>`,
      `<path d="M300 118v-34M300 84l-12 16 12-8 12 8-12-16z" fill="#fff" opacity=".8"/>`,
      `<text x="300" y="470" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif" font-size="34" font-weight="800" letter-spacing="4" fill="#7DD3FC">ARMYVERSE</text>`,
      `<text x="300" y="512" text-anchor="middle" font-family="Inter, Segoe UI, sans-serif" font-size="20" font-weight="600" letter-spacing="6" fill="#7DD3FC">💜</text>`,
      `</svg>`,
    ].join('')
  )}`

export function makeErrorHandler(fallback, onError) {
  return (e) => {
    const img = e.currentTarget
    if (!img) return
    const chosen = fallback || FALLBACK_IMG
    if (img.src === chosen || img.getAttribute('data-src') === chosen) return
    img.setAttribute('data-src', img.src)
    img.src = chosen
    if (onError) onError(e)
  }
}
