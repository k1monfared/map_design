<script>
  import { exportSVG, exportPDF, exportPNG, exportTIFF } from '../lib/export.js'

  export let svgEl = null
  export let defaultFilename = 'map'

  let format = 'svg'
  let dpi = 300
  let width = 11
  let height = 8.5
  let unit = 'in'
  let loading = false
  let error = ''

  $: widthIn = unit === 'in' ? width : width / 2.54
  $: heightIn = unit === 'in' ? height : height / 2.54
  $: dpiEnabled = format === 'png' || format === 'tiff'

  async function handleDownload() {
    if (!svgEl) { error = 'No map to export yet.'; return }
    error = ''
    loading = true
    try {
      const filename = defaultFilename + '.' + format
      if (format === 'svg') await exportSVG(svgEl, filename)
      else if (format === 'pdf') await exportPDF(svgEl, filename, widthIn, heightIn)
      else if (format === 'png') await exportPNG(svgEl, filename, dpi, widthIn, heightIn)
      else if (format === 'tiff') await exportTIFF(svgEl, filename, dpi, widthIn, heightIn)
    } catch (e) {
      error = 'Export failed: ' + (e?.message ?? e)
    } finally {
      loading = false
    }
  }
</script>

<div class="export-panel">
  <h3>Export</h3>

  <div class="field">
    <label>Format</label>
    <div class="radio-group">
      {#each ['svg','pdf','png','tiff'] as f}
        <label class="radio">
          <input type="radio" bind:group={format} value={f} />
          {f.toUpperCase()}
        </label>
      {/each}
    </div>
  </div>

  <div class="field">
    <label>Size</label>
    <div class="size-row">
      <input type="number" bind:value={width} min="0.1" step="0.5" class="size-input" />
      <span class="sep">x</span>
      <input type="number" bind:value={height} min="0.1" step="0.5" class="size-input" />
      <select bind:value={unit} class="unit-select">
        <option value="in">in</option>
        <option value="cm">cm</option>
      </select>
    </div>
  </div>

  <div class="field" class:disabled={!dpiEnabled}>
    <label>DPI</label>
    <input
      type="number"
      bind:value={dpi}
      min="72" max="1200" step="50"
      disabled={!dpiEnabled}
      class="dpi-input"
    />
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  <button class="download-btn" on:click={handleDownload} disabled={loading || !svgEl}>
    {loading ? 'Exporting…' : 'Download ' + format.toUpperCase()}
  </button>
</div>

<style>
  .export-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-surface, #16213e);
    border-radius: 0.5rem;
  }

  h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-muted, #888);
    margin: 0;
  }

  .field { display: flex; flex-direction: column; gap: 0.3rem; }
  .field > label { font-size: 0.8rem; color: var(--color-muted, #888); }
  .field.disabled { opacity: 0.4; pointer-events: none; }

  .radio-group { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .radio { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; cursor: pointer; }

  .size-row { display: flex; align-items: center; gap: 0.4rem; }
  .size-input { width: 4.5rem; padding: 0.3rem 0.4rem; background: var(--color-card, #0f3460); border: 1px solid #333; color: inherit; border-radius: 0.25rem; font-size: 0.85rem; }
  .sep { color: var(--color-muted, #888); }
  .unit-select { padding: 0.3rem 0.4rem; background: var(--color-card, #0f3460); border: 1px solid #333; color: inherit; border-radius: 0.25rem; font-size: 0.85rem; }
  .dpi-input { width: 5rem; padding: 0.3rem 0.4rem; background: var(--color-card, #0f3460); border: 1px solid #333; color: inherit; border-radius: 0.25rem; font-size: 0.85rem; }

  .error { color: #e94560; font-size: 0.8rem; margin: 0; }

  .download-btn {
    padding: 0.6rem 1rem;
    background: var(--color-accent, #e94560);
    color: white;
    border: none;
    border-radius: 0.4rem;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .download-btn:hover:not(:disabled) { opacity: 0.85; }
  .download-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
