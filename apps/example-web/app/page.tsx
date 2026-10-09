import * as stylex from "@stylexjs/stylex";
import { TodoApp } from "@stylexn/shared";

// A Server Component: it renders the shared client TodoApp, which hydrates
// in the browser and loads the saved todos from localStorage.

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
      <TodoApp />
    </main>
  );
}
