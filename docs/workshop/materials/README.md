# Workshop materials

Print-and-go resources for the [workshop](../README.md). Most files are ready to
use as-is.

## Print these

| File | Format | What it is |
| --- | --- | --- |
| [`qr-codes.html`](./qr-codes.html) | **A4** | Printable QR sheet (one page per language) using the local images in [`qr/`](./qr). Open → Print. |
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

## Optional extras (placeholders)

- `cabin-noise.mp3` — *ambient cabin/fan noise for the room speakers*.
- `name-tags.pdf` / `group-cards.pdf` — *optional team materials*.
