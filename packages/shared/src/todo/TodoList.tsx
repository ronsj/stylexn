import * as stylex from "stylexn";
import { web } from "stylexn";
import { Text, View } from "stylexn/elements";
import type { Filter, Todo } from "./store";
import { TodoItem } from "./TodoItem";
import { colors } from "./tokens.stylex";

export type Direction = "forward" | "back";

const EMPTY: Readonly<Record<Filter, string>> = {
  all: "Nothing to do yet. Add a todo above.",
  active: "Nothing left to do.",
  done: "Nothing done yet.",
};

// keyframes: CSS @keyframes on the web, an Animated timeline on native. The
// list remounts per page, so the page slides in from the side it came from.
const fromRight = stylex.keyframes({
  from: { opacity: 0, transform: "translateX(24px)" },
  to: { opacity: 1, transform: "translateX(0px)" },
});

const fromLeft = stylex.keyframes({
  from: { opacity: 0, transform: "translateX(-24px)" },
  to: { opacity: 1, transform: "translateX(0px)" },
});

const styles = stylex.create({
  page: {
    // Five rows (3.5rem + 8px each), so the pager does not jump on a short page.
    minHeight: "20rem",
    animationDuration: "280ms",
    animationTimingFunction: "ease-out",
    ...web({ willChange: "opacity, transform" }),
  },
  forward: { animationName: fromRight },
  back: { animationName: fromLeft },
  empty: {
    paddingBlock: "2rem",
    textAlign: "center",
    fontSize: 15,
    color: colors.muted,
  },
});

export function TodoList({
  items,
  filter,
  direction,
  removing,
  added,
  onToggle,
  onEdit,
  onRemove,
}: Readonly<{
  items: readonly Todo[];
  filter: Filter;
  direction: Direction;
  removing: ReadonlySet<string>;
  added: string | null;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}>) {
  return (
    <View
      sx={[styles.page, direction === "forward" ? styles.forward : styles.back]}
      role="list"
      aria-label="Todos"
      testID="todo-list"
    >
      {items.length === 0 ? (
        <Text sx={styles.empty} testID="todo-empty">
          {EMPTY[filter]}
        </Text>
      ) : (
        items.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            entering={todo.id === added}
            removing={removing.has(todo.id)}
            onToggle={onToggle}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))
      )}
    </View>
  );
}
