import type { NodePath, PluginObj, PluginPass, types as t } from "@babel/core";
import type { RNVersion } from "../compat/types.ts";
import { compileRule, isBlocking } from "../compile/compile.ts";
import type { CompiledLeaf, CompiledRule } from "../compile/compile.ts";
import { isSentinel, makeSentinel, sentinelIndex } from "../sentinel.ts";
import type { Declarations, Value } from "../expand/types.ts";

export type StyleXNPluginOptions = Readonly<{
  /** `native` compiles; `web` leaves the file untouched (StyleX handles web). */
  platform?: "native" | "web";
  /** Fail the build on unsupported styles. Default: `process.env.CI` is set. */
  strict?: boolean;
  /** React Native version to check `since` against. */
  rnVersion?: RNVersion;
  /** Module specifiers that provide the StyleX API. */
  importSources?: readonly string[];
  /** Receives non-fatal messages; defaults to console.warn. */
  onWarning?: (message: string) => void;
}>;

const DEFAULT_IMPORT_SOURCES = ["@stylexjs/stylex", "stylex", "stylexn"];

type Babel = { types: typeof t };

type State = PluginPass & {
  stylexn: {
    namespaces: Set<string>;
    creates: Set<string>;
  };
};

// No parameter properties: the package is consumed via Node type stripping.
class CompileError extends Error {
  readonly node: t.Node;
  constructor(message: string, node: t.Node) {
    super(message);
    this.node = node;
  }
}

export default function stylexnBabelPlugin(
  babel: Babel,
  options: StyleXNPluginOptions = {},
): PluginObj<State> {
  const { types: T } = babel;
  const importSources = new Set(options.importSources ?? DEFAULT_IMPORT_SOURCES);
  const strict = options.strict ?? Boolean(process.env.CI);
  const warn = options.onWarning ?? ((m: string) => console.warn(`[stylexn] ${m}`));
  const platform = options.platform ?? "native";

  // -------------------------------------------------------------------------
  // AST -> declarations
  // -------------------------------------------------------------------------

  function keyName(prop: t.ObjectProperty, path: NodePath): string {
    const key = prop.key;
    if (!prop.computed && T.isIdentifier(key)) return key.name;
    if (T.isStringLiteral(key)) return key.value;
    if (prop.computed && T.isIdentifier(key)) {
      const binding = path.scope.getBinding(key.name);
      const init = binding?.path.node;
      if (
        binding?.kind === "const" &&
        T.isVariableDeclarator(init) &&
        T.isStringLiteral(init.init)
      ) {
        return init.init.value;
      }
      if (
        binding?.kind === "const" &&
        T.isVariableDeclarator(init) &&
        T.isTemplateLiteral(init.init) &&
        init.init.expressions.length === 0
      ) {
        return init.init.quasis.map((q) => q.value.cooked ?? "").join("");
      }
    }
    throw new CompileError("style keys must be identifiers, string literals or const strings", key);
  }

  function toValue(node: t.Node, exprs: t.Expression[], path: NodePath, nested: boolean): Value {
    if (T.isStringLiteral(node)) return node.value;
    if (T.isNumericLiteral(node)) return node.value;
    if (T.isNullLiteral(node)) return null;
    if (T.isUnaryExpression(node, { operator: "-" }) && T.isNumericLiteral(node.argument)) {
      return -node.argument.value;
    }
    if (T.isTemplateLiteral(node) && node.expressions.length === 0) {
      return node.quasis.map((q) => q.value.cooked ?? "").join("");
    }
    if (T.isObjectExpression(node)) {
      const out: Record<string, Value> = {};
      for (const prop of node.properties) {
        if (!T.isObjectProperty(prop)) {
          throw new CompileError("conditional values only accept plain properties", prop);
        }
        out[keyName(prop, path)] = toValue(prop.value, exprs, path, true);
      }
      return out;
    }
    if (T.isExpression(node)) {
      if (nested && T.isObjectExpression(node)) throw new CompileError("unexpected object", node);
      exprs.push(node);
      return makeSentinel(exprs.length - 1);
    }
    throw new CompileError("unsupported style value", node);
  }

  function toDeclarations(
    obj: t.ObjectExpression,
    exprs: t.Expression[],
    path: NodePath,
  ): Declarations {
    const out: Record<string, Value> = {};
    for (const prop of obj.properties) {
      if (!T.isObjectProperty(prop)) {
        throw new CompileError(
          "style rules only accept plain properties (no spread/methods)",
          prop,
        );
      }
      out[keyName(prop, path)] = toValue(prop.value, exprs, path, false);
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // compiled rule -> AST
  // -------------------------------------------------------------------------

  function leafToNode(value: CompiledLeaf, exprs: readonly t.Expression[]): t.Expression {
    if (isSentinel(value)) {
      const expr = exprs[sentinelIndex(value)];
      if (!expr) throw new Error("stylexn: dangling expression placeholder");
      return T.cloneNode(expr, true);
    }
    if (value === null) return T.nullLiteral();
    if (typeof value === "string") return T.stringLiteral(value);
    if (typeof value === "number") return T.numericLiteral(value);
    if (typeof value === "boolean") return T.booleanLiteral(value);
    if (Array.isArray(value)) return T.arrayExpression(value.map((v) => leafToNode(v, exprs)));
    if (!("width" in value && "height" in value)) {
      throw new Error("stylexn: unexpected object in compiled output");
    }
    const obj = value as Readonly<{ width: CompiledLeaf; height: CompiledLeaf }>;
    return T.objectExpression([
      T.objectProperty(T.identifier("width"), leafToNode(obj.width, exprs)),
      T.objectProperty(T.identifier("height"), leafToNode(obj.height, exprs)),
    ]);
  }

  function recordToNode(
    record: Readonly<Record<string, CompiledLeaf>>,
    exprs: readonly t.Expression[],
  ) {
    return T.objectExpression(
      Object.entries(record).map(([k, v]) =>
        T.objectProperty(T.stringLiteral(k), leafToNode(v, exprs)),
      ),
    );
  }

  function entriesToNode(
    entries: CompiledRule["conditional"],
    exprs: readonly t.Expression[],
  ): t.ArrayExpression {
    return T.arrayExpression(
      entries.map((e) =>
        T.objectExpression([
          T.objectProperty(T.identifier("key"), T.stringLiteral(e.key)),
          T.objectProperty(
            T.identifier("when"),
            T.arrayExpression(e.when.map((w) => T.stringLiteral(w))),
          ),
          T.objectProperty(T.identifier("value"), leafToNode(e.value, exprs)),
        ]),
      ),
    );
  }

  function ruleToNode(rule: CompiledRule, exprs: readonly t.Expression[]): t.ObjectExpression {
    return T.objectExpression([
      T.objectProperty(T.identifier("$$stylexn"), T.numericLiteral(1)),
      T.objectProperty(T.identifier("static"), recordToNode(rule.static, exprs)),
      T.objectProperty(T.identifier("conditional"), entriesToNode(rule.conditional, exprs)),
      T.objectProperty(T.identifier("props"), recordToNode(rule.props, exprs)),
      T.objectProperty(
        T.identifier("conditionalProps"),
        entriesToNode(rule.conditionalProps, exprs),
      ),
      T.objectProperty(T.identifier("depth"), recordToNode(rule.depth, exprs)),
      T.objectProperty(T.identifier("usesVars"), T.booleanLiteral(rule.usesVars)),
    ]);
  }

  // -------------------------------------------------------------------------
  // per-rule compile with policy
  // -------------------------------------------------------------------------

  function compileObject(
    obj: t.ObjectExpression,
    ruleName: string,
    path: NodePath,
    state: State,
  ): t.ObjectExpression {
    const exprs: t.Expression[] = [];
    const declarations = toDeclarations(obj, exprs, path);
    const { rule, findings, diagnostics } = compileRule(declarations, {
      strict,
      rnVersion: options.rnVersion,
    });
    const where = `${state.filename ?? "<unknown>"} rule "${ruleName}"`;
    const problems = [
      ...diagnostics.map((d) => `${d.property}: ${d.message}`),
      ...findings.filter(isBlocking).map((f) => f.message),
    ];
    if (problems.length) {
      const text = problems.map((p) => `  - ${p}`).join("\n");
      if (strict) throw new CompileError(`StyleXN: unsupported styles in ${where}\n${text}`, obj);
      warn(`${where}: stripped unsupported styles\n${text}`);
    }
    return ruleToNode(rule, exprs);
  }

  function compileCreateArgument(arg: NodePath<t.ObjectExpression>, state: State): void {
    const compiled: t.ObjectProperty[] = [];
    for (const propPath of arg.get("properties")) {
      const prop = propPath.node;
      if (!T.isObjectProperty(prop)) {
        throw propPath.buildCodeFrameError("StyleXN: stylex.create only accepts plain properties");
      }
      const name = keyName(prop, propPath);
      const value = prop.value;
      try {
        if (T.isObjectExpression(value)) {
          compiled.push(
            T.objectProperty(prop.key, compileObject(value, name, propPath, state), prop.computed),
          );
        } else if (
          (T.isArrowFunctionExpression(value) || T.isFunctionExpression(value)) &&
          T.isObjectExpression(value.body)
        ) {
          const body = compileObject(value.body, name, propPath, state);
          const fn = T.arrowFunctionExpression(value.params, body);
          compiled.push(T.objectProperty(prop.key, fn, prop.computed));
        } else {
          throw new CompileError(
            "StyleXN: a style rule must be an object literal or an arrow function returning one",
            value,
          );
        }
      } catch (error) {
        if (error instanceof CompileError) {
          throw propPath.buildCodeFrameError(error.message);
        }
        throw error;
      }
    }
    arg.replaceWith(T.objectExpression(compiled));
  }

  function isCreateCall(path: NodePath<t.CallExpression>, state: State): boolean {
    const callee = path.node.callee;
    if (T.isIdentifier(callee)) return state.stylexn.creates.has(callee.name);
    if (
      T.isMemberExpression(callee) &&
      T.isIdentifier(callee.object) &&
      T.isIdentifier(callee.property, { name: "create" }) &&
      !callee.computed
    ) {
      return state.stylexn.namespaces.has(callee.object.name);
    }
    return false;
  }

  return {
    name: "stylexn",
    pre() {
      this.stylexn = { namespaces: new Set(), creates: new Set() };
    },
    visitor: {
      ImportDeclaration(path, state) {
        if (platform === "web" || !importSources.has(path.node.source.value)) return;
        for (const spec of path.node.specifiers) {
          if (T.isImportNamespaceSpecifier(spec) || T.isImportDefaultSpecifier(spec)) {
            state.stylexn.namespaces.add(spec.local.name);
          } else if (T.isImportSpecifier(spec)) {
            const imported = T.isIdentifier(spec.imported)
              ? spec.imported.name
              : spec.imported.value;
            if (imported === "create") state.stylexn.creates.add(spec.local.name);
          }
        }
      },
      CallExpression(path, state) {
        if (platform === "web" || !isCreateCall(path, state)) return;
        const [arg] = path.get("arguments");
        if (!arg || !arg.isObjectExpression()) {
          throw path.buildCodeFrameError("StyleXN: stylex.create expects an object literal");
        }
        compileCreateArgument(arg, state);
        path.skip();
      },
    },
  };
}
