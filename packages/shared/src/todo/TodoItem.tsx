import { useState } from "react";
import * as stylex from "stylexn";
import { native, web } from "stylexn";
import { Pressable, Switch, Text, TextInput, View } from "stylexn/elements";
import type { Todo } from "./store";
import { rowMarker } from "./rowMarker.stylex";
import { colors, radii, space } from "./tokens.stylex";

// A new todo fades and slides down into place. The transform functions match
// the row's own (translateX then translateY) so Animated can interpolate them.
const enter = stylex.keyframes({
  from: { opacity: 0, transform: "translateX(0px) translateY(-12px)" },
  to: { opacity: 1, transform: "translateX(0px) translateY(0px)" },
});

const styles = stylex.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    // A fixed height, so deleting can transition it to 0.
    height: "3.5rem",
    marginBottom: 8,
    paddingInline: space.md,
    overflow: "hidden",
    borderRadius: radii.md,
    backgroundColor: { default: colors.background, ":hover": colors.accentSoft },
    opacity: 1,
    transform: "translateX(0px) translateY(0px)",
    // transition*: the delete animation (opacity, transform, then the height
    // and margin collapse) and the hover colour. 250ms is REMOVE_MS in TodoApp.
    transitionProperty: "opacity, transform, height, margin-bottom, background-color",
    transitionDuration: "250ms",
    transitionTimingFunction: "ease-in-out",
    ...web({ willChange: "opacity, transform" }),
    // native(): Android's elevation shadow; React Native-only key.
    ...native({ elevation: 1 }),
  },
  // keyframes + animation*: only the todo that was just added animates in.
  entering: {
    animationName: enter,
    animationDuration: "300ms",
    animationTimingFunction: "ease-out",
  },
  removing: {
    opacity: 0,
    transform: "translateX(32px) translateY(0px)",
    height: 0,
    marginBottom: 0,
  },
  // :checked from the Switch's value: a done todo's switch steps back.
  toggle: {
    opacity: { default: 1, ":checked": 0.65 },
    // Listed with background-color so the web switch's track still fades.
    transitionProperty: "opacity, background-color",
    transitionDuration: "200ms",
  },
  title: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 1.25,
    color: colors.text,
    // lineClamp + textOverflow become numberOfLines and ellipsizeMode on native.
    lineClamp: 2,
    textOverflow: "ellipsis",
    // Browsers still clamp through the -webkit- box model.
    ...web({
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: 2,
      overflow: "hidden",
      overflowWrap: "anywhere",
    }),
    transitionProperty: "color",
    transitionDuration: "200ms",
  },
  titleDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  editInput: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingBlock: space.xs,
    paddingInline: space.sm,
    fontSize: 16,
    color: { default: colors.text, "::placeholder": colors.muted },
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderStyle: "solid",
    // :placeholder-shown: an empty edit cancels, so the border warns.
    borderColor: { default: colors.accent, ":placeholder-shown": colors.danger },
  },
  action: {
    paddingBlock: space.xs,
    paddingInline: space.sm,
    borderRadius: radii.sm,
    backgroundColor: {
      default: "transparent",
      // when.ancestor + defineMarker: follows the row's state, not the button's.
      [stylex.when.ancestor(":hover", rowMarker)]: colors.surface,
      ":hover": colors.accentSoft,
      ":active": colors.border,
    },
    opacity: {
      default: 0.7,
      [stylex.when.ancestor(":hover", rowMarker)]: 1,
      [stylex.when.ancestor(":active", rowMarker)]: 1,
    },
    transitionProperty: "background-color, opacity",
    transitionDuration: "150ms",
    outlineStyle: "solid",
    outlineColor: colors.focusRing,
    outlineWidth: { default: 0, ":focus-visible": 2 },
    ...web({ cursor: "pointer", userSelect: "none" }),
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: {
      default: colors.muted,
      [stylex.when.ancestor(":hover", rowMarker)]: colors.accent,
      [stylex.when.ancestor(":active", rowMarker)]: colors.accentPressed,
    },
    transitionProperty: "color",
    transitionDuration: "150ms",
  },
  deleteLabel: {
    color: {
      default: colors.muted,
      [stylex.when.ancestor(":hover", rowMarker)]: colors.danger,
      [stylex.when.ancestor(":active", rowMarker)]: colors.danger,
    },
  },
});

export function TodoItem({
  todo,
  entering,
  removing,
  onToggle,
  onEdit,
  onRemove,
}: Readonly<{
  todo: Todo;
  entering: boolean;
  removing: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onRemove: (id: string) => void;
}>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const start = () => {
    setDraft(todo.title);
    setEditing(true);
  };
  // Return or blur saves; empty text cancels.
  const commit = () => {
    if (draft.trim() && draft.trim() !== todo.title) onEdit(todo.id, draft);
    setEditing(false);
  };
  return (
    <View
      sx={[rowMarker, styles.row, entering && styles.entering, removing && styles.removing]}
      role="listitem"
      testID="todo-item"
    >
      <Switch
        sx={styles.toggle}
        value={todo.done}
        onValueChange={() => onToggle(todo.id)}
        disabled={removing}
        aria-label={`Done: ${todo.title}`}
        testID="todo-toggle"
      />
      {editing ? (
        <TextInput
          sx={styles.editInput}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          autoFocus
          placeholder="Empty cancels"
          aria-label={`Edit title: ${todo.title}`}
          returnKeyType="done"
          maxLength={120}
          testID="todo-edit-input"
        />
      ) : (
        <Text sx={[styles.title, todo.done && styles.titleDone]} testID="todo-title">
          {todo.title}
        </Text>
      )}
      {editing ? null : (
        <Pressable
          sx={styles.action}
          onPress={start}
          disabled={removing}
          aria-label={`Edit: ${todo.title}`}
          testID="todo-edit"
        >
          <Text sx={styles.actionLabel}>Edit</Text>
        </Pressable>
      )}
      <Pressable
        sx={styles.action}
        onPress={() => onRemove(todo.id)}
        disabled={removing}
        aria-label={`Delete: ${todo.title}`}
        testID="todo-delete"
      >
        <Text sx={[styles.actionLabel, styles.deleteLabel]}>Delete</Text>
      </Pressable>
    </View>
  );
}
