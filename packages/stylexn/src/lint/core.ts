/**
 * Lint core shared by the ESLint/oxlint rule and the CLI: check one rule's
 * declarations and produce messages attached to source nodes.
 */
import { checkDeclarations } from "../check/check.ts";
import type { CheckOptions, Finding } from "../check/check.ts";
import { expandDeclarations } from "../expand/expand.ts";
import type { Declarations, Diagnostic } from "../expand/types.ts";
import type { AstNode } from "./extract.ts";

export type Severity = "error" | "warning";

export type LintMessage = Readonly<{
  severity: Severity;
  message: string;
  /** Source path key (`prop`, `prop[cond]`) the message is about. */
  path: string;
  node: AstNode | undefined;
}>;

export type LintOptions = CheckOptions &
  Readonly<{
    /** Report web-only declarations (stripped on native) as warnings. Default false. */
    reportWebOnly?: boolean;
  }>;

function severityOf(finding: Finding): Severity | null {
  switch (finding.status) {
    case "unsupported":
      return "error";
    case "partial":
      return "warning";
    case "web-only":
      return null; // decided by options
    default:
      return null;
  }
}

/** Path key for a finding, translated from expanded longhands back to the authored property. */
function sourcePath(
  finding: Finding,
  origin: Readonly<Record<string, string>>,
  declared: ReadonlySet<string>,
): string {
  const property = declared.has(finding.property)
    ? finding.property
    : (origin[finding.property] ?? finding.property);
  return finding.conditions.reduce((p, c) => `${p}[${c}]`, property);
}

function locate(path: string, locations: ReadonlyMap<string, AstNode>): AstNode | undefined {
  let current = path;
  for (;;) {
    const node = locations.get(current);
    if (node) return node;
    const cut = current.lastIndexOf("[");
    if (cut === -1) return undefined;
    current = current.slice(0, cut);
  }
}

export function lintDeclarations(
  declarations: Declarations,
  locations: ReadonlyMap<string, AstNode>,
  options: LintOptions = {},
): LintMessage[] {
  const expanded = expandDeclarations(declarations);
  const findings = checkDeclarations(expanded.style, options);
  const declared = new Set(Object.keys(declarations));
  const out: LintMessage[] = [];

  for (const d of expanded.diagnostics as readonly Diagnostic[]) {
    out.push({
      severity: "error",
      message: `${d.property}: ${d.message}`,
      path: d.property,
      node: locate(d.property, locations),
    });
  }

  const seen = new Set<string>();
  for (const f of findings) {
    const severity =
      severityOf(f) ?? (f.status === "web-only" && options.reportWebOnly ? "warning" : null);
    if (!severity) continue;
    const path = sourcePath(f, expanded.origin, declared);
    // One message per source path per status: a shorthand expands to several
    // longhands that all fail the same way.
    const key = `${severity}:${path}:${f.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ severity, message: f.message, path, node: locate(path, locations) });
  }
  return out;
}
