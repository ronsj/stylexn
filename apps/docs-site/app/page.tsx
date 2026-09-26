import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    fontFamily: "system-ui, sans-serif",
  },
  title: {
    fontSize: 48,
    fontWeight: 700,
    color: "rebeccapurple",
  },
  tagline: {
    fontSize: 20,
    color: "#555",
  },
});

export default function Page() {
  return (
    <main {...stylex.props(styles.main)}>
      <h1 {...stylex.props(styles.title)}>StyleXN</h1>
      <p {...stylex.props(styles.tagline)}>StyleX for React Native and the web.</p>
    </main>
  );
}
