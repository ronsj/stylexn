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
