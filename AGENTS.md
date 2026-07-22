# AGENTS.md — OrbAch Web Assessments

> Project knowledge for AI coding agents working in this repository.
> Maintained alongside the human-facing `README.md`. Keep this file accurate.

## What this project is

Browser-based cognitive assessment battery for the **Orbital Architecture** research project
(KTH Royal Institute of Technology / ESERO Sweden, PI: Michail Magkos `magkos@kth.se`).
Used aboard the ISS (ESA astronaut Marcus Wandt, Muninn mission) and in MDRS analog missions.

- **Version:** `package.json` is the source of truth (currently 2.1.1).
- **Live site:** https://magkosm.github.io/orbarch-edu (GitHub Pages, `gh-pages` branch).
- **Repo:** https://github.com/magkosm/orbarch-edu (note: local folder is `matb-web-test`).
- **License:** MIT © KTH / ESERO Sweden / Michail Magkos.

**Three task families + an education layer:**
1. **MATB-II** — four concurrent tasks (System Monitoring, Tracking, Communications, Resource Management) + System Health gauge.
2. **Reaction Time** — spacebar/click on red stimulus.
3. **N-Back (dual 2-Back)** — letter + position memory.
4. **Education layer (v2.0.0+):** Space Architecture Simulator, Habitat Blueprint Designer, Condition Lab, Model Lab.

## Stack (do not migrate without explicit approval)

- **React 19** + **Create React App** via `react-scripts@5.0.1` (pinned).
- **react-router-dom v7** (BrowserRouter with `basename={process.env.PUBLIC_URL}`).
- **i18next** + react-i18next + browser language detector. Locales: `en`, `sv`, `el`.
- **chart.js** + react-chartjs-2 for results plots.
- **gh-pages** for deployment.
- **JS/JSX only** — no TypeScript in source (TS 4.9.5 is only a transitive devDep / override).

### Why CRA matters here
`react-scripts@5.0.1` pins webpack 5, Babel 7, Jest 27, ESLint 8, and many transitive deps.
**Do not run `npm audit fix --force`** — it will try to replace `react-scripts` and break the build.
Transitive vulnerabilities must be addressed via `overrides` in `package.json` (CRA-safe).

## Directory map

```
src/
├── index.js              # Entry + route table (15 routes) + MatbEventBridge
├── App.js                # MATB-II shell (6×2 grid, game modes, mobile scaling)
├── App.css               # Grid/HUD/sidebar layout
├── i18n.js               # i18next setup (querystring → cookie → localStorage → navigator)
├── MonitoringTask.jsx    # MATB: F1–F6 gauges/lights      (forwardRef)
├── TrackingTask.jsx      # MATB: drifting cursor          (forwardRef)
├── CommunicationsTask.jsx# MATB: radio call-outs ESA504   (forwardRef, largest file ~2100 LOC)
├── ResourceManagementTask.jsx # MATB: tanks A–F, 8 pumps  (forwardRef)
├── components/           # ~30 components (game modes, sub-tasks, education, UI)
├── services/             # EventService (singleton scheduler), BackgroundService, ScoreboardService
├── config/simulationConfig.js  # Central tuning (COMM_CONFIG, RESOURCE_CONFIG, TRACK_CONFIG, MONITOR_CONFIG)
├── hooks/                # useAutoScroll, useGamepads
├── utils/                # csvExport, cognitiveModel
├── locales/{en,sv,el}/translation.json
├── assets/sounds/{en,sv,el}/   # ~80 MATB comms wavs per lang + transcript.txt
├── assets/nback-sounds/{en,sv,el}/ # 8 letter wavs (C H K N R W X Y)
├── assets/flags/{us,sv,el}.svg
└── backgrounds/          # Cupola.jpg, Columbus.jpg, CASA.jpeg
public/                   # index.html, 404.html (SPA redirect shim), manifest.json, favicon, logos
scripts/                  # scaffold_new_language.sh, generate_comms.py, generate_nback_sounds.py
docs/                     # workshop/ is tracked; other docs are gitignored (see .gitignore)
build/                    # gitignored production output
```

## Critical architecture patterns

### Imperative task API
All four MATB tasks are `forwardRef` components exposing imperative methods via `useImperativeHandle`
so `EventService` can drive them without prop-drilling state:
- `MonitoringTask`: `triggerMultipleEvents`, `resetTask`, `togglePause`, `setPause`, `isPaused`
- `TrackingTask`: `forceManualControl`, `resetTask`
- `CommunicationsTask`: `triggerCall`, `isActiveMessage`, `getActiveMessageAge`, `clearActiveMessage`, `resetTask`
- `ResourceManagementTask`: `triggerMultiplePumpFailures`, `setFuelLossRate`, `resetTask`
- `SystemHealth`: `getHealth`, `resetHealth`, `applyDiscretePenalty`

**When editing tasks:** preserve these imperative method names — `EventService` and `App.js` call them by string contract.

### EventService singleton
`services/EventService.js` exports a module-level singleton (`eventService`) plus a `useEventService()` hook.
It holds task refs, schedules events at a configurable EPM with jitter, runs a 250 ms `setInterval` tick,
and scales difficulty (1–10) into per-task event counts/durations/drift forces. It is **not** React context.

### Deep links & auto-start
`src/index.js` defines 15 routes. Custom-mode deep links (`/monitoring`, `/tracking`, `/comms`, `/resource`,
`/reaction-default`, `/nbackdefault`) write `matb_start_params` to localStorage, render `<App />`,
which reads params synchronously in the `useState` initializer (so the menu never flashes) and auto-starts.
Language is forced via `?lng=sv|el` querystring.

### Audio bundling (CRA `require.context`)
`CommunicationsTask.jsx` and `NBackTest.jsx` use Webpack's `require.context` to dynamically bundle
~80 wavs/language. **Any path or naming change breaks the build.** Re-generation uses
`scripts/generate_comms.py` / `scripts/generate_nback_sounds.py` (ElevenLabs TTS, key in gitignored `API KEY/`).

## Commands

```bash
npm start         # dev server on :3000
npm run build     # production build → ./build (also runs on `predeploy`)
npm test          # Jest watch (CI=true npm test for one-shot)
npm run deploy    # build + push ./build to gh-pages branch
```

**Known:** `npm test` currently fails in CI/jsdom with `window.matchMedia is not a function`
(pre-existing — jsdom lacks matchMedia; `App.js:633` uses it for mobile scaling). This is **not** a regression.

## localStorage keys (do not rename without migration)

`matb_start_params` (deep-link bootstrap, cleared after use), `matb_background_setting`,
`matb_normal_scores`, `matb_infinite_scores`, `matb_reaction_scores`, `matb_nback_scores`,
`i18nextLng`, `trackingInputMode`, `orbarch_model_config`.

## Global keyboard shortcuts

- `Ctrl+Q` — exit to main menu (all modes)
- `Shift+S+Q` — hidden: clear all scores (in `MainMenu`)
- `Ctrl+Shift+N` — debug: skip current step in `SuiteManager`

## Conventions to follow

- **No new dependencies without justification.** CRA's dep tree is fragile; adding/changing top-level
  packages can flip the webpack/Babel/Jest graph and re-introduce build failures.
- **Edit `package.json` `overrides`** (not `resolutions`) for transitive vuln pinning. Then `npm install` (regenerates `package-lock.json`).
- **Keep `react-scripts` at `5.0.1`** unless explicitly migrating off CRA.
- **Preserve `forwardRef` + imperative handle contracts** on the four MATB tasks and SystemHealth.
- **All user-facing strings go through i18next** (`useTranslation()` + `t('key')`). Update all three locale files (`en`, `sv`, `el`) together. See `ADDING_NEW_LANGUAGE.md`.
- **Browserslist** in `package.json` controls the build target — don't narrow it without checking the deployed audience.
- **Commit policy** (`CONTRIBUTING.md`): commit early/often, keep `master` always buildable, descriptive messages.
- **`docs/*` is gitignored except `docs/workshop/`** — don't add random docs to `docs/` root; they won't be tracked.

## Files that are safe to ignore (stale backups, gitignored cruft)

- `src/App.js.backup`, `src/CommunicationsTask.jsx.backup`, `src/CommunicationsTask.jsx.bak`, `src/CommunicationsTask.jsx.fixed`
- `build/` (gitignored), `node_modules/` (gitignored), `API KEY/` (gitignored — holds ElevenLabs key)

## Where to look for tuning

- **Game balance:** `src/config/simulationConfig.js` (tank capacities, flow rates, EPM multipliers, response windows).
- **Difficulty scaling math:** `services/EventService.js` (difficulty 1–10 → event counts/durations/drift).
- **MATB layout / mobile scaling:** `src/App.js` (CSS grid + `transform: scale(...)` media queries) and `src/App.css`.
- **Education-layer cognition model:** `src/utils/cognitiveModel.js` (`computeMetrics`, `reactionTimeMs`).

## Dependency & vulnerability policy

- This is a **client-side-only** app — most CVEs in transitive deps affect dev/build-time tooling
  (webpack-dev-server, babel, jest, svgo, workbox), not the shipped runtime bundle.
- Apply transitive fixes via `package.json` `overrides` and verify `npm run build` still succeeds and
  the bundle behavior is unchanged. Avoid `npm audit fix --force`.
- Direct runtime deps that ship to users: `react`, `react-dom`, `react-router-dom`, `i18next`,
  `react-i18next`, `i18next-browser-languagedetector`, `chart.js`, `react-chartjs-2`, `web-vitals`.
  These are the ones that matter most for end-user security.

## Related docs (read when relevant)

- `README.md` — overview, deep-link tables, deployment.
- `CHANGELOG.md` — version history.
- `CONTRIBUTING.md` — commit policy.
- `ADDING_NEW_LANGUAGE.md` + `scripts/scaffold_new_language.sh` — new locale workflow.
- `MODE_LINKS.md` — production & localhost deep-link tables.
- `docs/CODEBASE_OVERVIEW.md`, `docs/AUDIT_REPORT.md`, `docs/REFACTORING_PLAN.md` — older architecture notes.
