# Workshop deck generator (KTH template)

Builds `docs/workshop/materials/slides-{en,sv,el}.pptx` — the 25-slide deck for
"The Architect's Mind in Orbit" — on the official KTH PowerPoint template, with the
workshop's photos, app screenshots, QR codes and speaker notes.

- `build_workshop_deck.py` — the generator (python-pptx + pymupdf; no other dependencies).
- `strings.json` — every slide text in `en`, `sv`, `el` (same structure as `materials/slides-*.md`).

The KTH template and the photos are **not** in this repository (KTH brand assets; ESA/NASA/ISAE
photo credits). Point `WORKDIR` at a folder that contains them:

```
WORKDIR/
  kth-template.pptx       # the official KTH PowerPoint template (OneDrive-KTH/Presentation1.pptx); its slides are dropped, master/layouts kept
  assets/                 # image32.jpeg (Destiny lab, © ESA–M. Wandt), image34.jpg, image37.jpg (Guidice art),
                          # image43.jpeg (Wandt), image44.jpg (ISS), image45.jpg, image46.jpg (Cupola), image47.jpeg (CASA),
                          # esero-white.png (ESERO Sweden logo)
  kth/ppt/media/          # unzipped media of the KTH deck (logos image16/69/70/71, image41 MDRS crew, image52 N-Back, image39 Muninn)
  school/ppt/media/       # unzipped media of the school deck (image28 MDRS desert, image48 PVT, image49 MATB)
```

```bash
pip install python-pptx pymupdf
for l in en sv el; do WORKDIR=~/deck-inputs python3 scripts/workshop_deck/build_workshop_deck.py $l docs/workshop/materials/slides-$l.pptx; done
# PDF export: open in PowerPoint → Save as PDF (or Keynote/LibreOffice), save as slides-<lang>.pdf
```

Screenshots are taken from `public/educators/screenshots/<lang>/` (regenerate with
`scripts/educators/capture_screenshots.js` after UI changes) and QR codes from
`docs/workshop/materials/qr/`. The educator hub links to the decks via the repository's raw URLs,
so they are tracked once, under `docs/workshop/materials/`.
