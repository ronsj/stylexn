import * as stylex from "@stylexjs/stylex";

// The site's design tokens. Colours follow prefers-color-scheme; there is no
// toggle. StyleX requires defineVars in a *.stylex.ts file, as named exports.

export const colors = stylex.defineVars({
  page: { default: "#ffffff", "@media (prefers-color-scheme: dark)": "#131316" },
  surface: { default: "#f6f6f9", "@media (prefers-color-scheme: dark)": "#1b1b20" },
  text: { default: "#1f1f24", "@media (prefers-color-scheme: dark)": "#ececf1" },
  muted: { default: "#585863", "@media (prefers-color-scheme: dark)": "#a6a6b1" },
  border: { default: "#e3e3ea", "@media (prefers-color-scheme: dark)": "#2e2e36" },
  accent: { default: "#6a3db8", "@media (prefers-color-scheme: dark)": "#bda1f5" },
  accentSoft: { default: "#f1ebfb", "@media (prefers-color-scheme: dark)": "#282236" },
  codeBg: { default: "#f5f3fa", "@media (prefers-color-scheme: dark)": "#1a1822" },
  codeText: { default: "#2b2540", "@media (prefers-color-scheme: dark)": "#e4def2" },
  codeComment: { default: "#6b6b78", "@media (prefers-color-scheme: dark)": "#8d8a9c" },
  codeKeyword: { default: "#8a2b8f", "@media (prefers-color-scheme: dark)": "#e39ae6" },
  codeString: { default: "#1d6b3a", "@media (prefers-color-scheme: dark)": "#8fd6a4" },
  codeNumber: { default: "#a1480b", "@media (prefers-color-scheme: dark)": "#f4b27a" },
  codeTag: { default: "#1f5aa6", "@media (prefers-color-scheme: dark)": "#8fbcf5" },
  focus: { default: "#6a3db8", "@media (prefers-color-scheme: dark)": "#c9b3ff" },
});

export const space = stylex.defineVars({
  xxs: "2px",
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "40px",
  xxxl: "64px",
});

export const fonts = stylex.defineVars({
  body: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
});

export const radii = stylex.defineVars({
  sm: "6px",
  md: "10px",
});
