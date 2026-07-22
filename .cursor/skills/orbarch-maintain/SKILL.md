---
name: orbarch-maintain
description: >-
  Maintain the OrbAch Web Assessments project (MATB-II cognitive test battery built on React 19 +
  Create React App). Use when making changes to this project: editing tasks, fixing bugs, tuning
  simulation config, adding localization, dependency upgrades, or addressing Dependabot/npm audit
  alerts. Encodes CRA-safe upgrade rules, the imperative task API contract, deep-link bootstrap,
  and the localization workflow.
---

# OrbAch Web Assessments — Maintenance Skill

Project: OrbAch Web Assessments (MATB-II, Reaction Time, N-Back) for KTH/ESERO.
Full context in `AGENTS.md` at repo root — read it first for any non-trivial change.

## Hard constraints (do not violate without explicit approval)

1. **Keep `react-scripts` at `5.0.1`.** Do not eject, do not migrate to Vite/Next, do not run
   `npm audit fix --force`. CRA's transitive dep tree is fragile.
2. **Transitive vuln pinning goes in `package.json` `overrides`** (not `resolutions`). After editing,
   run `npm install` to regenerate `package-lock.json`, then verify `npm run build` succeeds.
3. **Never rename or remove `forwardRef` imperative methods** on `MonitoringTask`, `TrackingTask`,
   `CommunicationsTask`, `ResourceManagementTask`, `SystemHealth`. `EventService` and `App.js` call
   them by name via `useImperativeHandle`. See the contract list in `AGENTS.md`.
4. **All user-facing strings go through i18next** (`useTranslation()` + `t('key')`). When adding or
   changing a key, update **all three** locale files: `src/locales/{en,sv,el}/translation.json`.
5. **Audio paths are build-critical.** `CommunicationsTask.jsx` and `NBackTest.jsx` use
   `require.context` over `src/assets/sounds/<lang>/` and `src/assets/nback-sounds/<lang>/`.
   Renaming/moving these folders breaks the Webpack bundle.

## Standard maintenance workflow

1. **Confirm working tree is clean** (`git status`). Branch off `master` for non-trivial work.
2. **Establish baseline:** `npm run build` must succeed; note `npm test` currently fails in jsdom
   on `window.matchMedia` (pre-existing, not your regression — see `AGENTS.md`).
3. **Make the smallest change that fixes the issue.** Prefer config edits over code edits, and
   code edits over dependency changes.
4. **After any change:** run `npm run build`. If it succeeds and the change is runtime-visible,
   also run `npm start` and smoke-test the affected route (see route table in `AGENTS.md`).
5. **Update `CHANGELOG.md`** under an Unreleased / version heading if user-facing.
6. **Commit** with a descriptive message; keep `master` always buildable (`CONTRIBUTING.md`).

## Dependency / Dependabot alerts

This is a **client-side-only** app shipped via GitHub Pages. Most transitive CVEs reported by
Dependabot live in **dev/build-time tooling** (webpack-dev-server, babel, jest, svgo, workbox,
postcss, css tools) and never reach end users. Prioritize:

- **Direct runtime deps that ship to users** (highest priority): `react`, `react-dom`,
  `react-router-dom`, `i18next`, `react-i18next`, `i18next-browser-languagedetector`, `chart.js`,
  `react-chartjs-2`, `web-vitals`.
- **Build-time only** (lower priority, but still patch if a clean override exists): everything
  pulled in by `react-scripts`.

### Patching a transitive vulnerability (CRA-safe)

```jsonc
// package.json
"overrides": {
  "react-scripts": "5.0.1",          // keep CRA pinned
  "typescript": "^4.9.5",            // existing override
  "<vulnerable-transitive-pkg>": "<fixed-version>"
}
```

Then:
```bash
npm install            # regenerate package-lock.json
npm run build          # MUST succeed
npm audit              # confirm the targeted advisory is gone
git diff package.json package-lock.json   # sanity check the diff
```

If `npm run build` breaks after an override, **revert the override** — compatibility with
`react-scripts@5.0.1` wins over silencing a dev-time advisory. Document the residual in the
commit message / CHANGELOG.

### What NOT to do

- `npm audit fix --force` (replaces `react-scripts`, breaks CRA).
- `npm install <pkg>@latest` for transitive deps (use overrides instead).
- Editing `package-lock.json` by hand.

## Localization changes

1. Edit `src/locales/en/translation.json` first (it's the source of truth / fallback).
2. Mirror the key in `sv` and `el`. Use `{{var}}` for interpolation (e.g. `{{duration}}`, `{{n}}`).
3. For new audio assets, follow `ADDING_NEW_LANGUAGE.md` and `scripts/scaffold_new_language.sh`.
4. Force a language in dev with `?lng=sv` or `?lng=el` on any route.

## Simulation tuning

- **Game balance constants:** `src/config/simulationConfig.js`
  (`COMM_CONFIG`, `RESOURCE_CONFIG`, `TRACK_CONFIG`, `MONITOR_CONFIG`).
- **Difficulty (1–10) → event scaling:** `services/EventService.js`.
- **MATB grid layout / mobile scaling:** `src/App.js` (search for `computeScale`, `matchMedia`)
  and `src/App.css`.

## Smoke-test checklist (per area)

| Area | Route | What to check |
|---|---|---|
| Main menu | `/` | Renders, language switcher works, mode buttons launch |
| Full MATB | `/normal` | All 4 tasks + System Health active, events fire, score saves |
| Monitoring only | `/monitoring` | F1–F6 respond to keys/clicks |
| Tracking only | `/tracking` | Cursor drifts, AUTO/MANUAL toggle, WASD/arrows work |
| Comms only | `/comms` | Audio plays for current lang, ESA504 calls respond |
| Resource only | `/resource` | Tanks drain, pumps toggle/fail, target levels hold |
| Reaction Time | `/reaction-default` | 8 stimuli, RT recorded, results chart renders |
| N-Back | `/nbackdefault` | 2-back, 20 trials, letter+position audio plays |
| Suite | `/suite` | Intro → RT → N-Back×4 → MATB×2 → Results |
| Education | `/simulator`, `/blueprint`, `/condition-lab`, `/model-lab` | Sliders/placeholders update cognition read-out |

## Common gotchas

- **`window.matchMedia` in tests:** jsdom doesn't implement it. If a test touches `App.js` mobile
  scaling, add a `window.matchMedia` mock in `src/setupTests.js` rather than "fixing" `App.js`.
- **`process.env.PUBLIC_URL`:** set by CRA from `homepage` in `package.json`
  (`https://magkosm.github.io/orbarch-edu`). Used as `BrowserRouter` basename. Don't hardcode paths.
- **`404.html` SPA redirect:** `pathSegmentsToKeep = 1` — required for deep links on GitHub Pages.
- **`require.context` audio:** changing the folder layout or filenames silently breaks the bundle.
- **`StrictMode` double-invokes effects in dev** — task init effects run twice; design them idempotent.

## File-edit decision tree

```
Need to change behavior?
├── Tuning numbers (EPM, rates, durations) → src/config/simulationConfig.js
├── Difficulty scaling → services/EventService.js
├── Layout / mobile scale → src/App.js + src/App.css
├── A single task's internals → src/<Task>.jsx (preserve imperative API!)
├── Routing / deep link → src/index.js (route table + matb_start_params)
├── User-facing text → src/locales/{en,sv,el}/translation.json (all three)
└── Dependency / CVE → package.json overrides (see above)
```
