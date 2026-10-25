import woodcockInk from "./woodcock_ink.webp";
import yellowhammerInk from "./yellowhammer_ink.webp";
import bluejayVine from "./bluejay_vine.webp";

/**
 * The journal's plates, as printed behind pages by `FieldArt`. Owner: Design
 * System team. Every file here is a real public-domain plate or a cut-out of
 * one, recorded in PROVENANCE.md (CLAUDE.md §4A.3). Add a plate here and there
 * together, or not at all.
 *
 * `engraving`: a black-line wood-engraving shipped as an alpha mask and painted
 * in the `--cue-art-ink` token. `plate`: hand-coloured, shown as drawn (through
 * `--cue-art-plate-filter` in the dark scheme).
 */
export interface Plate {
  src: string;
  kind: "engraving" | "plate";
  /** Width / height of the file. */
  ratio: number;
  /** Short credit line, shown where a plate is captioned. */
  credit: string;
}

export const PLATES = {
  woodcock: { src: woodcockInk, kind: "engraving", ratio: 826 / 643, credit: "Woodcock, after Bewick" },
  yellowhammer: { src: yellowhammerInk, kind: "engraving", ratio: 760 / 513, credit: "Yellowhammer, after Bewick" },
  bluejayVine: { src: bluejayVine, kind: "plate", ratio: 420 / 445, credit: "Trumpet creeper, after Audubon" },
} satisfies Record<string, Plate>;

export type PlateName = keyof typeof PLATES;
