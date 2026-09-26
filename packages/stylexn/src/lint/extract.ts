/**
 * Turn the AST of a `stylex.create` argument into declarations, keeping the
 * node of every property/branch so findings can point at source. Works on
 * both Babel's and ESTree's node vocabularies, so the Babel plugin, the
 * ESLint/oxlint rule and the CLI share one implementation.
 */
import type { Declarations, Value } from "../expand/types.ts";
import { makeSentinel } from "../sentinel.ts";

/** The subset of AST node shape both vocabularies share. */
export type AstNode = {
  type: string;
  [key: string]: unknown;
};

export class ExtractError extends Error {
  readonly node: AstNode;
  constructor(message: string, node: AstNode) {
    super(message);
    this.node = node;
  }
}

export type ExtractOptions = Readonly<{
  /** Value of a `const` string binding for computed keys, or null if unknown. */
  resolveConst: (name: string, node: AstNode) => string | null;
}>;

export type Extracted = Readonly<{
  declarations: Declarations;
  /** Path key (`prop`, `prop[cond]`, ...) -> the node that declares it. */
  locations: ReadonlyMap<string, AstNode>;
  /** Non-literal value nodes, indexed by sentinel number. */
  expressions: readonly AstNode[];
}>;

const isNode = (v: unknown): v is AstNode =>
  typeof v === "object" && v !== null && typeof (v as AstNode).type === "string";

export const isObjectExpression = (n: AstNode): boolean => n.type === "ObjectExpression";

function isProperty(n: AstNode): boolean {
  return n.type === "ObjectProperty" || (n.type === "Property" && n.kind === "init" && !n.method);
}

function stringValue(n: AstNode): string | undefined {
  if (n.type === "StringLiteral") return n.value as string;
  if (n.type === "Literal" && typeof n.value === "string") return n.value;
  if (n.type === "TemplateLiteral" && (n.expressions as unknown[]).length === 0) {
    return (n.quasis as { value: { cooked?: string } }[]).map((q) => q.value.cooked ?? "").join("");
  }
  return undefined;
}

function literalValue(n: AstNode): Value | undefined {
  const s = stringValue(n);
  if (s !== undefined) return s;
  if (n.type === "NumericLiteral") return n.value as number;
  if (n.type === "NullLiteral") return null;
  if (n.type === "Literal") {
    if (typeof n.value === "number" || n.value === null) return n.value;
    return undefined;
  }
  if (n.type === "UnaryExpression" && n.operator === "-" && isNode(n.argument)) {
    const inner = literalValue(n.argument);
    if (typeof inner === "number") return -inner;
  }
  return undefined;
}

/** Name of an object property key: identifier, string literal, or a resolvable const. */
export function propertyName(prop: AstNode, options: ExtractOptions): string {
  const key = prop.key as AstNode;
  if (!prop.computed && key.type === "Identifier") return key.name as string;
  const literal = stringValue(key);
  if (literal !== undefined) return literal;
  if (prop.computed && key.type === "Identifier") {
    const resolved = options.resolveConst(key.name as string, key);
    if (resolved !== null) return resolved;
  }
  throw new ExtractError("style keys must be identifiers, string literals or const strings", key);
}

/** The object literal a rule provides: the value itself, or an arrow function's expression body. */
export function ruleObject(value: AstNode): AstNode | null {
  if (isObjectExpression(value)) return value;
  if (
    (value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression") &&
    isNode(value.body) &&
    isObjectExpression(value.body)
  ) {
    return value.body;
  }
  return null;
}

export function extractRule(object: AstNode, options: ExtractOptions): Extracted {
  const locations = new Map<string, AstNode>();
  const expressions: AstNode[] = [];

  const toValue = (node: AstNode, path: string): Value => {
    const literal = literalValue(node);
    if (literal !== undefined) return literal;
    if (isObjectExpression(node)) {
      const out: Record<string, Value> = {};
      for (const prop of node.properties as AstNode[]) {
        if (!isProperty(prop)) {
          throw new ExtractError("conditional values only accept plain properties", prop);
        }
        const name = propertyName(prop, options);
        const branchPath = `${path}[${name}]`;
        locations.set(branchPath, prop);
        out[name] = toValue(prop.value as AstNode, branchPath);
      }
      return out;
    }
    expressions.push(node);
    return makeSentinel(expressions.length - 1);
  };

  const declarations: Record<string, Value> = {};
  for (const prop of object.properties as AstNode[]) {
    if (!isProperty(prop)) {
      throw new ExtractError("style rules only accept plain properties (no spread/methods)", prop);
    }
    const name = propertyName(prop, options);
    locations.set(name, prop);
    declarations[name] = toValue(prop.value as AstNode, name);
  }
  return { declarations, locations, expressions };
}

// ---------------------------------------------------------------------------
// Finding `stylex.create` calls
// ---------------------------------------------------------------------------

export const DEFAULT_IMPORT_SOURCES: readonly string[] = ["@stylexjs/stylex", "stylex", "stylexn"];

/** Tracks StyleX imports in a file and recognises `create` calls through them. */
export class CreateCallTracker {
  private readonly namespaces = new Set<string>();
  private readonly creates = new Set<string>();
  private readonly sources: ReadonlySet<string>;

  constructor(importSources: readonly string[] = DEFAULT_IMPORT_SOURCES) {
    this.sources = new Set(importSources);
  }

  visitImport(node: AstNode): void {
    const source = (node.source as AstNode).value as string;
    if (!this.sources.has(source)) return;
    for (const spec of node.specifiers as AstNode[]) {
      const local = (spec.local as AstNode).name as string;
      if (spec.type === "ImportNamespaceSpecifier" || spec.type === "ImportDefaultSpecifier") {
        this.namespaces.add(local);
      } else if (spec.type === "ImportSpecifier") {
        const imported = spec.imported as AstNode;
        const name =
          imported.type === "Identifier" ? (imported.name as string) : (imported.value as string);
        if (name === "create") this.creates.add(local);
      }
    }
  }

  isCreateCall(node: AstNode): boolean {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.creates.has(callee.name as string);
    if (callee.type === "MemberExpression" && !callee.computed) {
      const object = callee.object as AstNode;
      const property = callee.property as AstNode;
      return (
        object.type === "Identifier" &&
        property.type === "Identifier" &&
        property.name === "create" &&
        this.namespaces.has(object.name as string)
      );
    }
    return false;
  }
}
