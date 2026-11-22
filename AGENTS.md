# AGENTS.md — Aesthetic Affinity Profiler

Instructions for AI coding agents (ChatGPT Codex / GPT-6 Astra and others) working in this repo.
Read this file and `docs/white-paper.md` before every task.

---

## 1. What this project is

A personal, local-only web app: an adaptive quiz that ranks the 90 consumer aesthetics in the
Consumer Aesthetics Research Institute (CARI) index (https://cari.institute/aesthetics) for one
person and reports their **top 3** and **bottom 3**, each with a confidence level.

How it works, in one line: 14 attribute sliders + 8 scenario picks build a user profile → a cosine
prior over all aesthetics → 10–18 adaptive best-worst (MaxDiff) screens update a Bayesian model →
the quiz stops when the top 3 and bottom 3 are each ≥ 80% certain.

This is a personal project. It is not deployed publicly and collects no data from anyone.

## 2. Source of truth

- `docs/white-paper.md` is the full spec.
- Its section **"Build spec for an AI coding agent"** defines what to build, in what order, and how
  to check it. Where a number there differs from the prose above it, the Build spec wins.
- Where this file and the white paper disagree on **rules** (what you may fetch, what you must ask
  about), **this file wins**.
- If the spec is unclear, incomplete or contradictory, stop and ask. Do not guess.

## 3. Stack

| Concern | Use |
| --- | --- |
| App | Next.js (App Router) + TypeScript (strict), static export (`output: "export"`) |
| Styling | Tailwind CSS |
| Validation | Zod schemas for every JSON data file, checked at build time |
| Unit tests | Vitest |
| End-to-end tests | Playwright, at 375 px and 1280 px wide |
| Randomness | Seeded PRNG (mulberry32) only; seed stored in the session |
| State | React state + `localStorage` for resume (every read/write wrapped in try/catch) |
| Fetch scripts | Node + TypeScript under `/scripts`, run manually, never at app runtime |

Do not add dependencies outside this table without asking.

## 4. Commands

```bash
npm install            # install
npm run dev            # local dev server
npm run build          # static export; must pass with zero errors
npm run lint           # ESLint + TypeScript check
npm test               # Vitest unit tests
npm run test:e2e       # Playwright end-to-end tests
npm run sim -- --users 1000   # simulation harness (CI size)
npm run sim -- --users 10000  # full simulation, on demand
npm run fetch:cari     # polite CARI fetch -> /cache and /data (see section 6)
```

If a command does not exist yet, create it in `package.json` as part of the task that needs it.

## 5. Repo layout

```text
/docs/white-paper.md     the spec (do not edit unless asked)
/data
  attributes.json        the 14 attributes
  aesthetics.json        90 aesthetics: catalog, codes, reveal fields
  sliders.json           Stage 1 items (14 + 2 swapped repeats)
  scenarios.json         Stage 2 items (8 x 4 options)
  stimuli.json           Stage 3 quiz images + reveal images
/cache                   raw CARI responses (gitignored)
/scripts
  fetch-cari.ts          polite CARI fetcher (section 6)
/src/schemas             Zod schemas, one per data file
/src/engine              pure scoring functions: config, profile, prior, update, select, decide, index
/src/app                 page.tsx (intro), quiz/page.tsx, results/page.tsx
/src/components          SliderItem, ScenarioItem, MaxDiffScreen, Board, PlaceholderTile,
                         PinEmbed, RevealCard, DraftBanner
/sim/simulate.ts         synthetic-respondent harness
/tests                   unit + e2e tests
```

## 6. Fetching data

### CARI (cari.institute) — allowed, politely, for local use

CARI's robots.txt allows all crawlers. You may fetch from CARI under these limits:

- **Scope:** only `https://cari.institute/sitemap.xml` and the `/aesthetics/<slug>` pages it lists.
  Nothing else on the domain.
- **What to extract:** name, icon URL, period of relevance, sorted decade, namesake, description,
  alternate names, "name coined by", "foundational research by", related aesthetics, and the
  Are.na board link. Write them into `aesthetics.json` (`decade`, `period`, `reveal.*`).
- **Rate:** at most 1 request every 3 seconds, one at a time. Back off and stop on any 429 or 5xx.
- **Identify yourself:** User-Agent `AestheticAffinityProfiler/0.1 (personal project; contact: <MAX_EMAIL>)`.
  Ask Max for the email if the placeholder is still there.
- **Cache:** save every raw response under `/cache` and reuse it. Never refetch a page fetched
  in the last 7 days unless asked.
- **Run manually only** via `npm run fetch:cari`. The app itself never calls CARI at runtime.
- **Images:** store gallery image URLs and Are.na block IDs only. Do not download or re-host
  gallery images. The app may hotlink them in local builds.
- **Pages render partly in the browser.** If a field is missing from the fetched HTML, leave it
  `null` and report it. Do not fill it from memory or guess.
- **Are.na:** to list gallery images, you may call the public Are.na API
  (`GET https://api.are.na/v3/channels/{id}/contents`) for each aesthetic's board, under the same rate
  limit and caching rules.

### Pinterest — never fetched by you

- Do not crawl, scrape, fetch or call any Pinterest endpoint or search, by any method. Pinterest's
  terms prohibit it.
- Pins are added by Max, by hand, one URL at a time, into `stimuli.json`.
- The app shows pins only through Pinterest's official Pin widget (`PinEmbed`), description off.

### Everything else

Do not fetch any other website. Package registries for `npm install` are fine.

## 7. Hard rules

1. **No invented data presented as real.** Unknown values stay `null` and render as placeholders.
2. **Label every attribute code's source** with `code_source`:
   - `illustrative` — the 3 example codes in the white paper
   - `ai_draft` — codes you draft (you may draft from fetched CARI descriptions)
   - `rated` — codes from human raters (only Max sets this)
   - `uncoded` — `codes: null`, prior mean 0
3. **Draft banner.** While any `ai_draft` code or placeholder image is in use, every page shows a
   banner saying so.
4. **Hide names until results.** No aesthetic name may appear during stages 1–3: not in visible
   text, alt text, `<title>`, URLs, query strings, data attributes or console logs.
5. **Two image pools, never mixed.** Stage 3 uses only `pool: "quiz"` stimuli (Pinterest pins or
   placeholders). The results reveal uses only `pool: "reveal"` (CARI gallery). No image URL may
   appear in both pools.
6. **No personal data, no backend, no analytics.** Nothing leaves the browser.
7. **Deterministic.** Use the seeded PRNG everywhere. Same seed + same answers = same result.
8. **Don't tune to pass.** Never change `CONFIG` values to make a test or the simulation pass
   without asking first.
9. **Don't edit the spec.** Do not modify `docs/white-paper.md` unless Max asks.

## 8. Code conventions

- TypeScript `strict: true`. No `any`, no `@ts-ignore` without a comment explaining why.
- `/src/engine` is pure: no React, no DOM, no `Math.random`, no I/O. The UI and the simulator
  both import from `src/engine/index.ts`.
- All constants live in `src/engine/config.ts` exactly as the white paper lists them.
- Data files are loaded through their Zod schemas. The build fails on any schema error.
- Accessibility: keyboard-operable, visible focus, tap targets ≥ 44 px, alt text on every image
  (describing what is shown, never naming the aesthetic before results).
- Small, readable functions. Comment the math in `update.ts` and `decide.ts` with the matching
  white-paper step number.

## 9. Workflow

- Work through the **Build tasks** in the white paper in order: 1 → 8.
- **One task per pull request** (tasks 5 + 6 and 7 + 8 may share a PR if Max says so).
- Before opening a PR, run `npm run lint`, `npm test`, `npm run build` (and `npm run test:e2e` /
  `npm run sim` when the task touches them). Paste the output summary into the PR.
- PR description format:

  ```markdown
  ## Task
  <number and name>

  ## What changed
  <short list>

  ## Acceptance checks
  - [x] <check> — pass (evidence)
  - [ ] <check> — FAIL (what happened, proposed fix)

  ## Placeholders / ai_draft still in use
  <list>

  ## Questions for Max
  <list or "none">
  ```

- After opening the PR, **stop and wait** for review before starting the next task.

## 10. Ask Max first before you

- Fetch anything outside the CARI sitemap pages and their Are.na boards
- Touch Pinterest in any way other than rendering pin URLs Max added
- Download or re-host any CARI or Pinterest image
- Deploy anywhere, including preview hosting
- Add analytics, a backend, or any data collection
- Change a value in `CONFIG`
- Add a dependency outside the stack table
- Mark any code as `rated`
- Skip, merge or reorder build tasks

## 11. Out of scope (phase 1)

Research API and database, Spanish version, share card, extra close-call screens, learned
attribute weights, public launch.

## 12. Definition of done (whole project)

- All 8 build tasks merged with every acceptance check passing (or a failure Max accepted).
- Simulation results reported: exact top-3 recovery, exact bottom-3 recovery, average overlap,
  median and 90th-percentile screens used. Target: ≥ 85% exact top-3 recovery.
- Final report to Max containing: repo tree, how to run locally, test + simulation results, and a
  list of every placeholder, `null` field and `ai_draft` value still in use.
