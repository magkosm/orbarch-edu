# Changelog

All notable changes to this project will be documented in this file.

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
