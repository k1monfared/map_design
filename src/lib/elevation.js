/**
 * Fetch elevation tiles from AWS Terrarium (free, no API key).
 * Decode Terrarium RGB: elevation = (R * 256 + G + B/256) - 32768 meters
 */
const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

function lonToTile(lon, z) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, z))
}

function latToTile(lat, z) {
  const rad = lat * Math.PI / 180
  return Math.floor(
    (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z)
  )
}

function bboxToTiles(bbox, zoom) {
  const [west, south, east, north] = bbox
  return {
    xMin: lonToTile(west, zoom),
    xMax: lonToTile(east, zoom),
    yMin: latToTile(north, zoom),
    yMax: latToTile(south, zoom),
    z: zoom,
  }
}

function decodeTerrariumImageData(imageData) {
  const { data, width, height } = imageData
  const elev = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    elev[i] = (r * 256 + g + b / 256) - 32768
  }
  return elev
}

function fetchTile(x, y, z) {
  const url = TERRARIUM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      resolve({ data: decodeTerrariumImageData(imageData), width: img.width, height: img.height })
    }
    img.onerror = reject
    img.src = url
  })
}

/**
 * Fetch elevation grid covering the given bbox at the specified resolution.
 *
 * @param {[number,number,number,number]} bbox - [west, south, east, north] in degrees
 * @param {number} gridSize - target output grid size (default 512)
 * @returns {{ grid: Float32Array, width: number, height: number, min: number, max: number }}
 */
export async function fetchElevationGrid(bbox, gridSize = 512) {
  const zoom = Math.min(14, Math.ceil(Math.log2(gridSize / 256)) + 8)
  const { xMin, xMax, yMin, yMax, z } = bboxToTiles(bbox, zoom)

  const tilePromises = []
  const tileCoords = []
  for (let ty = yMin; ty <= yMax; ty++) {
    for (let tx = xMin; tx <= xMax; tx++) {
      tilePromises.push(fetchTile(tx, ty, z))
      tileCoords.push({ tx, ty })
    }
  }

  const tiles = await Promise.all(tilePromises)
  const tileW = tiles[0]?.width ?? 256
  const tileH = tiles[0]?.height ?? 256
  const gridW = (xMax - xMin + 1) * tileW
  const gridH = (yMax - yMin + 1) * tileH
  const assembled = new Float32Array(gridW * gridH)

  for (let i = 0; i < tiles.length; i++) {
    const { tx, ty } = tileCoords[i]
    const { data } = tiles[i]
    const offX = (tx - xMin) * tileW
    const offY = (ty - yMin) * tileH
    for (let row = 0; row < tileH; row++) {
      for (let col = 0; col < tileW; col++) {
        assembled[(offY + row) * gridW + (offX + col)] = data[row * tileW + col]
      }
    }
  }

  // Map bbox to pixel extents within the assembled tile grid
  function lonPx(lon) { return (lonToTile(lon, z) - xMin + (lon + 180) / 360 * Math.pow(2, z) % 1) * tileW }
  function latPx(lat) {
    const rad = lat * Math.PI / 180
    const tyFrac = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, z)
    return (tyFrac - yMin) * tileH
  }

  const [west, south, east, north] = bbox
  const px0 = lonPx(west), px1 = lonPx(east)
  const py0 = latPx(north), py1 = latPx(south)

  const outW = gridSize
  const outH = Math.round(gridSize * (py1 - py0) / (px1 - px0)) || gridSize
  const output = new Float32Array(outW * outH)

  for (let row = 0; row < outH; row++) {
    for (let col = 0; col < outW; col++) {
      const srcX = px0 + (col + 0.5) / outW * (px1 - px0)
      const srcY = py0 + (row + 0.5) / outH * (py1 - py0)
      const ix = Math.max(0, Math.min(gridW - 2, Math.floor(srcX)))
      const iy = Math.max(0, Math.min(gridH - 2, Math.floor(srcY)))
      const fx = srcX - ix, fy = srcY - iy
      output[row * outW + col] =
        assembled[iy * gridW + ix] * (1 - fx) * (1 - fy) +
        assembled[iy * gridW + ix + 1] * fx * (1 - fy) +
        assembled[(iy + 1) * gridW + ix] * (1 - fx) * fy +
        assembled[(iy + 1) * gridW + ix + 1] * fx * fy
    }
  }

  let min = Infinity, max = -Infinity
  for (const v of output) { if (v < min) min = v; if (v > max) max = v }

  return { grid: output, width: outW, height: outH, min, max }
}
