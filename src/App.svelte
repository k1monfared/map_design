<script>
  import './app.css'
  import Home from './pages/Home.svelte'
  import WorldMap from './pages/WorldMap.svelte'
  import TopoMap from './pages/TopoMap.svelte'

  let route = getRoute()

  function getRoute() {
    const hash = window.location.hash
    if (hash.startsWith('#/world-map')) return 'world-map'
    if (hash.startsWith('#/topo-map')) return 'topo-map'
    return 'home'
  }

  window.addEventListener('hashchange', () => {
    route = getRoute()
  })
</script>

{#if route === 'home'}
  <Home />
{:else if route === 'world-map'}
  <WorldMap />
{:else if route === 'topo-map'}
  <TopoMap />
{:else}
  <Home />
{/if}
