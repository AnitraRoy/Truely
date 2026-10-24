import type { ButtonHTMLAttributes } from "react";

/**
 * Shared button primitive. Owner: Design System team.
 * Field Journal: a solid ink "stamp" for primary actions, an underlined italic
 * marginal link for secondary ones. Variants only — never restyle inline.
 */
type Variant = "primary" | "ghost";
/** "sm" is for tight surfaces like the floating session overlay. */
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary:
    "font-display leading-none bg-text-primary text-bg rounded " +
    "transition-colors duration-cue ease-cue hover:bg-accent",
  ghost:
    "font-serif italic text-text-primary bg-transparent border-b border-text-primary " +
    "pb-1 rounded-none transition-colors duration-cue ease-cue hover:text-accent hover:border-accent",
};

const SIZE: Record<Variant, Record<Size, string>> = {
  primary: { md: "text-[17px] px-6 py-3", sm: "text-[14px] px-3.5 py-2" },
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
