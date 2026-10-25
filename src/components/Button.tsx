import type { ButtonHTMLAttributes } from "react";

/**
 * Shared button primitive. Owner: Design System team.
 * Private Field Journal: a forest "stamp" for the one primary action on a
 * surface, an outlined secondary for its peers, and an underlined italic
 * marginal link for quiet tertiary actions. Variants only — never restyle inline.
 */
/** "inverse" sits on the forest `Sheet tone="accent"` field. */
type Variant = "primary" | "secondary" | "inverse" | "ghost";
/** "sm" is for tight surfaces like the floating session overlay. */
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "font-sans font-medium leading-none bg-accent text-on-accent rounded " +
    "transition-colors duration-cue ease-cue hover:bg-accent-hover disabled:hover:bg-accent",
  secondary:
    "font-sans font-medium leading-none bg-surface text-text-primary border border-border-strong rounded " +
    "transition-colors duration-cue ease-cue hover:border-text-primary",
  inverse:
    "font-sans font-medium leading-none bg-on-accent text-accent rounded " +
    "transition-colors duration-cue ease-cue hover:bg-bg",
  ghost:
    "font-serif italic text-text-primary bg-transparent border-b border-text-primary " +
    "pb-1 rounded-none transition-colors duration-cue ease-cue hover:text-accent hover:border-accent",
};

const SIZE: Record<Variant, Record<Size, string>> = {
  primary: { md: "min-h-11 text-[15px] px-5 py-3", sm: "min-h-8 text-[13.5px] px-3.5 py-2" },
  secondary: { md: "min-h-11 text-[15px] px-5 py-3", sm: "min-h-8 text-[13.5px] px-3.5 py-2" },
  inverse: { md: "min-h-11 text-[15px] px-5 py-3", sm: "min-h-8 text-[13.5px] px-3.5 py-2" },
  ghost: { md: "text-[16px]", sm: "text-[14px]" },
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANT[variant]} ${SIZE[variant][size]} disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}
