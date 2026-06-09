# Workshop materials

Print-and-go resources for the [workshop](../README.md). Most files are ready to
use as-is.

## Ready-made PDFs (no print menu needed) → [`pdf/`](./pdf)

Pre-rendered so you can just open and print/AirPrint at 100%:

- **A3 landscape handouts:** `pdf/handout-en.pdf` · `pdf/handout-sv.pdf` · `pdf/handout-el.pdf`
- **A4 QR sheets (one QR per page):** `pdf/qr-en.pdf` · `pdf/qr-sv.pdf` · `pdf/qr-el.pdf`

> In the macOS print dialog just pick the printer and **Print** — the page size
> (A3 landscape / A4) is baked into each PDF, so you don't need to fiddle with
> paper size or orientation. Regenerate with the commands at the bottom.

## Print these

| File | Format | What it is |
| --- | --- | --- |
| [`qr-codes.html`](./qr-codes.html) | **A4** | Printable QR sheet — **one big QR per page**, with a language picker (EN/SV/EL), using the local images in [`qr/`](./qr). Pick a language → Print. |
| [`handout-en.html`](./handout-en.html) · [`handout-sv.html`](./handout-sv.html) · [`handout-el.html`](./handout-el.html) | **A3** | Student worksheet (scores, mission checklist, big sketch box, pitch, exit ticket). Open → Print A3. |

> Open the HTML files in any browser and use the **Print** button (page sizes are
> already set: A4 for QR, A3 for handouts).

## Build the deck

| File | What it is |
| --- | --- |
| [`slides-en.md`](./slides-en.md) · [`slides-sv.md`](./slides-sv.md) · [`slides-el.md`](./slides-el.md) | **Full slide text** per language — paste into PowerPoint/Google Slides/Keynote, add visuals where marked `[IMAGE]/[QR]`. |
| [`slides-outline.md`](./slides-outline.md) | Slide-by-slide structure (reference). |

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
- [ ] `handout-XX.html` → 1 per student or pair (A3).
- [ ] Slides on the projector.
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
# QR sheets (A4, one per page)
for l in en sv el; do "$CHROME" --headless=new --no-pdf-header-footer \
  --user-data-dir=/tmp/cq-$l \
  --print-to-pdf="docs/workshop/materials/pdf/qr-$l.pdf" \
  "file://$PWD/docs/workshop/materials/qr-codes.html?lng=$l"; done
```

## Optional extras (placeholders)

- `cabin-noise.mp3` — *ambient cabin/fan noise for the room speakers*.
- `name-tags.pdf` / `group-cards.pdf` — *optional team materials*.
