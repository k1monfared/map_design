<script>
  import { createEventDispatcher } from 'svelte'

  export let n = 6
  export let levels = []
  export let min = 0
  export let max = 3000

  const dispatch = createEventDispatcher()

  function equalLevels(count, lo, hi) {
    if (count < 2) return [lo, hi]
    return Array.from({ length: count }, (_, i) => lo + (hi - lo) * i / (count - 1))
  }

  $: if (levels.length !== n) {
    levels = equalLevels(n, min, max)
  }

  function onNChange(e) {
    n = parseInt(e.target.value)
    levels = equalLevels(n, min, max)
    dispatch('change', { n, levels })
  }

  function onLevelChange(i, e) {
    const val = parseFloat(e.target.value)
    if (isNaN(val)) return
    const lo = i === 0 ? min : levels[i - 1]
    const hi = i === levels.length - 1 ? max : levels[i + 1]
    const clamped = Math.max(lo, Math.min(hi, val))
    levels = levels.map((v, j) => j === i ? clamped : v)
    dispatch('change', { n, levels })
  }

  function resetToEqual() {
    levels = equalLevels(n, min, max)
    dispatch('change', { n, levels })
  }
</script>

<div class="contour-controls">
  <div class="header-row">
    <h3>Contour Levels</h3>
    <button class="reset-btn" on:click={resetToEqual}>Reset</button>
  </div>

  <div class="field">
    <label>N levels: <strong>{n}</strong></label>
    <input
      type="range"
      min="2" max="20" step="1"
      value={n}
      on:input={onNChange}
      class="n-slider"
    />
  </div>

  <div class="levels-list">
    {#each levels as level, i}
      <div class="level-row">
        <span class="level-index">L{i + 1}</span>
        <input
          type="range"
          min={i === 0 ? min : levels[i - 1]}
          max={i === levels.length - 1 ? max : levels[i + 1]}
          step="1"
          value={level}
          on:input={e => onLevelChange(i, e)}
          class="level-slider"
          disabled={i === 0 || i === levels.length - 1}
        />
        <span class="level-val">{Math.round(level)}m</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .contour-controls { display: flex; flex-direction: column; gap: 0.6rem; }

  .header-row { display: flex; align-items: center; justify-content: space-between; }

  h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-muted, #888);
    margin: 0;
  }

  .reset-btn {
    padding: 0.2rem 0.5rem;
    background: var(--color-card, #0f3460);
    border: 1px solid #333;
    color: inherit;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .reset-btn:hover { background: var(--color-surface, #16213e); }

  .field { display: flex; flex-direction: column; gap: 0.2rem; }
  .field label { font-size: 0.8rem; color: var(--color-muted, #888); }

  .n-slider { width: 100%; accent-color: var(--color-accent, #e94560); }

  .levels-list { display: flex; flex-direction: column; gap: 0.3rem; }

  .level-row { display: flex; align-items: center; gap: 0.5rem; }
  .level-index { font-size: 0.7rem; color: var(--color-muted, #888); width: 1.5rem; font-family: monospace; }
  .level-slider { flex: 1; accent-color: var(--color-accent, #e94560); }
  .level-slider:disabled { opacity: 0.4; }
  .level-val { font-size: 0.75rem; width: 3.5rem; text-align: right; font-family: monospace; }
</style>
