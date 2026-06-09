# Orbital Architecture — Web Assessment Battery

A browser-based suite of cognitive and multitasking assessments built for the
**Orbital Architecture** research project. The project studies how the design of
confined, high-stress environments (space stations, submarines, Arctic stations,
offshore platforms) affects human stress, cognition and performance.

The project is led by **Michail Magkos** at **KTH Royal Institute of Technology**,
with **ESERO Sweden** as a collaborator in the development and funding of this
web-based educational tool.

These same tests have been used **in space** by ESA astronaut **Marcus Wandt**
during the ESA project astronaut mission **Muninn** (aboard the International Space
Station, January 2024), and in the **ISAE-SUPAERO** analog missions to the **Mars
Desert Research Station (MDRS)** in Utah — crews **MDRS 275, 293, 311 and 330**.

**Live app:** https://magkosm.github.io/orbarch-edu

---

## What's inside

The battery bundles three families of tasks:

- **MATB-II (Multi-Attribute Task Battery)** — a multitasking environment with four
  concurrent tasks:
  - **System Monitoring** — detect and respond to abnormal gauges/lights (F1–F6).
  - **Tracking** — keep a drifting cursor centred (keyboard or touch).
  - **Communications** — respond to radio calls addressed to your callsign.
  - **Resource Management** — keep fuel tanks within tolerance using pumps.
  - A live **System Health** gauge aggregates performance across all four.
- **Reaction Time** — press the spacebar as fast as possible when a red circle appears.
- **N-Back (2-Back) Memory** — indicate when the current stimulus matches the one
  shown two steps earlier.

Modes include Normal (timed), Infinite, Custom, single-task Training presets, and a
Suite mode that chains several tests together. The UI is fully internationalised
(English / Swedish / Greek), supports selectable environment backgrounds (Cupola,
Columbus, CASA), and is responsive for phones in both portrait and landscape.

---

## Deep links / routes

The app can be launched straight into a specific test via URL (handy for embedding
in instructions). Append `?lng=sv` or `?lng=el` to force a language.

| Route | Test |
| --- | --- |
| `/` | Main menu |
| `/normal` | Full MATB-II, 5-minute run |
| `/2min` | Full MATB-II, 2-minute run |
| `/monitoring` | System Monitoring (training preset) |
| `/tracking` | Tracking (training preset) |
| `/comms` | Communications (training preset) |
| `/resource` | Resource Management (training preset) |
| `/reaction` | Reaction Time (with config screen) |
| `/reaction-default` | Reaction Time (quick start, default params) |
| `/nback` | N-Back (with config screen) |
| `/nbackdefault` | N-Back (quick start, default params) |
| `/suite` | Suite manager (chained tests) |

---

## Tech stack

- [React 19](https://react.dev/) bootstrapped with Create React App
- [react-router-dom](https://reactrouter.com/) for routing / deep links
- [react-i18next](https://react.i18next.com/) for localisation (en/sv/el)
- [Chart.js](https://www.chartjs.org/) via `react-chartjs-2` for performance plots
- Deployed to **GitHub Pages** with [`gh-pages`](https://github.com/tschaub/gh-pages)

---

## Getting started

```bash
npm install      # install dependencies
npm start        # run the dev server at http://localhost:3000
npm test         # run the test runner
npm run build    # production build into ./build
```

### Deployment

The live site is published to GitHub Pages from the local `build/` output:

```bash
npm run deploy   # runs the production build, then pushes ./build to the gh-pages branch
```

The published URL is controlled by the `homepage` field in `package.json`.

---

## Project structure

```
public/                 Static assets, index.html, manifest, icons
src/
  App.js                Main MATB-II app shell + task grid + game-mode wiring
  index.js              Entry point and all route definitions (deep links)
  MonitoringTask.jsx    System Monitoring task
  TrackingTask.jsx      Tracking task
  CommunicationsTask.jsx Communications task
  ResourceManagementTask.jsx Resource Management task
  components/           Menus, games (Reaction/N-Back), health gauge, sidebar, etc.
  services/             EventService (scheduler), BackgroundService, ScoreboardService
  config/               Simulation tuning (simulationConfig.js)
  i18n.js               Localisation setup and translation strings
```

---

## Related projects & pages

- **ESERO Sweden — Orbital Architecture (try the tests):** https://www.esero.se/orbital-architecture/
- **KTH news (English):** https://www.kth.se/en/om/nyheter/centrala-nyheter/svensk-astronaut-deltar-i-kth-forskning-i-rymden-1.1300047
- **KTH news (Swedish):** https://www.kth.se/om/nyheter/centrala-nyheter/svensk-astronaut-deltar-i-kth-forskning-i-rymden-1.1300047
- **KTH Ergonomics — Architectural Properties' Impact on Stress and Cognition:** https://www.kth.se/mth/ergonomi/forskning/architectural-properties-impact-on-stress-and-cognition-1.1302002
- **ESA Exploration blog — "I need more space":** https://blogs.esa.int/exploration/i-need-more-space/
- **NASA ISS Research Explorer:** https://www.nasa.gov/mission/station/research-explorer/investigation/?#id=9082

---

## Credits

Developed for the Orbital Architecture research project.

- **KTH Royal Institute of Technology** — project lead **Michail Magkos**
  (Department of Ergonomics).
- **ESERO Sweden** — collaborator in the development and funding of this
  web-based educational tool.

The underlying research project is supported by **Rymdstyrelsen** (the Swedish
National Space Agency). The MATB-II paradigm is based on NASA's Multi-Attribute
Task Battery.

### Where it has been used

- **In space:** ESA project astronaut mission **Muninn** (Marcus Wandt, ISS,
  January 2024).
- **Analog missions:** ISAE-SUPAERO crews at the **Mars Desert Research Station
  (MDRS)**, Utah — **MDRS 275, 293, 311 and 330**.

---

## License

Released under the **MIT License**, shared between KTH Royal Institute of
Technology, ESERO Sweden, and Michail Magkos. See [`LICENSE`](./LICENSE) for the
full text.
