import { relative, sep } from "node:path";
import type { NodePath, PluginObj, PluginPass, types as t } from "@babel/core";
import type { RNVersion } from "../compat/types.ts";
import { compileRule, isBlocking } from "../compile/compile.ts";
import type { CompiledLeaf, CompiledRule } from "../compile/compile.ts";
import type { AstNode } from "../lint/extract.ts";
import {
  CreateCallTracker,
  ExtractError,
  extractRule,
  helperSpread,
  ruleObject,
} from "../lint/extract.ts";
import { detectRNVersionFor } from "../node/rn-version.ts";
import { isSentinel, sentinelIndex } from "../sentinel.ts";

export type StyleXNPluginOptions = Readonly<{
  /**
   * `native` compiles rules to the runtime shape. `web` only resolves the
   * escape hatches (inlines `...web({ })`, drops `...native({ })`) and must
   * run before @stylexjs/babel-plugin.
   */
  platform?: "native" | "web";
  /** Fail the build on unsupported styles. Default: `process.env.CI` is set. */
  strict?: boolean;
  /**
   * React Native version to check `since` against. Default: the version of
   * the `react-native` package resolvable from the file or the working
   * directory, else the table's RN_TARGET.
   */
  rnVersion?: RNVersion;
  /**
   * Directory `defineVars` ids are hashed relative to, so the ids do not
   * depend on where the repository is checked out. Default: Babel's cwd.
   */
  rootDir?: string;
  /** Module specifiers that provide the StyleX API. */
  importSources?: readonly string[];
  /** Receives non-fatal messages; defaults to console.warn. */
  onWarning?: (message: string) => void;
}>;

type Babel = { types: typeof t };

type State = PluginPass & { stylexn: CreateCallTracker; stylexnRNVersion?: RNVersion };

// No parameter properties: the package is consumed via Node type stripping.
class CompileError extends Error {
  readonly node: t.Node;
  constructor(message: string, node: t.Node) {
    super(message);
    this.node = node;
  }
}

const asNode = (n: t.Node): AstNode => n as unknown as AstNode;

/** 32-bit FNV-1a, base36: short, stable, dependency-free. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function rethrow(error: unknown, path: NodePath): never {
  if (error instanceof CompileError) throw path.buildCodeFrameError(error.message);
  if (error instanceof ExtractError) throw path.buildCodeFrameError(`StyleXN: ${error.message}`);
  throw error;
}

export default function stylexnBabelPlugin(
  babel: Babel,
  options: StyleXNPluginOptions = {},
): PluginObj<State> {
  const { types: T } = babel;
  const strict = options.strict ?? Boolean(process.env.CI);
  const warn = options.onWarning ?? ((m: string) => console.warn(`[stylexn] ${m}`));
  const platform = options.platform ?? "native";

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
  // shared helpers
  // -------------------------------------------------------------------------

  function resolveConstIn(path: NodePath) {
    return (name: string): string | null => {
      const binding = path.scope.getBinding(name);
      const init = binding?.path.node;
      if (binding?.kind !== "const" || !T.isVariableDeclarator(init)) return null;
      if (T.isStringLiteral(init.init)) return init.init.value;
      if (T.isTemplateLiteral(init.init) && init.init.expressions.length === 0) {
        return init.init.quasis.map((q) => q.value.cooked ?? "").join("");
      }
      return null;
    };
  }

  // -------------------------------------------------------------------------
  // native: compile each rule with policy
  // -------------------------------------------------------------------------

  function compileObject(
    object: t.ObjectExpression,
    ruleName: string,
    path: NodePath,
    state: State,
  ): t.ObjectExpression {
    const { declarations, expressions, trusted } = extractRule(asNode(object), {
      resolveConst: resolveConstIn(path),
      helper: (call) => state.stylexn.helperKind(call),
      platform: "native",
    });
    const exprs = expressions as unknown as t.Expression[];
    const { rule, findings, diagnostics } = compileRule(declarations, {
      strict,
      rnVersion: state.stylexnRNVersion,
      trusted,
    });
    const where = `${state.filename ?? "<unknown>"} rule "${ruleName}"`;
    const problems = [
      ...diagnostics.map((d) => `${d.property}: ${d.message}`),
      ...findings.filter(isBlocking).map((f) => f.message),
    ];
    if (problems.length) {
      const text = problems.map((p) => `  - ${p}`).join("\n");
      if (strict)
        throw new CompileError(`StyleXN: unsupported styles in ${where}\n${text}`, object);
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
      const key = prop.key;
      const name = T.isIdentifier(key) ? key.name : T.isStringLiteral(key) ? key.value : "?";
      const value = prop.value;
      try {
        const object = ruleObject(asNode(value)) as unknown as t.ObjectExpression | null;
        if (!object) {
          throw new CompileError(
            "StyleXN: a style rule must be an object literal or an arrow function returning one",
            value,
          );
        }
        const body = compileObject(object, name, propPath, state);
        const replacement = T.isObjectExpression(value)
          ? body
          : T.arrowFunctionExpression((value as t.ArrowFunctionExpression).params, body);
        compiled.push(T.objectProperty(prop.key, replacement, prop.computed));
      } catch (error) {
        rethrow(error, propPath);
      }
    }
    arg.replaceWith(T.objectExpression(compiled));
  }

  // -------------------------------------------------------------------------
  // native: give defineVars a stable id (see runtime/vars.ts)
  // -------------------------------------------------------------------------

  function stabilizeDefineVars(path: NodePath<t.CallExpression>, state: State): void {
    const args = path.node.arguments;
    if (args.length !== 1) return; // already carries an id
    const parent = path.parentPath;
    let name: string;
    if (parent.isVariableDeclarator() && T.isIdentifier(parent.node.id)) {
      name = parent.node.id.name;
    } else if (parent.isExportDefaultDeclaration()) {
      name = "default";
    } else {
      const loc = path.node.loc?.start;
      name = loc ? `@${loc.line}:${loc.column}` : "@?";
    }
    const root = options.rootDir ?? state.cwd ?? process.cwd();
    const file = state.filename ? relative(root, state.filename).split(sep).join("/") : "<unknown>";
    args.push(T.stringLiteral(`v${hash(`${file}:${name}`)}`));
  }

  // -------------------------------------------------------------------------
  // web: resolve escape hatches in place so StyleX sees plain literals
  // -------------------------------------------------------------------------

  function resolveHatchesForWeb(arg: NodePath<t.ObjectExpression>, state: State): void {
    for (const propPath of arg.get("properties")) {
      const prop = propPath.node;
      if (!T.isObjectProperty(prop)) continue;
      const object = ruleObject(asNode(prop.value)) as unknown as t.ObjectExpression | null;
      if (!object) continue;
      const next: t.ObjectExpression["properties"] = [];
      for (const member of object.properties) {
        if (!T.isSpreadElement(member)) {
          next.push(member);
          continue;
        }
        try {
          const { kind, object: block } = helperSpread(asNode(member), {
            resolveConst: resolveConstIn(propPath),
            helper: (call) => state.stylexn.helperKind(call),
          });
          if (kind === "web") next.push(...(block as unknown as t.ObjectExpression).properties);
          // native blocks are dropped on web
        } catch (error) {
          rethrow(error, propPath);
        }
      }
      object.properties = next;
    }
  }

  return {
    name: "stylexn",
    pre() {
      this.stylexn = new CreateCallTracker(options.importSources);
      this.stylexnRNVersion =
        options.rnVersion ?? detectRNVersionFor(this.filename, this.cwd ?? process.cwd());
    },
    visitor: {
      Program(path, state) {
        if (platform !== "web") return;
        // Run before other plugins' visitors reach the create() calls.
        path.traverse({
          ImportDeclaration(p) {
            state.stylexn.visitImport(asNode(p.node));
          },
          CallExpression(p) {
            if (!state.stylexn.isCreateCall(asNode(p.node))) return;
            const [arg] = p.get("arguments");
            if (arg?.isObjectExpression()) resolveHatchesForWeb(arg, state);
          },
        });
      },
      ImportDeclaration(path, state) {
        if (platform === "web") return;
        state.stylexn.visitImport(asNode(path.node));
      },
      CallExpression(path, state) {
        if (platform === "web") return;
        if (state.stylexn.isDefineVarsCall(asNode(path.node))) {
          stabilizeDefineVars(path, state);
          return;
        }
        if (!state.stylexn.isCreateCall(asNode(path.node))) return;
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
