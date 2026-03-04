<script>
  import { onMount } from 'svelte'
  import { feature as topoFeature } from 'topojson-client'
  import { geoNaturalEarth1, geoPath } from 'd3-geo'
  import { PRESETS, getPalette } from '../lib/palettes.js'
  import { readHashState, writeHashState } from '../lib/state.js'
  import { fetchElevationGrid } from '../lib/elevation.js'
  import ExportPanel from '../components/ExportPanel.svelte'
  import ColorPicker from '../components/ColorPicker.svelte'
  import RegionSelector from '../components/RegionSelector.svelte'

  const W = 960
  const H = 500
  const projection = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' })
  const pathGen = geoPath(projection)

  // — State —
  let resolution = '110m'
  let paletteId = 'political'
  let customColors = {}
  let selected = new Set()
  let showBorders = true
  let borderColor = '#888888'
  let bgColor = null
  let showElevation = false
  let initialized = false

  // — Derived colors —
  $: palette = getPalette(paletteId)
  $: landColor = customColors?.land ?? palette.land ?? '#e8d5a3'
  $: selColor  = customColors?.selected ?? palette.selected ?? '#d4896a'
  $: bgFill    = bgColor ?? customColors?.bg ?? palette.bg ?? '#a8c8e8'
  $: bdrColor  = customColors?.border ?? borderColor

  // — Data —
  let features = []
  let dataLoading = false
  let dataError = ''

  async function loadData() {
    dataLoading = true
    dataError = ''
    try {
      const resp = await fetch(`/map_design/data/world-${resolution}.json`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const topo = await resp.json()
      const fc = topoFeature(topo, topo.objects.countries)
      // Augment features with ISO_A2 for RegionSelector compatibility
      // Some territories (Kosovo, N. Cyprus, Somaliland) have no numeric id
      features = fc.features.map(f => ({
        ...f,
        properties: {
          ...f.properties,
          ISO_A2: f.id != null ? String(f.id) : f.properties?.name ?? 'unknown'
        }
      }))
    } catch (e) {
      dataError = 'Failed to load map: ' + e.message
    } finally {
      dataLoading = false
    }
  }

  // — Elevation backdrop —
  let elevDataUri = null
  let elevLoading = false

  async function loadElevation() {
    elevDataUri = null
    if (!showElevation) return
    elevLoading = true
    try {
      const result = await fetchElevationGrid([-180, -90, 180, 90], 512)
      elevDataUri = renderElevation(result)
    } catch {
      showElevation = false
    } finally {
      elevLoading = false
    }
  }

  function renderElevation({ grid, width, height }) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const imgData = ctx.createImageData(width, height)
    for (let i = 0; i < width * height; i++) {
      const v = grid[i]
      let r, g, b
      if (v < 0) {
        // Ocean/depth: deep navy → light cyan
        const t = Math.max(0, Math.min(1, (v + 10000) / 10000))
        r = Math.round(10 + t * 150)
        g = Math.round(46 + t * 154)
        b = Math.round(74 + t * 156)
      } else {
        const t = Math.max(0, Math.min(1, v / 5000))
        if (t < 0.2) {
          // 0–1000 m: dark green → tan
          const s = t / 0.2
          r = Math.round(43 + s * 153)
          g = Math.round(74 + s * 86)
          b = Math.round(31 + s * 22)
        } else {
          // 1000–5000 m: tan → white/snow
          const s = (t - 0.2) / 0.8
          r = Math.round(196 + s * 59)
          g = Math.round(160 + s * 95)
          b = Math.round(53 + s * 202)
        }
      }
      imgData.data[i * 4]     = r
      imgData.data[i * 4 + 1] = g
      imgData.data[i * 4 + 2] = b
      imgData.data[i * 4 + 3] = 255
    }
    ctx.putImageData(imgData, 0, 0)
    return canvas.toDataURL('image/png')
  }

  // — Paths —
  $: paths = features.map(f => ({
    d: pathGen(f) ?? '',
    id: String(f.id),
    name: f.properties?.name ?? String(f.id),
  }))

  // — SVG ref for export —
  let svgEl

  // — Handlers —
  function toggleCountry(id) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected = next
    saveState()
  }

  function onRegionChange(e) {
    selected = e.detail
    saveState()
  }

  function onColorChange(e) {
    paletteId = e.detail.paletteId
    customColors = e.detail.customColors ?? {}
    saveState()
  }

  function onResolutionChange() {
    loadData()
    saveState()
  }

  function onElevationToggle() {
    loadElevation()
    saveState()
  }

  // — State persistence —
  function saveState() {
    if (!initialized) return
    writeHashState('/world-map', {
      v: 1, tool: 'world-map',
      layer: 'countries',
      selected: [...selected],
      resolution,
      palette: paletteId,
      customColors,
      showBorders,
      borderColor,
      bgColor,
      showElevation,
    })
  }

  function applyState(s) {
    if (!s) return
    resolution = s.resolution ?? '110m'
    paletteId = s.palette ?? 'political'
    customColors = s.customColors ?? {}
    selected = new Set((s.selected ?? []).map(String))
    showBorders = s.showBorders ?? true
    borderColor = s.borderColor ?? '#888888'
    bgColor = s.bgColor ?? null
    showElevation = s.showElevation ?? false
  }

  onMount(async () => {
    applyState(readHashState())
    initialized = true
    await loadData()
    if (showElevation) await loadElevation()
  })
</script>

<div class="page">
  <nav>
    <a href="#/">← Home</a>
    <h1>World Map Wall Art</h1>
    {#if dataLoading}<span class="status-msg">Loading…</span>{/if}
    {#if dataError}<span class="status-msg error">{dataError}</span>{/if}
  </nav>

  <div class="layout">
    <!-- Left panel -->
    <aside class="panel">

      <div class="section">
        <label class="field-label">Resolution</label>
        <select bind:value={resolution} on:change={onResolutionChange} class="select">
          <option value="110m">110m (fast)</option>
          <option value="50m">50m (detailed)</option>
        </select>
      </div>

      <RegionSelector
        {features}
        {selected}
        label="Countries"
        on:change={onRegionChange}
      />

      <ColorPicker
        palettes={PRESETS}
        value={paletteId}
        {customColors}
        on:change={onColorChange}
      />

      <div class="section">
        <label class="checkbox-row">
          <input type="checkbox" bind:checked={showBorders} on:change={saveState} />
          Show borders
        </label>
        {#if showBorders}
          <div class="color-row">
            <label class="field-label">Border color</label>
            <input type="color" bind:value={borderColor} on:input={saveState} />
          </div>
        {/if}
      </div>

      <div class="section">
        <label class="checkbox-row">
          <input type="checkbox" bind:checked={showElevation} on:change={onElevationToggle} />
          Elevation backdrop
          {#if elevLoading}<span class="status-msg">(loading…)</span>{/if}
        </label>
        {#if showElevation && !elevLoading && !elevDataUri}
          <p class="hint">Elevation unavailable</p>
        {/if}
      </div>

      <ExportPanel {svgEl} defaultFilename="world-map" />
    </aside>

    <!-- SVG canvas -->
    <div class="canvas-area">
      <svg
        bind:this={svgEl}
        viewBox="0 0 {W} {H}"
        width={W}
        height={H}
        xmlns="http://www.w3.org/2000/svg"
        class="map-svg"
        role="img"
        aria-label="World map"
      >
        <!-- Background / ocean fill -->
        <rect width={W} height={H} fill={bgFill} />

        <!-- Optional elevation backdrop -->
        {#if elevDataUri}
          <image
            href={elevDataUri}
            x="0" y="0"
            width={W} height={H}
            preserveAspectRatio="none"
          />
        {/if}

        <!-- Country paths -->
        {#each paths as { d, id, name }}
          {#if d}
            <path
              d={d}
              fill={selected.has(id) ? selColor : landColor}
              stroke={showBorders ? bdrColor : 'none'}
              stroke-width="0.5"
              on:click={() => toggleCountry(id)}
              class="country"
              aria-label={name}
            />
          {/if}
        {/each}
      </svg>
    </div>
  </div>
</div>

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
  }

  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111;
    overflow: hidden;
    padding: 1rem;
    min-width: 0;
  }

  .map-svg {
    max-width: 100%;
    max-height: 100%;
    display: block;
    height: auto;
  }

  .country {
    cursor: pointer;
    transition: opacity 0.1s;
  }
  .country:hover { opacity: 0.75; }

  .section { display: flex; flex-direction: column; gap: 0.5rem; }

  .field-label {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .select {
    padding: 0.35rem 0.5rem;
    background: var(--color-card);
    border: 1px solid #333;
    color: inherit;
    border-radius: 0.35rem;
    font-size: 0.85rem;
    width: 100%;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .color-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-left: 1.5rem;
  }

  .status-msg { font-size: 0.8rem; color: var(--color-muted); }
  .status-msg.error { color: #e94560; }
  .hint { font-size: 0.75rem; color: var(--color-muted); margin: 0; }
</style>
