import type { CSSProperties } from "react";
import { PLATES, type PlateName } from "@/assets/art";

export type ArtFade = "top-right" | "bottom-right" | "up" | "left";

/**
 * A journal plate printed faintly into the page, fading out toward the content
 * it sits beside. Owner: Design System team. It fills deliberate empty space
 * (a page header's right side, the foot of a short page, the side toolbar);
 * it never carries information, so it is hidden from assistive tech.
 *
 * Colour, strength and dark-scheme treatment come from the `--cue-art-*`
 * tokens (see `.field-art` in index.css). Position and size come from
 * `className`. Never used on a screen with a live camera preview
 * (CLAUDE.md §4A.3, §6), and never under body text without the fade.
 */
export function FieldArt({
  plate,
  fade = "top-right",
  strength = "soft",
  className = "",
}: {
  plate: PlateName;
  fade?: ArtFade;
  /** `strong` only for small vignettes kept clear of text. */
  strength?: "soft" | "strong";
  className?: string;
}) {
  const p = PLATES[plate];
  return (
    <div aria-hidden className={`field-art ${className}`} data-fade={fade} data-strength={strength}>
      {p.kind === "engraving" ? (
        <div className="field-art__ink" style={{ aspectRatio: String(p.ratio), "--art-src": `url("${p.src}")` } as CSSProperties} />
      ) : (
        <img src={p.src} alt="" className="field-art__plate" draggable={false} />
      )}
    </div>
  );
}
