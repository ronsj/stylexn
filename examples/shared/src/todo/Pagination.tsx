import * as stylex from "stylexn";
import { web } from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";
import { colors, radii, space } from "./tokens.stylex";

const styles = stylex.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  button: {
    paddingBlock: space.sm,
    paddingInline: space.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: "solid",
    fontSize: 14,
    fontWeight: 600,
    // :disabled at the first and last page, from the `disabled` prop.
    borderColor: { default: colors.accent, ":disabled": colors.border },
    color: { default: colors.accent, ":disabled": colors.muted },
    backgroundColor: {
      default: "transparent",
      ":hover": colors.accentSoft,
      ":active": colors.border,
      ":disabled": "transparent",
    },
    opacity: { default: 1, ":disabled": 0.6 },
    transitionProperty: "background-color, opacity",
    transitionDuration: "150ms",
    outlineStyle: "solid",
    outlineColor: colors.focusRing,
    outlineOffset: 2,
    outlineWidth: { default: 0, ":focus-visible": 3 },
    ...web({ cursor: { default: "pointer", ":disabled": "not-allowed" }, userSelect: "none" }),
  },
  label: {
    fontSize: 14,
    color: colors.muted,
    // fontFeatureSettings "tnum" becomes fontVariant: ["tabular-nums"] on native.
    fontFeatureSettings: '"tnum"',
    ...web({ userSelect: "none" }),
  },
});

export function Pagination({
  page,
  pageCount,
  onChange,
}: Readonly<{ page: number; pageCount: number; onChange: (page: number) => void }>) {
  return (
    <View sx={styles.bar} role="navigation" aria-label="Pages">
      <Pressable
        sx={styles.button}
        onPress={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        testID="page-prev"
      >
        <Text>‹ Prev</Text>
      </Pressable>
      <Text sx={styles.label} aria-live="polite" testID="page-label">
        {`Page ${page} of ${pageCount}`}
      </Text>
      <Pressable
        sx={styles.button}
        onPress={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        testID="page-next"
      >
        <Text>Next ›</Text>
      </Pressable>
    </View>
  );
}
