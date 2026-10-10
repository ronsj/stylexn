import * as stylex from "stylexn";
import { web } from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";
import { FILTERS, type Filter } from "./store";
import { colors, radii, space } from "./tokens.stylex";

const LABELS: Readonly<Record<Filter, string>> = { all: "All", active: "Active", done: "Done" };

const styles = stylex.create({
  bar: {
    flexDirection: "row",
    gap: space.xs,
    padding: space.xs,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: colors.background,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: "0.375rem",
    paddingBlock: "0.375rem",
    paddingInline: "0.875rem",
    borderRadius: radii.pill,
    fontSize: 14,
    fontWeight: 600,
    color: colors.muted,
    backgroundColor: {
      default: "transparent",
      ":hover": colors.accentSoft,
      ":active": colors.border,
    },
    transitionProperty: "background-color",
    transitionDuration: "150ms",
    outlineStyle: "solid",
    outlineColor: colors.focusRing,
    outlineWidth: { default: 0, ":focus-visible": 2 },
    ...web({ cursor: "pointer", userSelect: "none" }),
  },
  selected: {
    color: colors.onAccent,
    backgroundColor: { default: colors.accent, ":hover": colors.accentHover },
  },
  count: {
    // em: relative to this text's own font size.
    minWidth: "1.6em",
    paddingInline: "0.4em",
    borderRadius: "0.8em",
    fontSize: 12,
    textAlign: "center",
    // Tabular digits keep the badges from jiggling as counts change.
    fontFeatureSettings: '"tnum"',
    backgroundColor: colors.border,
    color: colors.text,
  },
  countSelected: {
    backgroundColor: colors.onAccent,
    color: colors.accent,
  },
});

export function Filters({
  filter,
  counts,
  onChange,
}: Readonly<{
  filter: Filter;
  counts: Readonly<Record<Filter, number>>;
  onChange: (filter: Filter) => void;
}>) {
  return (
    <View sx={styles.bar} role="tablist" aria-label="Filter todos">
      {FILTERS.map((f) => (
        <Pressable
          key={f}
          sx={[styles.chip, f === filter && styles.selected]}
          role="tab"
          aria-selected={f === filter}
          onPress={() => onChange(f)}
          testID={`filter-${f}`}
        >
          <Text>{LABELS[f]}</Text>
          <Text sx={[styles.count, f === filter && styles.countSelected]}>{String(counts[f])}</Text>
        </Pressable>
      ))}
    </View>
  );
}
