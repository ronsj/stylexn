/**
 * `stylexn check`: lint files for styles that do not work on React Native.
 * Same core as the ESLint/oxlint rule; meant for CI and whole-tree runs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSync, traverse } from "@babel/core";
import type { NodePath, types as t } from "@babel/core";
import type { RNVersion } from "../compat/types.ts";
import { lintDeclarations } from "../lint/core.ts";
import { detectRNVersionFor } from "../node/rn-version.ts";
import type { LintMessage, Severity } from "../lint/core.ts";
import type { AstNode } from "../lint/extract.ts";
import { CreateCallTracker, ExtractError, extractRule, ruleObject } from "../lint/extract.ts";

export type CheckOptions = Readonly<{
  importSources?: readonly string[];
  rnVersion?: RNVersion;
  reportWebOnly?: boolean;
}>;

export type Problem = Readonly<{
  file: string;
  line: number;
  column: number;
  severity: Severity;
  message: string;
}>;

/**
 * Lines carrying a `// stylexn-ignore` comment. A declaration on that line or
 * the line below is silenced. Discouraged; prefer web({ }) / native({ }).
 */
type Comment = {
  value: string;
  loc?: { start: { line: number; column: number }; end: { line: number } };
};

function ignoreLines(comments: readonly Comment[], code: string) {
  const lines = new Set<number>();
  const source = code.split("\n");
  for (const c of comments) {
    if (!/\bstylexn-ignore\b/.test(c.value) || !c.loc) continue;
    // A comment after code on its line covers that line; one on its own line covers the next.
    const before = source[c.loc.start.line - 1]?.slice(0, c.loc.start.column) ?? "";
    lines.add(before.trim() === "" ? c.loc.end.line + 1 : c.loc.start.line);
  }
  return lines;
}

function isIgnored(node: AstNode, lines: ReadonlySet<number>): boolean {
  return lines.has(position(node).line);
}

function position(node: AstNode | undefined): { line: number; column: number } {
  const loc = (node as { loc?: { start: { line: number; column: number } } } | undefined)?.loc;
  return loc ? { line: loc.start.line, column: loc.start.column + 1 } : { line: 1, column: 1 };
}

export function checkSource(code: string, file: string, options: CheckOptions = {}): Problem[] {
  const ast = parseSync(code, {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ["typescript", "jsx"] },
  });
  if (!ast) return [];

  const tracker = new CreateCallTracker(options.importSources);
  const lintOptions = {
    ...options,
    rnVersion: options.rnVersion ?? detectRNVersionFor(resolve(file), process.cwd()),
  };
  const ignored = ignoreLines((ast.comments ?? []) as Comment[], code);
  const problems: Problem[] = [];
  const push = (node: AstNode | undefined, severity: Severity, message: string) =>
    problems.push({ file, ...position(node), severity, message });

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      tracker.visitImport(path.node as unknown as AstNode);
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!tracker.isCreateCall(path.node as unknown as AstNode)) return;
      const [arg] = path.node.arguments;
      if (!arg || arg.type !== "ObjectExpression") return;
      const resolveConst = (name: string): string | null => {
        const binding = path.scope.getBinding(name);
        const init = binding?.path.node;
        if (binding?.kind !== "const" || init?.type !== "VariableDeclarator") return null;
        if (init.init?.type === "StringLiteral") return init.init.value;
        if (init.init?.type === "TemplateLiteral" && init.init.expressions.length === 0) {
          return init.init.quasis.map((q) => q.value.cooked ?? "").join("");
        }
        return null;
      };
      for (const prop of arg.properties) {
        if (prop.type !== "ObjectProperty") continue;
        const object = ruleObject(prop.value as unknown as AstNode);
        if (!object) continue;
        try {
          const { declarations, locations, trusted } = extractRule(object, {
            resolveConst,
            helper: (call) => tracker.helperKind(call as unknown as AstNode),
            platform: "native",
          });
          const messages = lintDeclarations(declarations, locations, {
            ...lintOptions,
            trusted,
          }) as LintMessage[];
          for (const m of messages) {
            if (isIgnored(m.node ?? object, ignored)) continue;
            push(m.node ?? object, m.severity, m.message);
          }
        } catch (error) {
          if (error instanceof ExtractError) push(error.node, "error", `StyleXN: ${error.message}`);
          else throw error;
        }
      }
    },
  });
  return problems;
}

export function checkFiles(files: readonly string[], options: CheckOptions = {}): Problem[] {
  return files.flatMap((file) => checkSource(readFileSync(file, "utf8"), file, options));
}

export function formatProblem(p: Problem): string {
  return `${p.file}:${p.line}:${p.column} ${p.severity}: ${p.message}`;
}
