import { expect, test } from "vitest";
import { highlight } from "./highlight";

const kinds = (code: string, lang = "tsx") =>
  highlight(code, lang)
    .filter((t) => t.kind !== "plain")
    .map((t) => `${t.kind}:${t.text}`);

test("marks keywords, strings, numbers, comments and JSX tags", () => {
  expect(kinds('import * as stylex from "stylexn"; // web')).toEqual([
    "keyword:import",
    "keyword:as",
    "keyword:from",
    'string:"stylexn"',
    "comment:// web",
  ]);
  expect(kinds("const x = <View sx={s.a}>{n + 1}</View>;")).toEqual([
    "keyword:const",
    "tag:<View",
    "number:1",
    "tag:</View",
  ]);
});

test("type arguments and comparisons are not JSX", () => {
  expect(kinds("useState<string>(a < b)")).toEqual([]);
});

test("identifiers with digits and units stay plain", () => {
  expect(kinds('{ x1a: "1px", h: 100vh }')).toEqual(['string:"1px"']);
});

test("hash comments in YAML and shell", () => {
  expect(kinds('# flow\nappId: "x"', "yaml")).toEqual(["comment:# flow", 'string:"x"']);
});

test("the tokens reassemble to the input", () => {
  const code = "const a = `t ${b}`; /* c */ <X y='1' />";
  expect(
    highlight(code, "tsx")
      .map((t) => t.text)
      .join(""),
  ).toBe(code);
});

test("tool output stays plain", () => {
  expect(kinds('a.tsx:1:1 error: "x"', "text")).toEqual([]);
});
