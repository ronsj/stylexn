import * as stylex from "@stylexjs/stylex";
import { Hello } from "@stylexn/shared";

const styles = stylex.create({
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function Page() {
  return (
    <main {...stylex.props(styles.main)}>
      <Hello name="web" />
    </main>
  );
}
