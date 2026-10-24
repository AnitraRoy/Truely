import type { Config } from "tailwindcss";

// Design tokens live here so every screen pulls from one source.
// Owner: Design System team. See src/styles/tokens.css.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral dark interface (PRD §11). Swap values via CSS vars in tokens.css.
        bg: "rgb(var(--cue-bg) / <alpha-value>)",
        surface: "rgb(var(--cue-surface) / <alpha-value>)",
        border: "rgb(var(--cue-border) / <alpha-value>)",
        accent: "rgb(var(--cue-accent) / <alpha-value>)",
        positive: "rgb(var(--cue-positive) / <alpha-value>)",
        warning: "rgb(var(--cue-warning) / <alpha-value>)",
        "text-primary": "rgb(var(--cue-text-primary) / <alpha-value>)",
        "text-muted": "rgb(var(--cue-text-muted) / <alpha-value>)",
      },
    },
  },
  plugins: [],
} satisfies Config;
