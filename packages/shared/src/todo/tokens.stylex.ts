import * as stylex from "stylexn";

// The todo app's design tokens. StyleX requires defineVars in a *.stylex.ts
// file, as named exports. Values with a `prefers-color-scheme` condition
// follow the system theme on both platforms.

const DARK = "@media (prefers-color-scheme: dark)";

export const colors = stylex.defineVars({
  accent: { default: "#6a3db8", [DARK]: "#a987e6" },
  accentHover: { default: "#7d52c9", [DARK]: "#bba0ec" },
  accentPressed: { default: "#4f2c8c", [DARK]: "#8b5fd6" },
  accentSoft: { default: "#efe9f9", [DARK]: "#2e2640" },
  onAccent: { default: "#ffffff", [DARK]: "#1a1324" },
  background: { default: "#f4f1f9", [DARK]: "#121016" },
  surface: { default: "#ffffff", [DARK]: "#1f1c26" },
  surfaceHover: { default: "#f8f6fc", [DARK]: "#27232f" },
  text: { default: "#1f1b26", [DARK]: "#f3f0f8" },
  muted: { default: "#6f6880", [DARK]: "#a39db0" },
  border: { default: "#e4dff0", [DARK]: "#3a3445" },
  danger: { default: "#c2410c", [DARK]: "#fb923c" },
  dangerSoft: { default: "#fdeee6", [DARK]: "#3b2418" },
  focusRing: "#f0a531",
});

// Lengths carry a unit: a bare number in a CSS custom property is not a
// length on the web. Native folds both kinds to points: rem at runtime
// against the root font size (1rem = 16), px one to one. Spacing uses rem
// and radii px, so the todo app exercises both.
export const space = stylex.defineVars({
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
});

export const radii = stylex.defineVars({
  sm: "6px",
  md: "10px",
  lg: "16px",
  pill: "9999px",
});
