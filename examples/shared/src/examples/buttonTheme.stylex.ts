import * as stylex from "stylexn";

// The variables the ThemeDemo buttons read. StyleX requires defineVars in a
// *.stylex.ts file, as named exports.
export const buttonColors = stylex.defineVars({
  background: { default: "#6a3db8", "@media (prefers-color-scheme: dark)": "#8b5fd6" },
  pressed: "#4f2c8c",
  text: "#ffffff",
});
