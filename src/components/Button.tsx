import type { ButtonHTMLAttributes } from "react";

/**
 * Shared button primitive. Owner: Design System team.
 * Field Journal: a solid ink "stamp" for primary actions, an underlined italic
 * marginal link for secondary ones. Variants only — never restyle inline.
 */
type Variant = "primary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "font-display text-[17px] leading-none bg-text-primary text-bg px-6 py-3 rounded " +
    "transition-colors duration-cue ease-cue hover:bg-accent",
  ghost:
    "font-serif italic text-[16px] text-text-primary bg-transparent border-b border-text-primary " +
    "pb-1 rounded-none transition-colors duration-cue ease-cue hover:text-accent hover:border-accent",
};

export function Button({ variant = "primary", className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`${VARIANT[variant]} disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      {...rest}
    />
  );
}
