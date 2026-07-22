# Changelog

All notable changes to this project will be documented in this file.

## [2.1.2] - 2026-07-23

### Security
- **Dependency audit remediation (Dependabot)** — patched 51 of 54 reported vulnerabilities
  via CRA-safe `overrides` in `package.json`. No `npm audit fix --force` was run and
  `react-scripts` remains pinned at `5.0.1`. Build, tests, and dev server verified unchanged.
  - **`react-router-dom` upgraded `7.12.0` → `^7.18.1`** (direct runtime dep that ships to
    users — addresses CVE-2026-33245, CVE-2026-42211, CVE-2026-42342, CVE-2026-34077 and
    related high-severity advisories on `react-router`).
  - **Transitive build/dev tooling patched via overrides:** `nth-check`, `postcss`, `lodash`,
    `jsonpath`, `qs`, `minimatch`, `rollup`, `serialize-javascript`, `underscore`, `svgo`,
    `flatted`, `picomatch`, `yaml`, `node-forge`, `brace-expansion`, `path-to-regexp`,
    `follow-redirects`, `fast-uri`, `@babel/plugin-transform-modules-systemjs`, `@babel/core`,
    `@tootallnate/once`, `uuid`, `ws`, `shell-quote`, `launch-editor`, `form-data`,
    `http-proxy-middleware`, `js-yaml`, `websocket-driver`, `sockjs`.
  - **3 residual moderate advisories remain in `webpack-dev-server@4.15.2`** (GHSA-9jgg-88mc-972h,
    GHSA-4v9v-hfq4-rm2v, GHSA-79cf-xcqc-c78w, and related). These are **dev-server-only**;
    `react-scripts@5.0.1` pins `webpack-dev-server@^4`, and forcing v5 breaks the CRA build.
    No runtime/production exposure — `npm run build` output is unaffected. Tracked as accepted
    residual risk pending a future migration off Create React App.

### Added
- **`AGENTS.md`** — project knowledge file for AI coding agents working in this repo
  (architecture, stack constraints, conventions, dependency policy).
- **`.cursor/skills/orbarch-maintain/SKILL.md`** — maintenance skill encoding CRA-safe upgrade
  rules, the imperative task API contract, localization workflow, and smoke-test checklist.
- **`.cursor/rules/`** — three persistent Cursor rules:
  - `cra-safety.mdc` (always-on) — forbids eject / `audit fix --force`, mandates `overrides`.
  - `matb-imperative-api.mdc` — preserves `forwardRef` method names on the four MATB tasks.
  - `i18n-localization.mdc` — enforces i18next usage and three-locale mirroring.
- **`src/routing.test.js`** — new Jest suite (7 tests) that exercises client-side routing
  via `MemoryRouter`. Specifically guards the `react-router-dom` upgrade by asserting each
  public route reaches its target component and unknown routes redirect to `/`.
- **`src/setupTests.js`** — extended with the standard jsdom polyfills the app needs to
  mount under Jest (`matchMedia`, `scrollTo`, `HTMLMediaElement.play`, `TextEncoder`).
  Plus a Jest `moduleNameMapper` entry in `package.json` to resolve
  `react-router/dom` (subpath export) under Jest 27, which CRA pins.

### Fixed
- **`npm test` now passes** (was failing pre-existing). The smoke test in `App.test.js`
  threw `TypeError: window.matchMedia is not a function` because jsdom does not implement
  `matchMedia` and `App.js` uses it in a `useEffect` for mobile scaling. Polyfilled in
  `setupTests.js` per CRA/Testing Library guidance — no application code changed.

### Notes
- `npm test` previously failed in jsdom on `window.matchMedia is not a function`
  (pre-existing, unrelated to the dependency changes — `App.js:633` uses matchMedia for
  mobile scaling). Now fixed via the `setupTests.js` polyfill above.
- **Runtime parity verified end-to-end** (not just build parity): booted the dev server
  and drove every public route via JSDOM. `/` renders the MainMenu, `/comms` renders
  `ESA504` + all four radio channels (NAV1/NAV2/COM1/COM2), `/tracking` renders
  `TRACKING TASK - AUTO`, `/resource` renders tanks A–F and all 8 pumps, `/monitoring`
  renders F1–F6, and all 320 audio assets across `en`/`sv`/`el`/`legacy` load successfully.
  `npm run build` produces a working bundle (271 kB gz, +2 kB from the router upgrade).

## [2.1.1] - 2026-06-11

Minor workshop documentation fixes and refreshed print PDFs.

### Added
- **Workshop overview sheets (EN / SV / EL)** — A4 coordinator-facing description
  (`workshop-overview-*.html` + PDFs): summary, objectives, session flow, materials
  list, and closing messages. Distinct from the day-of teacher run-sheet.

### Changed
- **Main README** — **EDUCATORS HERE** link moved to the top; removed duplicate
  workshop section at the bottom.
- **Refreshed PDFs:** `handout-el.pdf`, `teacher-notes-sv.pdf`, `teacher-notes-el.pdf`
  (aligned with Jun 11 HTML updates).

### Fixed
- **`workshop-feedback.md`** — duration corrected to ~90–120 min; revision checklist
  updated to reflect completed materials work.

## [2.1.0] - 2026-06-10

Workshop documentation release — integrates the **first large-scale classroom pilot**
(60 students, 3 × ~20) and follow-up planning from facilitators, ESERO Greece, and
KTH. No application code changes; the live app remains v2.0.0 feature-complete.

### Added
- **Teacher notes (EN / SV / EL)** — A4 run-sheets with the revised Blocks A–D flow,
  pilot learnings, and troubleshooting; pre-rendered PDFs in
  `docs/workshop/materials/pdf/teacher-notes-*.pdf`.
- **[`docs/workshop/workshop-feedback.md`](docs/workshop/workshop-feedback.md)** —
  debrief from the pilot: what worked (Blueprint Designer, phone tools), friction
  (MATB complexity, Safari, corridor-access rule), ESERO Greece nationwide-deployment
  needs, and product backlog (pathway-access overlay, hidden teacher portal).
- **Closing slide copy** (EN / SV / EL): *Space is for everyone · Architecture is
  about people · Design is a series of trade-offs · You are the future of space
  exploration.*
- **Educator entry point** in the main [`README.md`](README.md) — links to the
  workshop hub, language plans, print materials, and pilot feedback.

### Changed
- **Workshop structure rewritten** (~90–120 min) to match how the session is
  actually run: extended presentation (station history, Wandt/Columbus photo,
  whiteboard stress discussion, cognitive tests, MDRS/ISS context), MATB taught on
  the **projector via Presets** before student QR codes, learning-effect /
  plateau discussion on the whiteboard, **one QR at a time**, high-scorer Blueprint
  mirrored to the class, optional Model Lab, two-post-it exit ticket.
- **Locale-specific presentation hooks:** Sweden (Fuglesang, Wandt / ESA) and
  Greece (Golemis, Magkos experiment ~45% of Wandt science time).
- **Handouts updated** — Reaction Time row, MATB dry-run row, learning-effect note,
  two sticky-note exit ticket; slide outlines expanded to ~24 slides.
- **Workshop README** and materials index updated for the new flow and print checklist.

### Pilot feedback captured (for next iteration)
- Phones mostly worked; **Chrome preferred over Safari** when issues appear.
- **MATB:** strong for some students, hard for others — demo on projector first.
- **Blueprint Designer** highly engaging; **entrance corridor rule** must be repeated;
  pathway-access UX is a priority improvement.
- **ESERO Greece (11 Jun 2026):** nationwide rollout needs train-the-trainer materials
  and stronger advance planning.

## [2.0.0] - 2026-06-09
Official v2 release — **operational**. Adds an interactive education layer on top
of the assessment battery and a fully responsive, installable mobile experience.

### Added
- **Space Architecture & Cognitive Performance Simulator** (`/simulator`): sliders
  for Noise / Biophilia / Clutter / Lighting with a live cognitive read-out.
- **Habitat Blueprint Designer** (`/blueprint`): place architectural features on a
  7×5 module grid that drives both **crew cognition** and **mission value**
  (Science / Health / Life Support), combined into a **Mission Success** score.
  Includes a starting scenario with a live mission-brief checklist, an entrance
  **access rule** (every module needs a clear corridor to the mid-left entrance),
  hover descriptions, and a simulated reaction-time read-out.
- **Condition Lab** (`/condition-lab`): a self-contained Web Audio cabin-noise
  stressor plus a baseline-vs-stressed MATB comparison to quantify the effect of
  environment on performance.
- **Model Lab** (`/model-lab`): build your own simulator — define custom inputs and
  outcomes wired with positive/negative **linear interactions**, including
  **input-to-input coupling**. Features an interactive, toggleable wire/node
  **interaction map** (value sliders on nodes, relative wire thickness,
  good/bad effect colouring, low-value/high-value warnings, relationship
  highlighting), good/bad polarity per input & outcome, and localStorage persistence.
- **Fullscreen toggle** plus web-app meta tags for an installable, chrome-less
  experience on Android/desktop and "Add to Home Screen" on iOS.
- **MIT License** (KTH / ESERO Sweden / Michail Magkos) and full project
  documentation, including related-project links surfaced in the main menu.

### Changed
- **Responsive MATB on phones**: the task grid is now uniformly scaled to fit the
  screen (portrait and landscape) so every control stays usable.
- **Project / deployment renamed** to `orbarch-edu`
  (https://magkosm.github.io/orbarch-edu), with redirects preserving old links.
- New strings localised across English, Swedish and Greek.


## [1.0.2] - 2026-01-28
### Fixed
- **Deep Linking Isolation**: Fixed an issue where task-specific links (e.g., `/comms`, `/tracking`) were activating all tasks. These links now correctly isolate the intended task with matched training presets (3m duration, difficulty 6, and instruction overlays).
- **Route Normalization**: Removed duplicate routes and standardized the deep link configuration in `index.js`.
- **Custom Mode Robustness**: Improved `App.js` startup logic to explicitly disable unrequested tasks when launched via partial parameters.


## [1.0.1] - 2026-01-28
### Added
- **Dynamic Background Synchronization**: Users' selected environments (Cupola, Columbus, CASA) now sync across all tests (RT, N-Back, and MATB) even when accessed independently.
- **Improved Test Readability**: Semi-transparent overlays added to test screens to ensure readability over vibrant background environments.

### Fixed
- **Scoreboard Integration**: Fixed a missing import that prevented high scores from being saved in Reaction Time and N-Back tests.
- **MATB Panel Transparency**: Adjusted MATB task panels to be semi-transparent, allowing the selected backdrop to show through for a more immersive experience.


## [1.0.0] - 2026-01-28
### Added
- **Official Release**: Formally released the OrbAch Web Assessment Suite.
- **Tracking Performance Visualization**: Added RMS Error time-plot to MATB results for detailed performance analysis.
- **Multilingual Support**: Fully integrated English, Greek, and Swedish languages across all tests and audio assets.
- **Automatic Scoring**: Standardized scoring and accuracy calculations for RT, N-Back, and MATB tasks.
- **Data Export**: Comprehensive CSV export functionality for all test results and performance logs.

### Fixed
- **Logging Integrity**: Fixed a critical bug in Tracking task where high-frequency logs were being overwritten.
- **Master Aggregate Export**: Corrected field mappings in suite-wide CSV exports for consistent metric reporting.
- **Performance Optimization**: Removed unnecessary debug logging and improved sensor data sampling for smoother rendering.
- **Suite Flow**: Standardized the transition between Easy and Hard MATB scenarios with appropriate resets.
