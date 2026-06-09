# Changelog

All notable changes to this project will be documented in this file.

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
