import vm from "node:vm";
import { transformFromAstSync, transformSync, traverse, types as t } from "@babel/core";
import { describe, expect, test } from "vitest";
import plugin, { type StyleXNPluginOptions } from "./plugin.ts";

function transform(code: string, options: StyleXNPluginOptions = {}, filename = "test.tsx") {
  const result = transformSync(code, {
    filename,
    babelrc: false,
    configFile: false,
    ast: true,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [[plugin, options]],
  });
  if (!result?.code || !result.ast) throw new Error("no output");
  return { code: result.code, ast: result.ast };
}

/** Evaluate the first argument of the first create() call in the output. */
function compiled(
  code: string,
  options: StyleXNPluginOptions = {},
  scope: Record<string, unknown> = {},
) {
  const { ast } = transform(code, options);
  let arg: t.Expression | undefined;
  traverse(ast, {
    CallExpression(path) {
      if (arg) return;
      const callee = path.node.callee;
      const isCreate =
        (t.isMemberExpression(callee) && t.isIdentifier(callee.property, { name: "create" })) ||
        t.isIdentifier(callee, { name: "create" });
      if (isCreate) arg = path.node.arguments[0] as t.Expression;
    },
  });
  if (!arg) throw new Error("no create() call in output");
  const program = t.file(t.program([t.expressionStatement(arg)]));
  const generated = transformFromAstSync(program, "", { babelrc: false, configFile: false })?.code;
  return vm.runInNewContext(`(${generated?.replace(/;\s*$/, "")})`, scope);
}

const HEADER = `import * as stylex from "@stylexjs/stylex";\n`;

describe("stylex.create compilation", () => {
  test("static rule", () => {
    const styles = compiled(`${HEADER}const styles = stylex.create({
      root: { padding: "8px 16px", color: "red", lineHeight: 1.5 },
    });`);
    expect(styles.root).toEqual({
      $$stylexn: 1,
      static: {
        paddingTop: 8,
        paddingRight: 16,
        paddingBottom: 8,
        paddingLeft: 16,
        color: "red",
        lineHeight: "1.5em",
      },
      conditional: [],
      props: {},
      conditionalProps: [],
      depth: { paddingTop: 1, paddingRight: 1, paddingBottom: 1, paddingLeft: 1 },
      usesVars: false,
    });
  });

  test("conditions, negative numbers, template strings, const keys", () => {
    const styles = compiled(`${HEADER}
      const dark = "@media (prefers-color-scheme: dark)";
      const styles = stylex.create({
        text: {
          marginTop: -4,
          color: { default: \`black\`, ":hover": "gray", [dark]: { default: "white", ":hover": "silver" } },
        },
      });`);
    expect(styles.text.static).toEqual({ marginTop: -4, color: "black" });
    expect(styles.text.conditional).toEqual([
      { key: "color", when: [":hover"], value: "gray" },
      { key: "color", when: ["@media (prefers-color-scheme: dark)"], value: "white" },
      { key: "color", when: ["@media (prefers-color-scheme: dark)", ":hover"], value: "silver" },
    ]);
  });

  test("computed keys resolve through any never-reassigned binding", () => {
    // Other plugins in the same traversal may have rewritten `const` to `var`.
    const styles = compiled(`${HEADER}
      var dark = "@media (prefers-color-scheme: dark)";
      const styles = stylex.create({ a: { color: { default: "black", [dark]: "white" } } });`);
    expect(styles.a.conditional).toEqual([
      { key: "color", when: ["@media (prefers-color-scheme: dark)"], value: "white" },
    ]);
    expect(() =>
      transform(
        `${HEADER}let k = "x"; k = "y"; stylex.create({ a: { color: { [k]: "white" } } });`,
      ),
    ).toThrow(/const strings/);
  });

  test("variable references are kept as expressions and flag usesVars", () => {
    const vars = { accent: { __var: "accent" }, space: { __var: "space" } };
    const styles = compiled(
      `${HEADER}const styles = stylex.create({ box: { color: vars.accent, margin: vars.space } });`,
      {},
      { vars },
    );
    expect(styles.box.static).toEqual({
      color: vars.accent,
      marginTop: vars.space,
      marginRight: vars.space,
      marginBottom: vars.space,
      marginLeft: vars.space,
    });
    expect(styles.box.usesVars).toBe(true);
  });

  test("dynamic rules keep their parameters", () => {
    const styles = compiled(
      `${HEADER}const styles = stylex.create({ fade: (opacity, pad) => ({ opacity, paddingTop: pad }) });`,
    );
    expect(styles.fade(0.5, 8)).toEqual({
      $$stylexn: 1,
      static: { opacity: 0.5, paddingTop: 8 },
      conditional: [],
      props: {},
      conditionalProps: [],
      depth: {},
      usesVars: true,
    });
  });

  test("style-derived props", () => {
    const styles = compiled(
      `${HEADER}const styles = stylex.create({ input: { color: { default: "black", "::placeholder": "gray" }, lineClamp: 2 } });`,
    );
    expect(styles.input.props).toEqual({ placeholderTextColor: "gray", numberOfLines: 2 });
  });

  test("named import and other import sources", () => {
    const a = compiled(
      `import { create } from "stylexn";\nconst s = create({ a: { color: "red" } });`,
    );
    expect(a.a.static).toEqual({ color: "red" });
    const b = compiled(
      `import * as sx from "@acme/styles";\nconst s = sx.create({ a: { color: "red" } });`,
      {
        importSources: ["@acme/styles"],
      },
    );
    expect(b.a.static).toEqual({ color: "red" });
  });

  test("untouched: other modules, platform web", () => {
    const code = `import * as stylex from "other";\nconst s = stylex.create({ a: { float: "left" } });`;
    expect(transform(code).code).toContain(`float: "left"`);
    const web = `${HEADER}const s = stylex.create({ a: { float: "left" } });`;
    expect(transform(web, { platform: "web" }).code).toContain(`float: "left"`);
  });
});

describe("policy", () => {
  const bad = `${HEADER}const styles = stylex.create({ a: { float: "left", color: "red" } });`;

  test("non-strict strips unsupported styles and warns", () => {
    const warnings: string[] = [];
    const styles = compiled(bad, { strict: false, onWarning: (m) => warnings.push(m) });
    expect(styles.a.static).toEqual({ color: "red" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/rule "a"/);
    expect(warnings[0]).toMatch(/float/);
  });

  test("web-only styles are stripped without a warning", () => {
    const warnings: string[] = [];
    const styles = compiled(
      `${HEADER}const s = stylex.create({ a: { willChange: "x", color: "red" } });`,
      {
        strict: false,
        onWarning: (m) => warnings.push(m),
      },
    );
    expect(styles.a.static).toEqual({ color: "red" });
    expect(warnings).toEqual([]);
  });

  test("strict fails the build with a code frame", () => {
    expect(() => transform(bad, { strict: true })).toThrow(
      /unsupported styles in .*test\.tsx rule "a"[\s\S]*float/,
    );
  });

  test("malformed shorthands are reported", () => {
    const warnings: string[] = [];
    compiled(`${HEADER}const s = stylex.create({ a: { margin: "1px 2px 3px 4px 5px" } });`, {
      strict: false,
      onWarning: (m) => warnings.push(m),
    });
    expect(warnings[0]).toMatch(/expected 1 to 4 values/);
  });

  test("rnVersion gating", () => {
    expect(() =>
      transform(`${HEADER}const s = stylex.create({ a: { boxShadow: "0 1px 2px red" } });`, {
        strict: true,
        rnVersion: "0.75",
      }),
    ).toThrow(/needs React Native 0\.76/);
  });

  test("non-literal shapes are build errors", () => {
    expect(() => transform(`${HEADER}const o = {}; const s = stylex.create(o);`)).toThrow(
      /object literal/,
    );
    expect(() => transform(`${HEADER}const s = stylex.create({ ...other });`)).toThrow(
      /plain properties/,
    );
    expect(() => transform(`${HEADER}const s = stylex.create({ a: someRule });`)).toThrow(
      /object literal/,
    );
  });
});

describe("escape hatches", () => {
  const src = `import * as stylex from "stylexn";
import { web, native } from "stylexn";
const styles = stylex.create({
  card: {
    display: "flex",
    color: "red",
    ...stylex.web({ display: "grid", float: "left" }),
    ...native({ elevation: 2, marginBlock: "4px" }),
  },
});`;

  test("native: web blocks are dropped, native blocks are inlined and trusted", () => {
    const warnings: string[] = [];
    const styles = compiled(src, { strict: true, onWarning: (m) => warnings.push(m) });
    expect(styles.card.static).toEqual({
      display: "flex",
      color: "red",
      elevation: 2,
      marginBlockStart: 4,
      marginBlockEnd: 4,
    });
    expect(warnings).toEqual([]);
  });

  test("native blocks still reject unsupported properties", () => {
    expect(() =>
      transform(`${HEADER}stylex.create({ a: { ...stylex.native({ float: "left" }) } });`, {
        strict: true,
      }),
    ).toThrow(/float/);
  });

  test("web: web blocks are inlined and native blocks removed, before StyleX", () => {
    const { code } = transform(src, { platform: "web" });
    expect(code).toMatch(/display: "grid"/);
    expect(code).toMatch(/float: "left"/);
    expect(code).not.toMatch(/elevation/);
    expect(code).not.toMatch(/\.\.\./);
  });

  test("other spreads are errors on both platforms", () => {
    const bad = `${HEADER}const extra = {}; stylex.create({ a: { ...extra } });`;
    expect(() => transform(bad)).toThrow(/web\(\{ \}\) \/ \.\.\.native/);
    expect(() => transform(bad, { platform: "web" })).toThrow(/web\(\{ \}\) \/ \.\.\.native/);
    expect(() =>
      transform(`${HEADER}const o = {}; stylex.create({ a: { ...stylex.web(o) } });`),
    ).toThrow(/object literal/);
  });
});

/** Injected defineVars ids in plugin output, in order. */
const ids = (code: string) =>
  [...code.matchAll(/defineVars\([^)]*\}, "(v[a-z0-9]+)"\)/g)].map((m) => m[1]);

describe("defineVars ids", () => {
  const TOKENS = `${HEADER}
    export const colors = stylex.defineVars({ accent: "red" });
    export const space = stylex.defineVars({ gutter: 8 });
    export default stylex.defineVars({ anon: 1 });`;

  test("native: a stable id per file and export is injected", () => {
    const a = ids(
      transform(TOKENS, { rootDir: "/repo" }, "/repo/packages/shared/tokens.stylex.ts").code,
    );
    const b = ids(
      transform(TOKENS, { rootDir: "/repo" }, "/repo/packages/shared/tokens.stylex.ts").code,
    );
    expect(a).toHaveLength(3);
    expect(a).toEqual(b); // deterministic across rebuilds (and Fast Refresh)
    expect(new Set(a).size).toBe(3); // distinct per export
    // Independent of the checkout location.
    const elsewhere = ids(
      transform(
        TOKENS,
        { rootDir: "/other/place" },
        "/other/place/packages/shared/tokens.stylex.ts",
      ).code,
    );
    expect(elsewhere).toEqual(a);
    // Another file gets other ids.
    const other = ids(
      transform(TOKENS, { rootDir: "/repo" }, "/repo/packages/shared/other.stylex.ts").code,
    );
    expect(other).not.toEqual(a);
  });

  test("an explicit id and the web platform are left alone", () => {
    const explicit = `${HEADER}export const v = stylex.defineVars({ a: 1 }, "custom");`;
    expect(transform(explicit).code).toContain('defineVars({\n  a: 1\n}, "custom")');
    expect(ids(transform(TOKENS, { platform: "web" }).code)).toEqual([]);
  });

  test("named imports are recognised", () => {
    const code = transform(
      `import { defineVars } from "stylexn";\nexport const t = defineVars({ a: 1 });`,
    ).code;
    expect(ids(code)).toHaveLength(1);
  });
});

describe("rnVersion default", () => {
  test("is detected from the installed react-native package", () => {
    // packages/stylexn has react-native as a devDependency; mixBlendMode needs 0.76.
    const styles = compiled(
      `${HEADER}const styles = stylex.create({ a: { mixBlendMode: "multiply" } });`,
      {},
    );
    expect(styles.a.static).toEqual({ mixBlendMode: "multiply" });
  });
});

describe("keyframes", () => {
  test("native: frames are compiled like rules", () => {
    const { code } = transform(
      `${HEADER}const spin = stylex.keyframes({ from: { transform: "rotate(0deg)" }, "50%": { padding: "4px 8px" }, to: { transform: "rotate(360deg)" } });`,
    );
    expect(code).toContain("$$stylexn: 1");
    expect(code).toContain('"paddingLeft": 8');
    expect(code).toContain('"50%"');
  });

  test("frames are checked: unsupported styles fail strict builds", () => {
    expect(() =>
      transform(`${HEADER}const k = stylex.keyframes({ from: { float: "left" } });`, {
        strict: true,
      }),
    ).toThrow(/keyframes from[\s\S]*float/);
    expect(() => transform(`${HEADER}const k = stylex.keyframes({ from: other });`)).toThrow(
      /object literal/,
    );
  });

  test("web: keyframes are left for StyleX", () => {
    const src = `${HEADER}const k = stylex.keyframes({ from: { opacity: 0 } });`;
    expect(transform(src, { platform: "web" }).code).not.toContain("$$stylexn");
    expect(transform(src, { platform: "web" }).code).not.toContain("stylexn-keyframes-");
  });
});

/** Injected keyframes ids in plugin output, in order. */
const keyframesIds = (code: string) =>
  [...code.matchAll(/"(stylexn-keyframes-[a-z0-9]+)"\)/g)].map((m) => m[1]);

describe("keyframes ids", () => {
  const MOTION = `${HEADER}
    export const fade = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
    export const spin = stylex.keyframes({ to: { transform: "rotate(360deg)" } });
    export default stylex.keyframes({ to: { opacity: 0 } });`;
  const at = (file: string, rootDir = "/repo") =>
    keyframesIds(transform(MOTION, { rootDir }, file).code);

  test("native: a stable id per file and export is injected after the compiled frames", () => {
    const a = at("/repo/packages/shared/motion.ts");
    expect(a).toHaveLength(3);
    expect(a).toEqual(at("/repo/packages/shared/motion.ts")); // same on every build and Fast Refresh
    expect(new Set(a).size).toBe(3); // distinct per export
    expect(at("/repo/packages/shared/motion.ts")).toEqual(
      at("/other/place/packages/shared/motion.ts", "/other/place"),
    );
    expect(at("/repo/packages/shared/other.ts")).not.toEqual(a);
    // The frames are still compiled: the id is appended, not substituted.
    const { code } = transform(MOTION, { rootDir: "/repo" }, "/repo/packages/shared/motion.ts");
    expect(code).toContain("$$stylexn: 1");
  });

  test("keyframes and defineVars in one file get unrelated ids", () => {
    const code = transform(
      `${HEADER}export const x = stylex.defineVars({ a: 1 }); export const y = stylex.keyframes({ to: { opacity: 0 } });`,
      { rootDir: "/repo" },
      "/repo/a.ts",
    ).code;
    expect(ids(code)).toHaveLength(1);
    expect(keyframesIds(code)).toHaveLength(1);
  });

  test("an explicit id is left alone", () => {
    const code = transform(
      `${HEADER}export const k = stylex.keyframes({ to: { opacity: 0 } }, "custom");`,
    ).code;
    expect(code).toContain('}, "custom")');
    expect(keyframesIds(code)).toEqual([]);
  });
});
