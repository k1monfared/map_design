/**
 * Palette presets for map styling.
 * type 'categorical': land, selected, ocean, border, bg colors
 * type 'gradient': stops array (low→high elevation), border, bg
 */
export const PRESETS = [
  {
    id: 'political',
    name: 'Political',
    type: 'categorical',
    land: '#e8d5a3',
    selected: '#d4896a',
    ocean: '#a8c8e8',
    border: '#888888',
    bg: '#a8c8e8',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    type: 'categorical',
    land: '#2b4a6b',
    selected: '#4a9eca',
    ocean: '#0a1929',
    border: '#1b3a5c',
    bg: '#0a1929',
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    type: 'categorical',
    land: '#cccccc',
    selected: '#555555',
    ocean: '#f5f5f5',
    border: '#999999',
    bg: '#f5f5f5',
  },
  {
    id: 'dark',
    name: 'Dark',
    type: 'categorical',
    land: '#1a2a3a',
    selected: '#c94040',
    ocean: '#0d1117',
    border: '#2a3a4a',
    bg: '#0d1117',
  },
  {
    id: 'mountain',
    name: 'Mountain',
    type: 'gradient',
    stops: ['#2b4a1f', '#4a7a30', '#7ab048', '#c4a035', '#8b6914', '#ffffff'],
    border: '#00000033',
    bg: '#a8c8e8',
  },
  {
    id: 'water',
    name: 'Water',
    type: 'gradient',
    stops: ['#0a2e4a', '#1b5e8a', '#4a9eca', '#a0d4f0', '#d6eef8'],
    border: '#00000033',
    bg: '#f5f0e8',
  },
  {
    id: 'copper',
    name: 'Copper',
    type: 'gradient',
    stops: ['#1a0a00', '#4a2000', '#8b5520', '#c8943a', '#e8c87a', '#fff8e8'],
    border: '#00000033',
    bg: '#f0ead6',
  },
]

/**
 * Get a palette by id, falling back to 'political'.
 */
export function getPalette(id) {
  return PRESETS.find(p => p.id === id) ?? PRESETS[0]
}

/**
 * Interpolate a gradient palette at position t (0..1).
 * Returns a CSS hex color string.
 * For categorical palettes, returns the 'selected' color.
 */
export function interpolatePalette(palette, t) {
  if (palette.type !== 'gradient' || !palette.stops?.length) {
    return palette.selected ?? palette.land ?? '#888888'
  }
  const stops = palette.stops
  const scaled = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.floor(scaled)
  const f = scaled - i
  if (i >= stops.length - 1) return stops[stops.length - 1]
  return lerpColor(stops[i], stops[i + 1], f)
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bv = Math.round(ab + (bb - ab) * t)
  return '#' + [r, g, bv].map(v => v.toString(16).padStart(2, '0')).join('')
}
