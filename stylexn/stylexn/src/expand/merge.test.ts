import { describe, expect, test } from "vitest";
import { expandDeclarations } from "./expand.ts";
import { mergeExpanded } from "./merge.ts";

const e = (decls: Parameters<typeof expandDeclarations>[0]) => expandDeclarations(decls);

describe("property-specificity (default)", () => {
  test("a longhand beats a shorthand applied later", () => {
    const { style } = mergeExpanded([e({ marginTop: 5 }), e({ margin: 10 })]);
    expect(style).toEqual({ marginTop: 5, marginRight: 10, marginBottom: 10, marginLeft: 10 });
  });

  test("a longhand beats a shorthand applied earlier", () => {
    const { style } = mergeExpanded([e({ margin: 10 }), e({ marginTop: 5 })]);
    expect(style.marginTop).toBe(5);
  });

  test("same depth: last applied wins", () => {
    expect(mergeExpanded([e({ margin: 10 }), e({ margin: 20 })]).style.marginTop).toBe(20);
    expect(mergeExpanded([e({ marginTop: 1 }), e({ marginTop: 2 })]).style.marginTop).toBe(2);
  });

  test("deeper shorthands lose to shallower ones", () => {
    // border (depth 2) < borderWidth (depth 1) < borderTopWidth (depth 0)
    const { style } = mergeExpanded([e({ borderWidth: 3 }), e({ border: "1px solid red" })]);
    expect(style.borderTopWidth).toBe(3);
    expect(style.borderTopStyle).toBe("solid");
    const reversed = mergeExpanded([e({ border: "1px solid red" }), e({ borderWidth: 3 })]);
    expect(reversed.style.borderTopWidth).toBe(3);
  });

  test("the winner's depth is recorded for later merges", () => {
    const first = mergeExpanded([e({ margin: 10 })]);
    expect(first.depth.marginTop).toBe(1);
    const { style } = mergeExpanded([first, e({ marginTop: 1 })]);
    expect(style.marginTop).toBe(1);
  });

  test("falsy rules are skipped, like stylex.props(cond && styles.x)", () => {
    const { style } = mergeExpanded([e({ color: "red" }), false, null, undefined]);
    expect(style).toEqual({ color: "red" });
  });
});

describe("application-order", () => {
  test("last applied wins regardless of specificity", () => {
    const { style } = mergeExpanded([e({ marginTop: 5 }), e({ margin: 10 })], "application-order");
    expect(style.marginTop).toBe(10);
  });
});

describe("null", () => {
  test("a winning null removes the property", () => {
    const { style, depth } = mergeExpanded([e({ color: "red" }), e({ color: null })]);
    expect(style).toEqual({});
    expect(depth).toEqual({});
  });

  test("null from a shorthand does not remove a more specific longhand", () => {
    const { style } = mergeExpanded([e({ paddingTop: 4 }), e({ padding: null })]);
    expect(style).toEqual({ paddingTop: 4 });
  });
});

describe("conditional values", () => {
  test("are replaced whole, not merged per condition", () => {
    const { style } = mergeExpanded([
      e({ color: { default: "red", ":hover": "blue" } }),
      e({ color: { default: "green" } }),
    ]);
    expect(style.color).toEqual({ default: "green" });
  });
});
