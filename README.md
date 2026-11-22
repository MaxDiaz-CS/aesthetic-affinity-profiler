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

## Review the dimension tags

`data/dimensions.json` defines 16 dimension groups. Ordinal values run from −2 to +2.
A blank ordinal cell means that the CARI text supplies insufficient evidence for the
axis. Zero means the source supports a midpoint or a mix of both poles.
Multi-hot cells use JSON arrays, with `[]` for an unassigned group. Active decades
come from the description where it identifies the aesthetic's period. The decade
group is reserved for the separate era prior.

The seed judgments in `data/cari_tag_seed.json` use the snapshot's CARI
descriptions and listed motifs. Run `npm run tags:draft` to generate a review
sheet from that seed. The command preserves edits in an existing review file.
In `data/cari_tag_review.csv`, review each vector, confidence level, and motif
against its linked CARI entry. The draft identifies each motif's source as the
motif list or a verbatim phrase from the description. Sparse entries are flagged
for review. `motif_provenance` is regenerated when publishing from the approved
motif selections.

For the agreement check, have two reviewers independently tag the same 20
entries before showing them the draft. Compare exact and within-one-point
agreement on jointly rated ordinal axes, and Jaccard similarity on jointly
populated categorical groups. Report how often each reviewer left a group
unassigned and resolve disagreements in the review sheet.

Set `approval` to `approved` after checking a row. Run `npm run tags:check` to
validate the sheet. `npm run tags:publish` writes `data/aesthetics.json` once all
rows are approved and each has three to eight source-backed motifs.
