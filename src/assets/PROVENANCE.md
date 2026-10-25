# Artwork provenance

Per CLAUDE.md §4A.3, every shipped illustration is real, pre-drawn artwork with a
recorded origin and license. No model- or code-generated SVG is used as illustration.

| File | Work | Author | Source | License |
| --- | --- | --- | --- | --- |
| `bluejay_final.jpg` | *Blue Jay*, Plate CII, from *The Birds of America* (1827–38) | John James Audubon (engraved by R. Havell) | Wikimedia Commons (`102 Blue Jay.jpg`) | Public domain (author d. 1851) |
| `yellowhammer_final.png` | Yellowhammer wood-engraving, from *A History of British Birds* | Thomas Bewick (1753–1828) | Wikimedia Commons (`Brief History of Wood-engraving Bewick Yellowhammer.png`) | Public domain |
| `woodcock_ink.webp` | Woodcock wood-engraving, from *A History of British Birds*, vol. 2 (1804) | Thomas Bewick (1753–1828) | `design/assets/woodcock_final.png` (working set; originally Wikimedia Commons, exact file name not recorded) | Public domain (author d. 1828) |

### Derivatives used by `FieldArt` (2026-10-24)

Mechanical conversions of the plates above, for faded page backdrops (`src/assets/art.ts`).
No line was redrawn or added.

| File | Made from | Change |
| --- | --- | --- |
| `woodcock_ink.webp` | `design/assets/woodcock_final.png` | Grayscale converted to an alpha mask (ink = opaque, paper = clear) so the `--cue-art-ink` token colors it |
| `yellowhammer_ink.webp` | `yellowhammer_final.png` | Same alpha-mask conversion |
| `bluejay_vine.webp` | `bluejay_final.jpg` | Crop of the trumpet-creeper branch (x 30–450, y 385–830); paper color removed to transparency |

The two `_final` images were cropped and tonally cleaned for the Field Journal direction; the
originals are unmodified public-domain works. If either is replaced, update this file.

## TODO(art)

- Paper-texture surface for the journal background is currently a flat token color.
  A real scanned-paper texture asset can be dropped in later; do not substitute a
  procedurally generated grain (CLAUDE.md §4A.3).
- Confirm the woodcock's exact Wikimedia Commons file name and fill it in above.
