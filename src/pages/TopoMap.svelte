<script>
  import { onMount, tick } from 'svelte'
  import { contours } from 'd3-contour'
  import { geoPath, geoIdentity } from 'd3-geo'
  import JSZip from 'jszip'
  import { PRESETS, getPalette, interpolatePalette } from '../lib/palettes.js'
  import { readHashState, writeHashState } from '../lib/state.js'
  import { fetchElevationGrid, fetchETOPOGrid, mergeElevationGrids } from '../lib/elevation.js'
  import ExportPanel from '../components/ExportPanel.svelte'
  import ColorPicker from '../components/ColorPicker.svelte'
  import ContourControls from '../components/ContourControls.svelte'

  // — Phase enum —
  const PHASE = { FIND: 'find', DRAW: 'draw', CONTOUR: 'contour' }

  // — State —
  let phase = PHASE.FIND
  let locationQuery = ''
  let searchResults = []
  let searchLoading = false
  let bbox = null          // [west, south, east, north]
  let n = 6
  let levels = []
  let paletteId = 'mountain'
  let customColors = null
  let lineWeight = 1.5
  let showLabels = false
  let bgColor = '#f5f0e8'
  let initialized = false

  // — Elevation data —
  let elevResult = null    // { grid, width, height, min, max }
  let elevLoading = false
  let elevError = ''
  let bathyNote = ''       // note about lake bathymetry

  // — Contour paths —
  let contourFeatures = [] // [{level, path, color}]

  // — SVG ref for export —
  let svgEl

  // — Map (MapLibre) —
  let mapContainer
  let map = null
  let mapLoaded = false
  let drawMode = false
  let drawStart = null
  let drawRect = null      // {west, south, east, north} while drawing

  // — Derived —
  $: palette = getPalette(paletteId)

  // — Location search —
  let searchTimer = null

  function onSearchInput() {
    clearTimeout(searchTimer)
    if (locationQuery.length < 3) { searchResults = []; return }
    searchTimer = setTimeout(doSearch, 500)
  }

  async function doSearch() {
    searchLoading = true
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=5`
      const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } })
      searchResults = await resp.json()
    } catch {
      searchResults = []
    } finally {
      searchLoading = false
    }
  }

  function selectResult(result) {
    searchResults = []
    locationQuery = result.display_name
    if (map) {
      map.flyTo({
        center: [parseFloat(result.lon), parseFloat(result.lat)],
        zoom: 10,
        duration: 1000,
      })
    }
  }

  // — MapLibre initialization —
  async function initMap() {
    const { Map: MLMap } = await import('maplibre-gl')
    map = new MLMap({
      container: mapContainer,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [0, 20],
      zoom: 2,
    })

    map.on('load', () => { mapLoaded = true })

    // Click handler for draw mode
    map.on('click', e => {
      if (!drawMode) return
      if (!drawStart) {
        drawStart = e.lngLat
      } else {
        const end = e.lngLat
        const w = Math.min(drawStart.lng, end.lng)
        const e2 = Math.max(drawStart.lng, end.lng)
        const s = Math.min(drawStart.lat, end.lat)
        const n2 = Math.max(drawStart.lat, end.lat)
        drawRect = { west: w, east: e2, south: s, north: n2 }
      }
    })

    map.on('mousemove', e => {
      if (!drawMode || !drawStart) return
      const end = e.lngLat
      const w = Math.min(drawStart.lng, end.lng)
      const e2 = Math.max(drawStart.lng, end.lng)
      const s = Math.min(drawStart.lat, end.lat)
      const n2 = Math.max(drawStart.lat, end.lat)
      drawRect = { west: w, east: e2, south: s, north: n2 }
    })
  }

  function startDraw() {
    drawMode = true
    drawStart = null
    drawRect = null
    if (map) map.getCanvas().style.cursor = 'crosshair'
  }

  function cancelDraw() {
    drawMode = false
    drawStart = null
    drawRect = null
    if (map) map.getCanvas().style.cursor = ''
  }

  function confirmFrame() {
    if (!drawRect) return
    bbox = [drawRect.west, drawRect.south, drawRect.east, drawRect.north]
    drawMode = false
    drawStart = null
    drawRect = null
    if (map) map.getCanvas().style.cursor = ''
    generateContours()
    saveState()
  }

  // — Contour generation —
  async function generateContours() {
    if (!bbox) return
    elevLoading = true
    elevError = ''
    bathyNote = ''
    contourFeatures = []

    try {
      // Primary: Terrarium tiles
      const primary = await fetchElevationGrid(bbox, 512)

      // Supplemental: NOAA ETOPO1 lake bathymetry
      const etopo = await fetchETOPOGrid(bbox, 512)
      if (etopo) {
        const merged = mergeElevationGrids(primary.grid, etopo)
        primary.grid = merged
        // Recompute min/max after merge
        let mn = Infinity, mx = -Infinity
        for (const v of merged) { if (v < mn) mn = v; if (v > mx) mx = v }
        primary.min = mn
        primary.max = mx
      } else {
        bathyNote = 'Lake bathymetry unavailable (CORS); using terrain data only.'
      }

      elevResult = primary
      phase = PHASE.CONTOUR

      // Initialize levels if empty
      if (levels.length !== n) {
        levels = equalLevels(n, primary.min, primary.max)
      }
      buildContours()
    } catch (e) {
      elevError = 'Failed to fetch elevation: ' + e.message
    } finally {
      elevLoading = false
    }
  }

  function equalLevels(count, lo, hi) {
    return Array.from({ length: count }, (_, i) => lo + (hi - lo) * i / (count - 1))
  }

  function buildContours() {
    if (!elevResult) return
    const { grid, width, height, min, max } = elevResult
    const sorted = [...levels].sort((a, b) => a - b)

    const contourGen = contours()
      .size([width, height])
      .thresholds(sorted)

    const rawContours = contourGen(grid)

    // Map grid coords → geographic coords via simple linear interpolation
    const [west, south, east, north] = bbox
    function gridToGeo(x, y) {
      return [
        west + (x / width) * (east - west),
        north - (y / height) * (north - south),
      ]
    }

    function transformGeom(geom) {
      if (!geom) return null
      if (geom.type === 'MultiPolygon') {
        return {
          ...geom,
          coordinates: geom.coordinates.map(polygon =>
            polygon.map(ring => ring.map(([x, y]) => gridToGeo(x, y)))
          )
        }
      }
      if (geom.type === 'Polygon') {
        return {
          ...geom,
          coordinates: geom.coordinates.map(ring => ring.map(([x, y]) => gridToGeo(x, y)))
        }
      }
      return geom
    }

    // Build projection for geographic coords → SVG pixel coords
    const svgW = 800
    const svgH = Math.round(svgW * (north - south) / (east - west))

    const projection = geoIdentity()
      .reflectY(false)
      .fitSize([svgW, svgH], {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
        },
        properties: {}
      })

    const pathGen = geoPath(projection)

    contourFeatures = rawContours.map((c, i) => {
      const t = (c.value - min) / (max - min + 1e-10)
      const color = interpolatePalette(palette, t)
      const geom = transformGeom(c)
      const feature = { type: 'Feature', geometry: geom, properties: {} }
      return {
        level: c.value,
        path: pathGen(feature) ?? '',
        color,
        svgW,
        svgH,
      }
    })

    _svgDims = { w: contourFeatures[0]?.svgW ?? 800, h: contourFeatures[0]?.svgH ?? 600 }
  }

  let _svgDims = { w: 800, h: 600 }
  $: svgW = _svgDims.w
  $: svgH = _svgDims.h

  // — ContourControls handler —
  function onContourChange(e) {
    n = e.detail.n
    levels = e.detail.levels
    buildContours()
    saveState()
  }

  // — ColorPicker handler —
  function onColorChange(e) {
    paletteId = e.detail.paletteId
    customColors = e.detail.customColors ?? null
    buildContours()
    saveState()
  }

  // — CNC ZIP export —
  async function exportCNC() {
    if (!contourFeatures.length) return
    const zip = new JSZip()
    const { w, h } = _svgDims

    for (const { level, path } of contourFeatures) {
      const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <path d="${path}" fill="none" stroke="#000000" stroke-width="${lineWeight}" />
</svg>`
      zip.file(`layer-${Math.round(level)}m.svg`, content)
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contour-layers.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // — State persistence —
  function saveState() {
    if (!initialized) return
    writeHashState('/topo-map', {
      v: 1, tool: 'topo-map',
      location: locationQuery,
      bbox,
      n,
      levels,
      palette: paletteId,
      customColors,
      lineWeight,
      showLabels,
      bgColor,
    })
  }

  function applyState(s) {
    if (!s || s.tool !== 'topo-map') return
    locationQuery = s.location ?? ''
    bbox = s.bbox ?? null
    n = s.n ?? 6
    levels = s.levels ?? []
    paletteId = s.palette ?? 'mountain'
    customColors = s.customColors ?? null
    lineWeight = s.lineWeight ?? 1.5
    showLabels = s.showLabels ?? false
    bgColor = s.bgColor ?? '#f5f0e8'
  }

  onMount(async () => {
    const savedState = readHashState()
    applyState(savedState)
    initialized = true
    await tick()
    await initMap()
    // Restore phase if we have a saved bbox
    if (bbox) {
      await generateContours()
    }
  })
</script>

<div class="page">
  <nav>
    <a href="#/">← Home</a>
    <h1>Custom Topographic Map</h1>
    {#if elevLoading}<span class="status-msg">Fetching elevation…</span>{/if}
    {#if elevError}<span class="status-msg error">{elevError}</span>{/if}
  </nav>

  <div class="layout">
    <!-- Left panel -->
    <aside class="panel">

      <!-- Search -->
      <div class="section">
        <label class="field-label">Location</label>
        <div class="search-wrap">
          <input
            type="search"
            bind:value={locationQuery}
            on:input={onSearchInput}
            placeholder="Search location…"
            class="search-input"
          />
          {#if searchLoading}
            <span class="status-msg">Searching…</span>
          {/if}
          {#if searchResults.length > 0}
            <ul class="results">
              {#each searchResults as r}
                <li on:click={() => selectResult(r)} on:keydown={() => selectResult(r)} role="option" aria-selected="false">
                  {r.display_name}
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>

      <!-- Frame controls -->
      <div class="section">
        <label class="field-label">Frame</label>
        {#if phase === PHASE.FIND || phase === PHASE.DRAW}
          {#if !drawMode}
            <button class="btn" on:click={startDraw}>Draw Frame</button>
          {:else if !drawStart}
            <p class="hint">Click first corner on map</p>
            <button class="btn-secondary" on:click={cancelDraw}>Cancel</button>
          {:else}
            <p class="hint">{drawRect ? 'Move mouse to adjust, then confirm' : 'Move mouse to draw rectangle'}</p>
            <button class="btn" on:click={confirmFrame} disabled={!drawRect}>Confirm Frame</button>
            <button class="btn-secondary" on:click={cancelDraw}>Cancel</button>
          {/if}
        {:else}
          {#if bbox}
            <p class="hint">
              {bbox[0].toFixed(3)}°, {bbox[1].toFixed(3)}° →
              {bbox[2].toFixed(3)}°, {bbox[3].toFixed(3)}°
            </p>
          {/if}
          <button class="btn-secondary" on:click={() => { phase = PHASE.FIND; bbox = null; contourFeatures = []; saveState() }}>
            Change Frame
          </button>
        {/if}
      </div>

      <!-- Contour controls (shown after generation) -->
      {#if phase === PHASE.CONTOUR && elevResult}
        <ContourControls
          {n}
          {levels}
          min={elevResult.min}
          max={elevResult.max}
          on:change={onContourChange}
        />
      {/if}

      <!-- Color -->
      <ColorPicker
        palettes={PRESETS.filter(p => p.type === 'gradient')}
        value={paletteId}
        customColors={customColors ?? {}}
        on:change={onColorChange}
      />

      <!-- Style -->
      <div class="section">
        <label class="field-label">Line weight: {lineWeight}px</label>
        <input
          type="range" min="0.5" max="5" step="0.5"
          bind:value={lineWeight}
          on:input={saveState}
          class="range"
        />
      </div>

      <div class="section">
        <label class="field-label">Background</label>
        <input type="color" bind:value={bgColor} on:input={saveState} />
      </div>

      {#if bathyNote}
        <p class="hint">{bathyNote}</p>
      {/if}

      <!-- Export -->
      {#if phase === PHASE.CONTOUR}
        <ExportPanel {svgEl} defaultFilename="topo-map" />
        <button class="btn-secondary" on:click={exportCNC}>
          Export CNC Layers (.zip)
        </button>
      {/if}
    </aside>

    <!-- Right: map (phases FIND/DRAW) or SVG (phase CONTOUR) -->
    <div class="canvas-area">
      <!-- MapLibre map — always in DOM, hidden when showing contours -->
      <div bind:this={mapContainer} class="map-container" class:hidden={phase === PHASE.CONTOUR}></div>
      {#if drawRect && phase !== PHASE.CONTOUR}
        <div class="draw-hint">
          Frame: {drawRect.west.toFixed(3)}° to {drawRect.east.toFixed(3)}°
        </div>
      {/if}
      {#if phase === PHASE.CONTOUR}
        <!-- Contour SVG -->
        <svg
          bind:this={svgEl}
          viewBox="0 0 {svgW} {svgH}"
          xmlns="http://www.w3.org/2000/svg"
          class="map-svg"
          role="img"
          aria-label="Topographic contour map"
        >
          <rect width={svgW} height={svgH} fill={bgColor} />
          {#each contourFeatures as { path, color, level }}
            {#if path}
              <path
                d={path}
                fill={color}
                stroke="none"
                stroke-width={lineWeight}
              />
            {/if}
          {/each}
          {#if showLabels}
            {#each contourFeatures as { level, svgW: w, svgH: h }, i}
              {#if i % 2 === 0}
                <text
                  x={w * 0.02}
                  y={h * 0.02 + i * 14}
                  fill="#333"
                  font-size="12"
                  font-family="sans-serif"
                >{Math.round(level)}m</text>
              {/if}
            {/each}
          {/if}
        </svg>
      {/if}
    </div>
  </div>
</div>

<!-- MapLibre CSS loaded from index.html -->

<style>
  .page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    overflow: hidden;
  }

  nav {
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--color-surface);
    border-bottom: 1px solid #222;
    flex-shrink: 0;
  }
  nav a { color: var(--color-muted); font-size: 0.9rem; }
  nav h1 { font-size: 1.1rem; flex: 1; }

  .layout {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .panel {
    width: 320px;
    flex-shrink: 0;
    background: var(--color-surface);
    border-right: 1px solid #222;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: relative;
  }

  .canvas-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111;
  }

  .map-container {
    width: 100%;
    height: 100%;
  }

  .map-container.hidden {
    display: none;
  }

  .map-svg {
    max-width: 100%;
    max-height: 100%;
    display: block;
    width: auto;
    height: auto;
  }

  /* Search */
  .search-wrap { position: relative; }
  .search-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    background: var(--color-card);
    border: 1px solid #333;
    color: inherit;
    border-radius: 0.4rem;
    font-size: 0.85rem;
  }
  .results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-card);
    border: 1px solid #333;
    border-radius: 0 0 0.4rem 0.4rem;
    list-style: none;
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
  }
  .results li {
    padding: 0.4rem 0.6rem;
    font-size: 0.8rem;
    cursor: pointer;
    border-bottom: 1px solid #222;
  }
  .results li:hover { background: var(--color-surface); }

  /* Buttons */
  .btn {
    padding: 0.5rem 1rem;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
  }
  .btn:hover { opacity: 0.85; }

  .btn-secondary {
    padding: 0.4rem 0.8rem;
    background: var(--color-card);
    color: inherit;
    border: 1px solid #333;
    border-radius: 0.4rem;
    font-size: 0.85rem;
    cursor: pointer;
    width: 100%;
  }
  .btn-secondary:hover { background: var(--color-surface); }

  .section { display: flex; flex-direction: column; gap: 0.5rem; }
  .field-label { font-size: 0.8rem; color: var(--color-muted); }
  .hint { font-size: 0.75rem; color: var(--color-muted); margin: 0; line-height: 1.4; }
  .status-msg { font-size: 0.8rem; color: var(--color-muted); }
  .status-msg.error { color: #e94560; }

  .range { width: 100%; accent-color: var(--color-accent); }

  .draw-hint {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.75);
    color: white;
    font-size: 0.8rem;
    padding: 0.3rem 0.75rem;
    border-radius: 0.3rem;
    pointer-events: none;
  }
</style>
