import * as stylex from "stylexn";

// StyleX requires defineVars in a *.stylex.ts file, as named exports.
export const colors = stylex.defineVars({
  accent: { default: "rebeccapurple", "@media (prefers-color-scheme: dark)": "#b48ee6" },
  onAccent: "#ffffff",
});
