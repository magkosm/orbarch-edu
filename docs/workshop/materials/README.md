# Workshop materials

Print-and-go resources for the [workshop](../README.md). Most files are ready to
use as-is.

## Ready-made PDFs (no print menu needed) → [`pdf/`](./pdf)

Pre-rendered so you can just open and print/AirPrint at 100%:

- **A3 landscape handouts:** `pdf/handout-en.pdf` · `pdf/handout-sv.pdf` · `pdf/handout-el.pdf`
- **A4 portrait teacher notes:** `pdf/teacher-notes-en.pdf` · `pdf/teacher-notes-sv.pdf` · `pdf/teacher-notes-el.pdf`
- **A4 portrait workshop overview** (for coordinators / schools): `pdf/workshop-overview-en.pdf` · `pdf/workshop-overview-sv.pdf` · `pdf/workshop-overview-el.pdf`
- **A4 QR sheets (one QR per page):** `pdf/qr-en.pdf` · `pdf/qr-sv.pdf` · `pdf/qr-el.pdf`

> In the macOS print dialog just pick the printer and **Print** — the page size
> (A3 landscape / A4) is baked into each PDF, so you don't need to fiddle with
> paper size or orientation. Regenerate with the commands at the bottom.

## Print these

| File | Format | What it is |
| --- | --- | --- |
| [`qr-codes.html`](./qr-codes.html) | **A4** | Printable QR sheet — **one big QR per page**, with a language picker (EN/SV/EL), using the local images in [`qr/`](./qr). Pick a language → Print. |
| [`handout-en.html`](./handout-en.html) · [`handout-sv.html`](./handout-sv.html) · [`handout-el.html`](./handout-el.html) | **A3 landscape** | Student worksheet (scores, mission checklist, big sketch box, pitch, exit ticket). Open → Print A3. |
| [`teacher-notes-en.html`](./teacher-notes-en.html) · [`teacher-notes-sv.html`](./teacher-notes-sv.html) · [`teacher-notes-el.html`](./teacher-notes-el.html) | **A4 portrait** | Teacher run-sheet (prep checklist, timing, prompts, troubleshooting). Open → Print A4. |
| [`workshop-overview-en.html`](./workshop-overview-en.html) · [`workshop-overview-sv.html`](./workshop-overview-sv.html) · [`workshop-overview-el.html`](./workshop-overview-el.html) | **A4 portrait** | **Workshop description** for coordinators, schools, and train-the-trainer — summary, objectives, flow, materials list. |

> Open the HTML files in any browser and use the **Print** button (page sizes are
> already set: A4 for QR, A3 for handouts).

## Build the deck

| File | What it is |
| --- | --- |
| [`slides-en.md`](./slides-en.md) · [`slides-sv.md`](./slides-sv.md) · [`slides-el.md`](./slides-el.md) | **Full slide text** per language — paste into PowerPoint/Google Slides/Keynote, add visuals where marked `[IMAGE]/[QR]`. |
| [`slides-outline.md`](./slides-outline.md) | Slide-by-slide structure (reference). |
| [`slides/slide-04.html`](./slides/slide-04.html) · [`slides/slide-04-en.png`](./slides/slide-04-en.png) | **Slide 4 visual** (16:9) — environment → stress → cognition diagram. SV/EL PNGs: `slide-04-sv.png`, `slide-04-el.png`. |

Export your finished decks here (binary; add explicitly with `git add -f`):
`slides-en.pptx` · `slides-sv.pptx` · `slides-el.pptx` · `slides.pdf` — *placeholders*.

## QR images

`qr/` holds PNGs named `<tool>-<lang>.png` (e.g. `blueprint-sv.png`) at 600×600.
Regenerate them after any URL change with:

```bash
npm i qrcode --no-save && node docs/workshop/materials/gen-qr.js
```

## Print checklist

- [ ] `qr-codes.html` → print the language page(s) you need (A4).
- [ ] `handout-XX.html` → 1 per student (A3 landscape).
- [ ] `teacher-notes-XX.html` or `pdf/teacher-notes-XX.pdf` → 1 for the teacher (A4 portrait).
- [ ] **Two sticky notes per student** for the exit ticket.
- [ ] Whiteboard markers (stress discussion stays up all class).
- [ ] Slides on the projector — **one QR at a time** during experiments.
- [ ] A3 paper, rulers, markers for sketching (or just use the A3 handout's box).
- [ ] Room speakers tested (the Condition Lab also makes noise in-browser).

## Regenerate the PDFs

The PDFs in `pdf/` are rendered from the HTML with headless Chrome (page sizes
come from each file's `@page` CSS — A3 landscape for handouts, A4 for QR):

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Handouts (A3 landscape)
for l in en sv el; do "$CHROME" --headless=new --no-pdf-header-footer \
  --user-data-dir=/tmp/c-$l \
  --print-to-pdf="docs/workshop/materials/pdf/handout-$l.pdf" \
  "file://$PWD/docs/workshop/materials/handout-$l.html"; done
# Teacher notes (A4 portrait)
for l in en sv el; do "$CHROME" --headless=new --no-pdf-header-footer \
  --user-data-dir=/tmp/ctn-$l \
  --print-to-pdf="docs/workshop/materials/pdf/teacher-notes-$l.pdf" \
  "file://$PWD/docs/workshop/materials/teacher-notes-$l.html"; done
# Workshop overview / description (A4 portrait)
for l in en sv el; do "$CHROME" --headless=new --no-pdf-header-footer \
  --user-data-dir=/tmp/cwo-$l \
  --print-to-pdf="docs/workshop/materials/pdf/workshop-overview-$l.pdf" \
  "file://$PWD/docs/workshop/materials/workshop-overview-$l.html"; done
# QR sheets (A4, one per page)
for l in en sv el; do "$CHROME" --headless=new --no-pdf-header-footer \
  --user-data-dir=/tmp/cq-$l \
  --print-to-pdf="docs/workshop/materials/pdf/qr-$l.pdf" \
  "file://$PWD/docs/workshop/materials/qr-codes.html?lng=$l"; done
```

## Optional extras (placeholders)

- `cabin-noise.mp3` — *ambient cabin/fan noise for the room speakers*.
- `name-tags.pdf` / `group-cards.pdf` — *optional team materials*.

## Pilot feedback

After the first 60-student run (3 groups of 20), see
[`../workshop-feedback.md`](../workshop-feedback.md) for debrief notes, ESERO Greece
deployment planning, and product backlog (pathway-access tool, teacher portal).
