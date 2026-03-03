<script>
  import { createEventDispatcher } from 'svelte'

  export let palettes = []
  export let value = 'political'
  export let customColors = {}

  const dispatch = createEventDispatcher()

  let showCustom = value === 'custom'

  function selectPalette(id) {
    value = id
    showCustom = false
    dispatch('change', { paletteId: id, customColors })
  }

  function selectCustom() {
    value = 'custom'
    showCustom = true
    dispatch('change', { paletteId: 'custom', customColors })
  }

  $: selectedPalette = palettes.find(p => p.id === value) ?? palettes[0]
</script>

<div class="color-picker">
  <h3>Color Palette</h3>

  <div class="swatches">
    {#each palettes as palette}
      <button
        class="swatch"
        class:active={value === palette.id}
        title={palette.name}
        on:click={() => selectPalette(palette.id)}
      >
        {#if palette.type === 'gradient'}
          <div class="gradient-preview" style="background: linear-gradient(to right, {palette.stops.join(', ')})" ></div>
        {:else}
          <div class="categorical-preview">
            <div class="swatch-block" style="background:{palette.land}"></div>
            <div class="swatch-block" style="background:{palette.selected}"></div>
            <div class="swatch-block" style="background:{palette.ocean ?? palette.bg}"></div>
          </div>
        {/if}
        <span class="swatch-name">{palette.name}</span>
      </button>
    {/each}
  </div>

  {#if selectedPalette?.type === 'categorical'}
    <div class="color-fields">
      <div class="color-row">
        <label>Land</label>
        <input type="color" value={customColors.land ?? selectedPalette.land}
          on:input={e => { customColors = { ...customColors, land: e.target.value }; dispatch('change', { paletteId: value, customColors }) }}
        />
      </div>
      <div class="color-row">
        <label>Selected</label>
        <input type="color" value={customColors.selected ?? selectedPalette.selected}
          on:input={e => { customColors = { ...customColors, selected: e.target.value }; dispatch('change', { paletteId: value, customColors }) }}
        />
      </div>
      <div class="color-row">
        <label>Ocean/BG</label>
        <input type="color" value={customColors.bg ?? selectedPalette.bg}
          on:input={e => { customColors = { ...customColors, bg: e.target.value }; dispatch('change', { paletteId: value, customColors }) }}
        />
      </div>
      <div class="color-row">
        <label>Border</label>
        <input type="color" value={customColors.border ?? selectedPalette.border}
          on:input={e => { customColors = { ...customColors, border: e.target.value }; dispatch('change', { paletteId: value, customColors }) }}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .color-picker { display: flex; flex-direction: column; gap: 0.75rem; }

  h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-muted, #888);
    margin: 0;
  }

  .swatches { display: flex; flex-wrap: wrap; gap: 0.4rem; }

  .swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.3rem;
    background: var(--color-card, #0f3460);
    border: 2px solid transparent;
    border-radius: 0.4rem;
    cursor: pointer;
    transition: border-color 0.15s;
    min-width: 60px;
  }
  .swatch.active { border-color: var(--color-accent, #e94560); }
  .swatch:hover:not(.active) { border-color: #444; }

  .gradient-preview {
    width: 56px;
    height: 18px;
    border-radius: 2px;
  }

  .categorical-preview {
    display: flex;
    width: 56px;
    height: 18px;
    border-radius: 2px;
    overflow: hidden;
  }

  .swatch-block { flex: 1; }
  .swatch-name { font-size: 0.65rem; color: var(--color-muted, #888); }

  .color-fields { display: flex; flex-direction: column; gap: 0.4rem; }
  .color-row { display: flex; align-items: center; gap: 0.5rem; }
  .color-row label { font-size: 0.8rem; color: var(--color-muted, #888); width: 60px; }
  .color-row input[type="color"] { width: 2rem; height: 1.5rem; padding: 0; border: none; cursor: pointer; background: none; }
</style>
