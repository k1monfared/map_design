# Map Design Tools

**Status**: 🟡 MVP | **Mode**: 🤖 Claude Code | **Updated**: 2026-03-03

Two browser-based tools for generating wall-art-quality map outputs — no backend, no API keys, runs entirely in your browser.

**Live site**: https://k1monfared.github.io/map_design/
**Source**: https://github.com/k1monfared/map_design

---

## Tools

### Tool 1 — World Map Wall Art
Select countries, customize colors and palettes, toggle borders and an elevation/bathymetry backdrop, then export at print resolution.

### Tool 2 — Custom Topographic Map
Search any location, draw a bounding box on the map, generate contour art from real elevation data, and export for printing or CNC cutting.

---

## Run Locally

```bash
git clone git@github.com:k1monfared/map_design.git
cd map_design
./dev.sh
```

Opens at **http://localhost:5173/map_design/**

To build for production:

```bash
./build.sh
```

Output goes to `dist/`.

---

## Export Formats

| Format | Use case |
|--------|----------|
| SVG    | Scalable vector, works in Illustrator/Inkscape/browsers |
| PDF    | Vector, opens in any PDF viewer |
| PNG    | Raster at user-specified DPI and physical size |
| TIFF   | Raster, compatible with print workflows |
| ZIP (CNC) | One SVG per contour level for laser cutters / CNC machines |

---

## Permanent Links

Every configuration is encoded in the URL hash — copy the URL and the exact map state is restored in any browser, no login needed.

---

## Data Sources

| Data | Source | Notes |
|------|--------|-------|
| Country borders | Natural Earth (TopoJSON) | Bundled, 110m and 50m resolutions |
| Land/ocean elevation | AWS Terrarium tiles | Free, no API key |
| Lake bathymetry | NOAA ETOPO1 ImageServer | Free, no API key; large lakes only |
| Location search | Nominatim (OpenStreetMap) | Free, no API key |
| Map tiles | OpenStreetMap | Free |

---

## Documentation

- `STATUS.log` — project status and milestone tracking
- `CLAUDE.md` — development conventions and Claude Code instructions
