import * as stylex from "@stylexjs/stylex";
import type { PropRow } from "../_lib/props";
import { colors, space } from "./tokens.stylex";
import { Code, Table } from "./ui";

const styles = stylex.create({
  name: {
    whiteSpace: "nowrap",
  },
  required: {
    marginLeft: space.xs,
    fontSize: 12,
    color: colors.muted,
  },
});

/** A props (or methods) table from rows read out of the elements' source. */
export function PropsTable({ rows, label = "Prop" }: { rows: readonly PropRow[]; label?: string }) {
  return (
    <Table
      head={[label, "Type", "Description"]}
      rows={rows.map((row) => [
        <span key="n" {...stylex.props(styles.name)}>
          <Code>{row.name}</Code>
          {row.required && label === "Prop" ? (
            <span {...stylex.props(styles.required)}>required</span>
          ) : null}
        </span>,
        <Code key="t">{row.type}</Code>,
        row.doc,
      ])}
    />
  );
}
