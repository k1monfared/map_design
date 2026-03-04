<script>
  // Home page — pick a tool
</script>

<div class="home">
  <header>
    <h1>Map Design Tools</h1>
    <p>Generate wall-art-quality map outputs in your browser</p>
  </header>

  <div class="tools">
    <a href="#/world-map" class="card">
      <div class="icon">🗺️</div>
      <h2>World Map Wall Art</h2>
      <p>Select countries, customize colors, and export a print-ready world map.</p>
      <span class="cta">Open Tool →</span>
    </a>

    <a href="#/topo-map" class="card">
      <div class="icon">⛰️</div>
      <h2>Custom Topographic Map</h2>
      <p>Search any location, draw a frame, and generate contour art for printing or CNC.</p>
      <span class="cta">Open Tool →</span>
    </a>
  </div>
</div>

<style>
  .home {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 3rem;
  }

  header {
    text-align: center;
  }

  header h1 {
    font-size: 3rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 0.5rem;
  }

  header p {
    font-size: 1.2rem;
    color: var(--color-muted);
  }

  .tools {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    max-width: 800px;
    width: 100%;
  }

  .card {
    background: var(--color-card);
    border-radius: 1rem;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
  }

  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  }

  .icon {
    font-size: 2.5rem;
  }

  .card h2 {
    font-size: 1.4rem;
    font-weight: 600;
  }

  .card p {
    color: var(--color-muted);
    line-height: 1.6;
    flex: 1;
  }

  .cta {
    color: var(--color-accent);
    font-weight: 600;
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
</style>
