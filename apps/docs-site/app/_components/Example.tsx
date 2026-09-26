import * as stylex from "stylexn";
import type { ReactNode } from "react";
import { Text, View } from "stylexn/elements";
import { examplePath, readRepoFile } from "../_lib/repo";
import { colors, radii, space } from "./tokens.stylex";
import { CodeBlock } from "./ui";

const SIDE_BY_SIDE = "@media (min-width: 1280px)";

const styles = stylex.create({
  example: {
    flexDirection: { default: "column", [SIDE_BY_SIDE]: "row" },
    alignItems: { default: "stretch", [SIDE_BY_SIDE]: "flex-start" },
    gap: space.lg,
  },
  result: {
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: { default: "auto", [SIDE_BY_SIDE]: 0 },
    minWidth: 0,
    width: { default: "100%", [SIDE_BY_SIDE]: "auto" },
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  label: {
    paddingBlock: space.xs,
    paddingInline: space.md,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    padding: space.xl,
  },
  source: {
    flexGrow: 3,
    flexShrink: 1,
    flexBasis: { default: "auto", [SIDE_BY_SIDE]: 0 },
    minWidth: 0,
    width: { default: "100%", [SIDE_BY_SIDE]: "auto" },
  },
});

/**
 * A live example next to the file that produced it. `name` is the example's
 * file in packages/shared/src/examples; the source is read at build time,
 * so what is shown is what renders.
 */
export function Example({ name, children }: { name: string; children: ReactNode }) {
  const path = examplePath(name);
  return (
    <View sx={styles.example}>
      <View sx={styles.result}>
        <Text sx={styles.label}>Result</Text>
        <View sx={styles.stage} testID={`example-${name}`}>
          {children}
        </View>
      </View>
      <View sx={styles.source}>
        <CodeBlock code={readRepoFile(path)} caption={path} />
      </View>
    </View>
  );
}
