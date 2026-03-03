<script>
  import { createEventDispatcher } from 'svelte'

  export let features = []
  export let selected = new Set()
  export let label = 'Countries'

  const dispatch = createEventDispatcher()

  let searchQuery = ''

  $: filtered = features.filter(f => {
    const name = f.properties?.NAME ?? f.properties?.name ?? ''
    const iso = f.properties?.ISO_A2 ?? f.properties?.iso_a2 ?? ''
    const q = searchQuery.toLowerCase()
    return name.toLowerCase().includes(q) || iso.toLowerCase().includes(q)
  })

  $: sortedFiltered = [...filtered].sort((a, b) => {
    const na = a.properties?.NAME ?? a.properties?.name ?? ''
    const nb = b.properties?.NAME ?? b.properties?.name ?? ''
    return na.localeCompare(nb)
  })

  function toggle(iso) {
    const next = new Set(selected)
    if (next.has(iso)) next.delete(iso)
    else next.add(iso)
    selected = next
    dispatch('change', selected)
  }

  function selectAll() {
    selected = new Set(features.map(f => f.properties?.ISO_A2 ?? f.properties?.iso_a2 ?? ''))
    dispatch('change', selected)
  }

  function invertSelection() {
    const all = new Set(features.map(f => f.properties?.ISO_A2 ?? f.properties?.iso_a2 ?? ''))
    const next = new Set()
    for (const iso of all) {
      if (!selected.has(iso)) next.add(iso)
    }
    selected = next
    dispatch('change', selected)
  }

  function clearSelection() {
    selected = new Set()
    dispatch('change', selected)
  }
</script>

<div class="region-selector">
  <h3>{label} <span class="count">({selected.size}/{features.length})</span></h3>

  <div class="search-row">
    <input
      type="search"
      bind:value={searchQuery}
      placeholder="Search…"
      class="search-input"
    />
  </div>

  <div class="bulk-actions">
    <button on:click={selectAll}>All</button>
    <button on:click={invertSelection}>Invert</button>
    <button on:click={clearSelection}>Clear</button>
  </div>

  <div class="list">
    {#each sortedFiltered as feature}
      {@const iso = feature.properties?.ISO_A2 ?? feature.properties?.iso_a2 ?? ''}
      {@const name = feature.properties?.NAME ?? feature.properties?.name ?? iso}
      <label class="item">
        <input
          type="checkbox"
          checked={selected.has(iso)}
          on:change={() => toggle(iso)}
        />
        <span class="name">{name}</span>
        <span class="iso">{iso}</span>
      </label>
    {/each}
    {#if sortedFiltered.length === 0}
      <p class="empty">No results</p>
    {/if}
  </div>
</div>

<style>
  .region-selector { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; }

  h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--color-muted, #888);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .count { font-weight: 400; }

  .search-input {
    width: 100%;
    padding: 0.4rem 0.6rem;
    background: var(--color-card, #0f3460);
    border: 1px solid #333;
    color: inherit;
    border-radius: 0.4rem;
    font-size: 0.85rem;
  }

  .bulk-actions { display: flex; gap: 0.4rem; }
  .bulk-actions button {
    padding: 0.2rem 0.6rem;
    background: var(--color-card, #0f3460);
    border: 1px solid #333;
    color: inherit;
    border-radius: 0.3rem;
    font-size: 0.75rem;
    cursor: pointer;
  }
  .bulk-actions button:hover { background: var(--color-surface, #16213e); }

  .list {
    overflow-y: auto;
    max-height: 300px;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    border: 1px solid #222;
    border-radius: 0.4rem;
    padding: 0.3rem;
    background: var(--color-card, #0f3460);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.3rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.82rem;
  }
  .item:hover { background: rgba(255,255,255,0.06); }
  .name { flex: 1; }
  .iso { color: var(--color-muted, #888); font-size: 0.7rem; font-family: monospace; }

  .empty { color: var(--color-muted, #888); font-size: 0.8rem; text-align: center; padding: 1rem; margin: 0; }
</style>
