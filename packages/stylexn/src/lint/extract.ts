/**
 * Turn the AST of a `stylex.create` argument into declarations, keeping the
 * node of every property/branch so findings can point at source. Works on
 * both Babel's and ESTree's node vocabularies, so the Babel plugin, the
 * ESLint/oxlint rule and the CLI share one implementation.
 *
 * Escape hatches: `...web({ ... })` and `...native({ ... })` spreads inside a
 * rule. Which side is kept depends on `platform`; native blocks are marked
 * `trusted` so the compat check leaves them alone.
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

export type Platform = "native" | "web";
export type HelperKind = "web" | "native";

export type ExtractOptions = Readonly<{
  /** Value of a `const` string binding for computed keys, or null if unknown. */
  resolveConst: (name: string, node: AstNode) => string | null;
  /** Which escape-hatch helper a call expression is, if any. */
  helper?: (call: AstNode) => HelperKind | null;
  /** Which platform's blocks to keep. Default native. */
  platform?: Platform;
}>;

export type Extracted = Readonly<{
  declarations: Declarations;
  /** Path key (`prop`, `prop[cond]`, ...) -> the node that declares it. */
  locations: ReadonlyMap<string, AstNode>;
  /** Non-literal value nodes, indexed by sentinel number. */
  expressions: readonly AstNode[];
  /** Properties from `native({ ... })` blocks: exempt from compat findings. */
  trusted: ReadonlySet<string>;
}>;

const isNode = (v: unknown): v is AstNode =>
  typeof v === "object" && v !== null && typeof (v as AstNode).type === "string";

export const isObjectExpression = (n: AstNode): boolean => n.type === "ObjectExpression";

function isProperty(n: AstNode): boolean {
  return n.type === "ObjectProperty" || (n.type === "Property" && n.kind === "init" && !n.method);
}

const isSpread = (n: AstNode): boolean => n.type === "SpreadElement";

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

/**
 * Classify a spread inside a rule: the helper kind and the object literal it
 * wraps. Throws for spreads that are not escape hatches or not literals.
 */
export function helperSpread(
  spread: AstNode,
  options: ExtractOptions,
): { kind: HelperKind; object: AstNode } {
  const call = spread.argument as AstNode;
  const kind = call.type === "CallExpression" ? (options.helper?.(call) ?? null) : null;
  if (!kind) {
    throw new ExtractError(
      "style rules only accept plain properties, or ...web({ }) / ...native({ }) blocks",
      spread,
    );
  }
  const [object] = call.arguments as AstNode[];
  if (!object || !isObjectExpression(object)) {
    throw new ExtractError(`${kind}() expects an object literal`, call);
  }
  return { kind, object };
}

export function extractRule(object: AstNode, options: ExtractOptions): Extracted {
  const platform = options.platform ?? "native";
  const locations = new Map<string, AstNode>();
  const expressions: AstNode[] = [];
  const trusted = new Set<string>();

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
  const addProperty = (prop: AstNode, trust: boolean) => {
    if (!isProperty(prop)) {
      throw new ExtractError("style rules only accept plain properties (no spread/methods)", prop);
    }
    const name = propertyName(prop, options);
    locations.set(name, prop);
    declarations[name] = toValue(prop.value as AstNode, name);
    if (trust) trusted.add(name);
    else trusted.delete(name);
  };

  for (const prop of object.properties as AstNode[]) {
    if (isSpread(prop)) {
      const { kind, object: block } = helperSpread(prop, options);
      if (kind !== platform) continue; // the other platform's block
      for (const inner of block.properties as AstNode[]) addProperty(inner, kind === "native");
      continue;
    }
    addProperty(prop, false);
  }
  return { declarations, locations, expressions, trusted };
}

// ---------------------------------------------------------------------------
// Finding `stylex.create` calls and escape-hatch helpers
// ---------------------------------------------------------------------------

export const DEFAULT_IMPORT_SOURCES: readonly string[] = ["@stylexjs/stylex", "stylex", "stylexn"];

/** Tracks StyleX imports in a file and recognises `create`, `defineVars`, `web` and `native` through them. */
export class CreateCallTracker {
  private readonly namespaces = new Set<string>();
  private readonly creates = new Set<string>();
  private readonly defineVars = new Set<string>();
  private readonly keyframes = new Set<string>();
  private readonly helpers = new Map<string, HelperKind>();
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
        if (name === "defineVars") this.defineVars.add(local);
        if (name === "keyframes") this.keyframes.add(local);
        if (name === "web" || name === "native") this.helpers.set(local, name);
      }
    }
  }

  private memberOf(callee: AstNode): string | null {
    if (callee.type !== "MemberExpression" || callee.computed) return null;
    const object = callee.object as AstNode;
    const property = callee.property as AstNode;
    if (object.type !== "Identifier" || property.type !== "Identifier") return null;
    return this.namespaces.has(object.name as string) ? (property.name as string) : null;
  }

  isCreateCall(node: AstNode): boolean {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.creates.has(callee.name as string);
    return this.memberOf(callee) === "create";
  }

  isKeyframesCall(node: AstNode): boolean {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.keyframes.has(callee.name as string);
    return this.memberOf(callee) === "keyframes";
  }

  isDefineVarsCall(node: AstNode): boolean {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.defineVars.has(callee.name as string);
    return this.memberOf(callee) === "defineVars";
  }

  /** `web` or `native` when the call is an escape-hatch helper from a StyleX import. */
  helperKind(node: AstNode): HelperKind | null {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.helpers.get(callee.name as string) ?? null;
    const member = this.memberOf(callee);
    return member === "web" || member === "native" ? member : null;
  }
}
