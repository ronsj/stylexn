import * as stylex from "@stylexjs/stylex";
import { greeting } from "./greeting";

// Web variant. Metro picks Hello.native.tsx on iOS/Android instead.
// Styled with StyleX so the web build proves the compiler reaches
// workspace packages, not just files inside apps/web.
const styles = stylex.create({
  root: {
    fontFamily: "system-ui, sans-serif",
    fontSize: 24,
    color: "rebeccapurple",
    padding: 16,
  },
});

export function Hello({ name }: { name: string }) {
  return <p {...stylex.props(styles.root)}>{greeting(name)}</p>;
}
