# Changelog

All notable changes to this project will be documented in this file.

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
