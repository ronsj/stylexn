import { useState } from "react";
import * as stylex from "stylexn";
import { web } from "stylexn";
import { Pressable, Text, TextInput, View } from "stylexn/elements";
import { colors, radii, space } from "./tokens.stylex";

const styles = stylex.create({
  row: {
    flexDirection: "row",
    gap: space.sm,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingBlock: "0.625rem",
    paddingInline: "0.875rem",
    fontSize: 16,
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: "solid",
    // :placeholder-shown: a quiet border while the field is empty, the
    // accent once something is typed (from the input's own value on native).
    // Nested conditions: hover and focus refine the empty state.
    borderColor: {
      default: colors.accent,
      ":placeholder-shown": {
        default: colors.border,
        ":hover": colors.muted,
        ":focus": colors.accentHover,
      },
    },
    backgroundColor: colors.surface,
    // ::placeholder becomes placeholderTextColor on native.
    color: { default: colors.text, "::placeholder": colors.muted },
    // caretColor becomes cursorColor on native.
    caretColor: colors.accent,
    transitionProperty: "border-color",
    transitionDuration: "150ms",
  },
  add: {
    justifyContent: "center",
    paddingInline: "1.25rem",
    borderRadius: radii.md,
    // :hover, :active and :disabled on a Pressable (disabled from the prop).
    backgroundColor: {
      default: colors.accent,
      ":hover": colors.accentHover,
      ":active": colors.accentPressed,
      ":disabled": colors.border,
    },
    // Text styles set on the Pressable cascade to the Text inside it.
    color: { default: colors.onAccent, ":disabled": colors.muted },
    fontSize: 16,
    fontWeight: 700,
    transform: { default: "scale(1)", ":active": "scale(0.96)" },
    // Transitions run on the web's CSS engine and on Animated on native.
    transitionProperty: "background-color, transform",
    transitionDuration: "150ms",
    // :focus-visible: a ring for keyboard users (treated as :focus on native).
    outlineStyle: "solid",
    outlineColor: colors.focusRing,
    outlineOffset: 2,
    outlineWidth: { default: 0, ":focus-visible": 3 },
    // web(): browser-only declarations, stripped before the native compile.
    ...web({ cursor: { default: "pointer", ":disabled": "not-allowed" }, userSelect: "none" }),
  },
});

export function TodoInput({ onAdd }: Readonly<{ onAdd: (title: string) => void }>) {
  const [text, setText] = useState("");
  const empty = !text.trim();
  const submit = () => {
    if (empty) return;
    onAdd(text);
    setText("");
  };
  return (
    <View sx={styles.row}>
      <TextInput
        sx={styles.input}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder="What needs doing?"
        aria-label="New todo"
        returnKeyType="done"
        maxLength={120}
        testID="todo-input"
      />
      <Pressable
        sx={styles.add}
        onPress={submit}
        disabled={empty}
        aria-label="Add todo"
        testID="todo-add"
      >
        <Text>Add</Text>
      </Pressable>
    </View>
  );
}
