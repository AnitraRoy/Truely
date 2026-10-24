import type { ReactNode, RefObject } from "react";

/** Shared step heading; focusable so the wizard can move focus to it on step change. */
export function StepHeading({
  headingRef,
  children,
  size = "lg",
}: {
  headingRef: RefObject<HTMLHeadingElement>;
  children: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <h1
      ref={headingRef}
      tabIndex={-1}
      className={`text-balance font-display font-semibold leading-[1.02] tracking-[-0.015em] focus:outline-none ${
        size === "lg" ? "text-[clamp(36px,6vw,64px)]" : "text-[clamp(28px,4vw,40px)]"
      }`}
    >
      {children}
    </h1>
  );
}
