# Aesthetic Affinity Profiler

The Aesthetic Affinity Profiler uses the [Consumer Aesthetics Research Institute index](https://cari.institute/aesthetics) as its catalog.

## Refresh the catalog

Use a supported Node.js version (see `package.json`).

```sh
npm ci
npx playwright install chromium
npm run scrape:cari
npm run check:scraper
```

The scraper scrolls through CARI's live index, checks the count and uniqueness of the rendered entries, then waits 1.5 seconds before each sequential entry visit. It writes the finished snapshot to `data/cari_snapshot_<UTC date>.json`. To use system Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

If Chromium cannot run, `npm run scrape:cari -- --http` reads the index and its official pagination endpoint, then fetches only the entry HTML. For offline verification of a capture, set `CARI_CAPTURE_DIRECTORY` in this mode to a folder with `index.html`, `page-1.json` onward and one `<slug>.html` per entry.

The snapshot preserves CARI's text and entry-level researcher credits. Timeline endpoints come from the index when the entry omits them. Empty lists indicate the source provided no structured items. Related entries use CARI slugs. The snapshot contains text and links. See [CARI's attribution guidelines](https://cari.institute/attribution-guidelines).
