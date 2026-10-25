/**
 * A pre-drawn naturalist engraving, mounted and taped like a tipped-in plate.
 * Owner: Design System team. The image must be a real asset with provenance
 * (CLAUDE.md §4A.3) — this component never draws the artwork itself.
 */
export function SpecimenPlate({
  src,
  alt,
  title,
  note,
  rotate = -1.3,
  taped = "both",
  className = "",
}: {
  src: string;
  alt: string;
  title: string;
  note?: string;
  rotate?: number;
  taped?: "both" | "left" | "none";
  className?: string;
}) {
  return (
    <figure className={`relative m-0 ${className}`} style={{ transform: `rotate(${rotate}deg)` }}>
      {taped !== "none" && (
        <span aria-hidden className="absolute -top-2 left-7 h-[19px] w-[66px] -rotate-[19deg] border border-ochre-mark/25 bg-ochre-mark/30" />
      )}
      {taped === "both" && (
        <span aria-hidden className="absolute -top-2 right-7 h-[19px] w-[66px] rotate-[16deg] border border-ochre-mark/25 bg-ochre-mark/30" />
      )}
      <div className="relative border border-border bg-surface p-4 pb-[11px]">
        <span aria-hidden className="pointer-events-none absolute inset-[7px] border border-border" />
        <img src={src} alt={alt} className="block h-auto w-full" />
      </div>
      <div aria-hidden className="mx-[2px] mb-2 mt-3 h-px bg-border" />
      <figcaption className="flex items-baseline justify-between gap-3 px-[2px] font-mono text-[10.5px] tracking-[0.04em] text-text-muted">
        <span className="font-display text-[14px] italic text-text-primary">{title}</span>
        {note && <span>{note}</span>}
      </figcaption>
    </figure>
  );
}
