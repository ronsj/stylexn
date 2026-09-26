// @vitest-environment jsdom
// `pnpm --filter stylexn bench`: how much `useProps` costs on a long list.
// Skipped unless STYLEXN_BENCH is set, so `pnpm test` stays fast; prints
// medians in milliseconds. Numbers are jsdom on the test doubles, so they
// measure the runtime's own overhead, not React Native rendering.
//
// Three layers, each on 1000 rows of a View with a Text inside:
// - "floor": the React Native test doubles rendered directly with a static
//   style object, i.e. the cost of React and the host elements alone;
// - "elements": the same rows through stylexn/elements (useProps per element);
// - "resolve": the pure resolve() step by itself, without React.
// Rules come in three kinds: static (nothing depends on the environment),
// with a `:active` condition (interaction state), and with `rem`/`em` units
// (environment-dependent values).
import { render, type RenderResult } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeAll, describe, test, vi } from "vitest";

vi.mock("react-native", () => import("../testing/react-native.ts"));

import { Text as RNText, View as RNView } from "react-native";
import { create } from "./api.ts";
import { Text, View } from "../elements/native.ts";
import { snapshotEnv } from "./env.ts";
import { resolve } from "./resolve.ts";
import type { StyleArg } from "./types.ts";

const ROWS = 1000;

const styles = create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 8,
    borderRadius: 8,
    backgroundColor: "white",
  },
  title: { fontSize: 16, color: "#333", fontWeight: "600" },
  pressable: {
    opacity: { default: 1, ":active": 0.6 },
    backgroundColor: { default: "white", ":hover": "#eee" },
  },
  relative: { paddingTop: "0.5rem", marginBottom: "1em", width: "50vw" },
});

const floorRow = { flexDirection: "row", padding: 12 } as const;
const floorTitle = { fontSize: 16, color: "#333" } as const;

type Rows = (i: number) => ReactNode;

function List({ rows }: { rows: Rows; tick: number }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < ROWS; i++) out.push(rows(i));
  return createElement("div", null, out);
}

const floorRows: Rows = (i) =>
  createElement(
    RNView,
    { key: i, style: floorRow },
    createElement(RNText, { style: floorTitle }, i),
  );
const elementRows =
  (rowSx: StyleArg, titleSx: StyleArg): Rows =>
  (i) =>
    createElement(View, { key: i, sx: rowSx }, createElement(Text, { sx: titleSx }, i));

const mount = (rows: Rows): RenderResult => render(createElement(List, { rows, tick: 0 }));

/** Re-render the whole list from the top, as a parent state change would. */
let tick = 0;
const update = (root: RenderResult, rows: Rows) =>
  root.rerender(createElement(List, { rows, tick: ++tick }));

/** Median wall time of `fn` over `runs`, after one warm-up. */
function median(fn: () => void, runs = 15): number {
  for (let i = 0; i < 3; i++) fn(); // warm the JIT
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- a local copy
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)] as number;
}

const report: Record<string, Record<string, string>> = {};
const record = (section: string, name: string, ms: number) => {
  (report[section] ??= {})[name] = `${ms.toFixed(1)} ms`;
};

describe.skipIf(!process.env.STYLEXN_BENCH)("useProps benchmark", () => {
  beforeAll(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    return () => {
      vi.restoreAllMocks();
      const lines: string[] = [];
      for (const [section, rows] of Object.entries(report)) {
        lines.push(`\n${section} (${ROWS} rows, median of runs)`);
        for (const [name, ms] of Object.entries(rows)) lines.push(`  ${name.padEnd(40)} ${ms}`);
      }
      process.stdout.write(`${lines.join("\n")}\n\n`);
    };
  });

  const rowCases: [string, Rows][] = [
    ["floor: host elements, static style", floorRows],
    ["elements: static rules", elementRows(styles.row, styles.title)],
    ["elements: :active rule", elementRows([styles.row, styles.pressable], styles.title)],
    ["elements: rem/em/vw rule", elementRows([styles.row, styles.relative], styles.title)],
  ];

  test(`mount ${ROWS} rows`, () => {
    for (const [name, rows] of rowCases) {
      record(
        "mount",
        name,
        median(() => mount(rows).unmount()),
      );
    }
  });

  test(`re-render ${ROWS} rows`, () => {
    for (const [name, rows] of rowCases) {
      const root = mount(rows);
      record(
        "re-render",
        name,
        median(() => update(root, rows)),
      );
      root.unmount();
    }
  });

  test(`resolve() ${ROWS} times`, () => {
    const env = snapshotEnv();
    const cases: [string, readonly StyleArg[]][] = [
      ["static rule", [styles.row]],
      ["two static rules", [styles.row, styles.title]],
      [":active rule", [styles.row, styles.pressable]],
      ["rem/em/vw rule", [styles.row, styles.relative]],
    ];
    for (const [name, args] of cases) {
      record(
        "resolve",
        name,
        median(() => {
          for (let i = 0; i < ROWS; i++) resolve(args, env);
        }, 30),
      );
    }
  });
});
