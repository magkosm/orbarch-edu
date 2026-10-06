# Educator hub pipeline

The educator hub lives at **`public/educators/`** and is served by GitHub Pages at
`https://magkosm.github.io/orbarch-edu/educators/` (plain static files — no React route
needed). It is linked from the footer of the app's main hub ("For educators …").

**Never edit `public/educators/` by hand** — everything there is generated:

| Source | Generates |
| --- | --- |
| `scripts/educators/content.json` — all hub/guide/feedback texts in `en`/`sv`/`el` | `index.html`, `feedback.html`, `view.html`, `guides/*.html`, `educators.css`, `educators.js` |
| `docs/workshop/**` (plans, print materials, PDFs, QR images) + `CHANGELOG.md` | `public/educators/materials/**` (verbatim copy) |
| the running app, captured by `capture_screenshots.js` | `public/educators/screenshots/{en,sv,el}/*.png` |

## Rebuild the pages (after editing content.json or anything in docs/workshop)

```bash
python3 scripts/build_educators.py
```

Standard library only. It prints which referenced screenshots are missing.

## Regenerate the screenshots (after UI or locale changes)

Uses the installed Google Chrome through `puppeteer-core` (no browser download, nothing added
to the repo's dependency tree — same pattern as `docs/workshop/materials/gen-qr.js`):

```bash
npm run build                                   # screenshots are taken from the production build
mkdir -p /tmp/shots && cd /tmp/shots && npm init -y >/dev/null && npm i puppeteer-core
node /path/to/repo/scripts/educators/capture_screenshots.js   # ~10 min (it plays full 2-minute MATB runs)
cd /path/to/repo && python3 scripts/build_educators.py
```

The script starts its own static server for `./build` (SPA fallback for the deep links) on
port 5174, captures every screen listed at the top of the file for each language at
1280×800 (plus a few phone-sized views), and writes the PNGs into
`public/educators/screenshots/<lang>/`. Set `CHROME_PATH` if Chrome is not at the default
macOS location; `LANGS=en` restricts the run.

## Content model

`content.json` → `site` (titles, URLs, UI strings), `tools` and `presets` (deep-link table),
`guides[]` → `steps[]`. Every text is `{ "en": …, "sv": …, "el": … }`; a missing translation
falls back to English at build time. Each step may have `shot` (screenshot name without
extension), `teacher`, `student`, `handout`, `tip`. Quote app UI labels exactly as they appear
in `src/locales/<lang>/translation.json`.

## Feedback form

No backend. The form composes a text summary and offers: **Send by e-mail** (`mailto:` to
`site.contact_email`), **Copy text**, **Open as a GitHub issue** (prefilled), **Download .txt**.
To collect submissions automatically, set `site.feedback_endpoint` in `content.json` to a
form endpoint that accepts a JSON POST (e.g. a Formspree form) and rebuild — a **Send** button
then appears. Drafts are kept in the teacher's browser (`localStorage`) until cleared.
