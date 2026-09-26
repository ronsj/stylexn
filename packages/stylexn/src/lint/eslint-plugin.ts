/**
 * ESLint v9-style plugin, consumed by oxlint's `jsPlugins` (and ESLint).
 * Rule `stylexn/compat`: report styles in `stylex.create` that the compat
 * table says do not work on React Native.
 */
import type { RNVersion } from "../compat/types.ts";
import { lintDeclarations } from "./core.ts";
import type { AstNode } from "./extract.ts";
import { CreateCallTracker, ExtractError, extractRule, ruleObject } from "./extract.ts";

type RuleOptions = Readonly<{
  importSources?: readonly string[];
  rnVersion?: RNVersion;
  reportWebOnly?: boolean;
}>;

type Scope = {
  set: Map<string, { defs: { node: AstNode; parent?: AstNode }[] }>;
  upper: Scope | null;
};

type Context = {
  options: readonly RuleOptions[];
  sourceCode: { getScope(node: AstNode): Scope };
  report(descriptor: { node: AstNode; messageId: string; data: Record<string, string> }): void;
};

function resolveConstIn(context: Context) {
  return (name: string, node: AstNode): string | null => {
    for (let scope: Scope | null = context.sourceCode.getScope(node); scope; scope = scope.upper) {
      const variable = scope.set.get(name);
      if (!variable) continue;
      const def = variable.defs[0];
      const declarator = def?.node;
      const parent = def?.parent as AstNode | undefined;
      if (
        declarator?.type !== "VariableDeclarator" ||
        (parent?.kind !== "const" && (declarator.parent as AstNode | undefined)?.kind !== "const")
      ) {
        return null;
      }
      const init = declarator.init as AstNode | null;
      if (!init) return null;
      if (init.type === "Literal" && typeof init.value === "string") return init.value;
      if (init.type === "TemplateLiteral" && (init.expressions as unknown[]).length === 0) {
        return (init.quasis as { value: { cooked?: string } }[])
          .map((q) => q.value.cooked ?? "")
          .join("");
      }
      return null;
    }
    return null;
  };
}

const compat = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow StyleX styles that do not work on React Native (StyleXN compat table).",
    },
    schema: [
      {
        type: "object",
        properties: {
          importSources: { type: "array", items: { type: "string" } },
          rnVersion: { type: "string" },
          reportWebOnly: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      finding: "{{message}}",
      shape: "StyleXN: {{message}}",
    },
  },
  create(context: Context) {
    const options = context.options[0] ?? {};
    const tracker = new CreateCallTracker(options.importSources);
    const resolveConst = resolveConstIn(context);
    return {
      ImportDeclaration(node: AstNode) {
        tracker.visitImport(node);
      },
      CallExpression(node: AstNode) {
        if (!tracker.isCreateCall(node)) return;
        const [arg] = node.arguments as AstNode[];
        if (!arg || arg.type !== "ObjectExpression") return;
        for (const prop of arg.properties as AstNode[]) {
          if (prop.type !== "Property" || !prop.value) continue;
          const object = ruleObject(prop.value as AstNode);
          if (!object) continue;
          try {
            const { declarations, locations } = extractRule(object, { resolveConst });
            for (const m of lintDeclarations(declarations, locations, options)) {
              context.report({
                node: m.node ?? object,
                messageId: "finding",
                data: { message: m.severity === "warning" ? `${m.message} (warning)` : m.message },
              });
            }
          } catch (error) {
            if (error instanceof ExtractError) {
              context.report({
                node: error.node,
                messageId: "shape",
                data: { message: error.message },
              });
            } else {
              throw error;
            }
          }
        }
      },
    };
  },
};

const plugin = {
  meta: { name: "stylexn", version: "0.0.0" },
  rules: { compat },
};

export default plugin;
