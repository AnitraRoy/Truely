/**
 * Theme preference → <html data-theme>. Owner: Design System team.
 * Light is the default and the product's identity; dark and "system" are opt-in
 * (PRD §11 asked for dark-first, CLAUDE.md's Field Journal direction wins).
 * The colour values themselves live in tokens.css.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light journal",
  dark: "Dark",
  system: "Match my device",
};

export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (theme === "light") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
