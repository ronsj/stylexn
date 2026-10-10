/**
 * Turn the AST of a `stylex.create` argument into declarations, keeping the
 * node of every property/branch so findings can point at source. Works on
 * both Babel's and ESTree's node vocabularies, so the Babel plugin, the
 * ESLint/oxlint rule and the CLI share one implementation.
 *
 * Escape hatches: `...web({ ... })` and `...native({ ... })` spreads inside a
 * rule. Which side is kept depends on `platform`; native blocks are marked
 * `trusted` so the compat check leaves them alone.
 *
 * Relational conditions: a computed key `[stylex.when.ancestor(":hover",
 * marker)]` becomes the condition key `:where-ancestor(:hover, <marker>)`,
 * where `<marker>` is `default-marker` or a sentinel for the marker
 * expression (the Babel plugin emits it as `${marker.$$stylexnMarker}`).
 *
 * Fallback lists: a `stylex.firstThatWorks(a, b, ...)` value becomes a
 * `firstThatWorks` tag (see first-that-works.ts) whose literal candidates stay
 * literals and other candidates become sentinels; the compiler picks one.
 */
import type { Leaf } from "../expand/types.ts";
import { makeFirstThatWorks } from "../first-that-works.ts";
import type { AuthoredDeclarations, AuthoredValue } from "../first-that-works.ts";
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
/** The `stylex.when.*` relational conditions. */
export type WhenKind = "ancestor" | "descendant" | "siblingBefore" | "siblingAfter" | "anySibling";

/** Condition-key spelling of each kind: `:where-<kind>(...)`, as StyleX writes it. */
export const WHEN_CONDITIONS: Readonly<Record<WhenKind, string>> = {
  ancestor: "ancestor",
  descendant: "descendant",
  siblingBefore: "sibling-before",
  siblingAfter: "sibling-after",
  anySibling: "any-sibling",
};

const isWhenKind = (name: string): name is WhenKind => Object.hasOwn(WHEN_CONDITIONS, name);

export type ExtractOptions = Readonly<{
  /** Value of a `const` string binding for computed keys, or null if unknown. */
  resolveConst: (name: string, node: AstNode) => string | null;
  /** Which escape-hatch helper a call expression is, if any. */
  helper?: (call: AstNode) => HelperKind | null;
  /** Which `when.*` condition a call expression is, if any (computed condition keys). */
  when?: (call: AstNode) => WhenKind | null;
  /** Whether a call expression is `firstThatWorks(...)` from a StyleX import. */
  firstThatWorks?: (call: AstNode) => boolean;
  /** Which platform's blocks to keep. Default native. */
  platform?: Platform;
}>;

export type Extracted = Readonly<{
  declarations: AuthoredDeclarations;
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

function literalValue(n: AstNode): Leaf | undefined {
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

/**
 * Name of an object property key: identifier, string literal, a resolvable
 * const, or a `when.*` call. `expression` turns a non-literal node (the
 * marker argument) into a sentinel.
 */
export function propertyName(
  prop: AstNode,
  options: ExtractOptions,
  expression: (node: AstNode) => string,
): string {
  const key = prop.key as AstNode;
  if (!prop.computed && key.type === "Identifier") return key.name as string;
  const literal = stringValue(key);
  if (literal !== undefined) return literal;
  if (prop.computed && key.type === "Identifier") {
    const resolved = options.resolveConst(key.name as string, key);
    if (resolved !== null) return resolved;
  }
  if (prop.computed && key.type === "CallExpression") {
    const kind = options.when?.(key) ?? null;
    if (kind) return whenCondition(kind, key, expression);
  }
  throw new ExtractError(
    "style keys must be identifiers, string literals, const strings or stylex.when.* calls",
    key,
  );
}

/** `when.<kind>(pseudo, marker?)` as the condition key `:where-<kind>(<pseudo>, <marker>)`. */
function whenCondition(
  kind: WhenKind,
  call: AstNode,
  expression: (node: AstNode) => string,
): string {
  const [pseudoNode, marker] = call.arguments as AstNode[];
  const pseudo = pseudoNode && stringValue(pseudoNode);
  if (pseudo === undefined) {
    throw new ExtractError(`when.${kind}() expects a string literal pseudo-class`, call);
  }
  const id = marker ? expression(marker) : "default-marker";
  return `:where-${WHEN_CONDITIONS[kind]}(${pseudo}, ${id})`;
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
  const expression = (node: AstNode): string => {
    expressions.push(node);
    return makeSentinel(expressions.length - 1);
  };

  const toValue = (node: AstNode, path: string): AuthoredValue => {
    const literal = literalValue(node);
    if (literal !== undefined) return literal;
    if (node.type === "CallExpression" && options.firstThatWorks?.(node)) {
      const args = node.arguments as AstNode[];
      if (args.length === 0) {
        throw new ExtractError("firstThatWorks() expects at least one value", node);
      }
      return makeFirstThatWorks(
        args.map((arg): Leaf => {
          if (isSpread(arg)) {
            throw new ExtractError("firstThatWorks() does not accept spread arguments", arg);
          }
          return literalValue(arg) ?? expression(arg);
        }),
      );
    }
    if (isObjectExpression(node)) {
      const out: Record<string, AuthoredValue> = {};
      for (const prop of node.properties as AstNode[]) {
        if (!isProperty(prop)) {
          throw new ExtractError("conditional values only accept plain properties", prop);
        }
        const name = propertyName(prop, options, expression);
        const branchPath = `${path}[${name}]`;
        locations.set(branchPath, prop);
        out[name] = toValue(prop.value as AstNode, branchPath);
      }
      return out;
    }
    return expression(node);
  };

  const declarations: Record<string, AuthoredValue> = {};
  const addProperty = (prop: AstNode, trust: boolean) => {
    if (!isProperty(prop)) {
      throw new ExtractError("style rules only accept plain properties (no spread/methods)", prop);
    }
    const name = propertyName(prop, options, expression);
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

/**
 * Tracks StyleX imports in a file and recognises `create`, `defineVars`,
 * `defineMarker`, `keyframes`, `firstThatWorks`, `when.*`, `web` and `native`
 * through them.
 */
export class CreateCallTracker {
  private readonly namespaces = new Set<string>();
  private readonly creates = new Set<string>();
  private readonly defineVars = new Set<string>();
  private readonly defineMarkers = new Set<string>();
  private readonly keyframes = new Set<string>();
  private readonly whens = new Set<string>();
  private readonly firstThatWorks = new Set<string>();
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
        if (name === "defineMarker") this.defineMarkers.add(local);
        if (name === "when") this.whens.add(local);
        if (name === "keyframes") this.keyframes.add(local);
        if (name === "firstThatWorks") this.firstThatWorks.add(local);
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

  isDefineMarkerCall(node: AstNode): boolean {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.defineMarkers.has(callee.name as string);
    return this.memberOf(callee) === "defineMarker";
  }

  isFirstThatWorksCall(node: AstNode): boolean {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.firstThatWorks.has(callee.name as string);
    return this.memberOf(callee) === "firstThatWorks";
  }

  /** The kind of a `stylex.when.<kind>(...)` / `when.<kind>(...)` call from a StyleX import. */
  whenKind(node: AstNode): WhenKind | null {
    const callee = node.callee as AstNode;
    if (callee.type !== "MemberExpression" || callee.computed) return null;
    const property = callee.property as AstNode;
    if (property.type !== "Identifier" || !isWhenKind(property.name as string)) return null;
    const object = callee.object as AstNode;
    const isWhen =
      object.type === "Identifier"
        ? this.whens.has(object.name as string)
        : this.memberOf(object) === "when";
    return isWhen ? (property.name as WhenKind) : null;
  }

  /** `web` or `native` when the call is an escape-hatch helper from a StyleX import. */
  helperKind(node: AstNode): HelperKind | null {
    const callee = node.callee as AstNode;
    if (callee.type === "Identifier") return this.helpers.get(callee.name as string) ?? null;
    const member = this.memberOf(callee);
    return member === "web" || member === "native" ? member : null;
  }
}
