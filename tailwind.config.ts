import type { Config } from "tailwindcss";

// Field Journal design tokens, surfaced from src/styles/tokens.css so every
// screen pulls from one source. Owner: Design System team (CLAUDE.md §7).
// Re-skinning the app = editing tokens.css, never component hex/px/font stacks.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--cue-bg) / <alpha-value>)",
        surface: "rgb(var(--cue-surface) / <alpha-value>)",
        border: "rgb(var(--cue-border) / <alpha-value>)",
        accent: "rgb(var(--cue-accent) / <alpha-value>)",
        ochre: "rgb(var(--cue-ochre) / <alpha-value>)",
        positive: "rgb(var(--cue-positive) / <alpha-value>)",
        warning: "rgb(var(--cue-warning) / <alpha-value>)",
        "text-primary": "rgb(var(--cue-text-primary) / <alpha-value>)",
        "text-muted": "rgb(var(--cue-text-muted) / <alpha-value>)",
      },
      fontFamily: {
        display: "var(--cue-font-display)",
        serif: "var(--cue-font-serif)",
        mono: "var(--cue-font-mono)",
      },
      borderRadius: {
        DEFAULT: "var(--cue-radius)",
        pill: "var(--cue-radius-pill)",
      },
      transitionTimingFunction: { cue: "var(--cue-ease)" },
      transitionDuration: { cue: "240ms", "cue-fast": "140ms" },
    },
  },
  plugins: [],
} satisfies Config;
