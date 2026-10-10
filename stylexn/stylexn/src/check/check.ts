import {
  isAvailable,
  lookupAtRule,
  lookupFunction,
  lookupMediaFeature,
  lookupProperty,
  lookupPseudoClass,
  lookupPseudoElement,
  lookupUnit,
  RN_TARGET,
  UNKNOWN,
} from "../compat/index.ts";
import type { Entry, RNVersion, Status } from "../compat/types.ts";
import { apis, rnOnlyKeys } from "../compat/table.ts";
import { describeSentinels, isSentinel } from "../sentinel.ts";
import { isFunction, looksLikeColor, splitSpace } from "../expand/tokenize.ts";
import type { Leaf, Value } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
import { convertColor } from "../lower/color.ts";
import { rewriteEnv } from "../lower/env-function.ts";
import { foldMath, mapFunctions } from "../lower/fold.ts";
import {
  containsLh,
  LH_IN_LINE_HEIGHT,
  LH_NEEDS_LINE_HEIGHT,
  lineHeightBasis,
  rewriteLh,
  type LineHeightBasis,
} from "../lower/lh-unit.ts";
import { parseLength } from "../lower/units.ts";

export type FindingKind =
  | "property"
  | "version"
  | "value"
  | "unit"
  | "function"
  | "condition"
  | "media-feature";

export type Finding = Readonly<{
  kind: FindingKind;
  status: Status;
  property: string;
  /** Condition keys from the property down to the offending leaf, `default` included. */
  conditions: readonly string[];
  value?: Leaf;
  message: string;
}>;

export type CheckOptions = Readonly<{
  /** React Native version to check `since` against. Default RN_TARGET. */
  rnVersion?: RNVersion;
}>;

const PATTERNS: Readonly<Record<string, (token: string, isNumber: boolean) => boolean>> = {
  "<length>": (t, n) => n || parseLength(t) !== null,
  "<percentage>": (t) => t.endsWith("%") && parseLength(t) !== null,
  "<number>": (t, n) => n || parseLength(t)?.unit === "",
  "<color>": (t) => looksLikeColor(t),
  "<string>": () => true,
};

function tokenAccepted(token: string, isNumber: boolean, values: readonly string[]): boolean {
  const lower = token.toLowerCase();
  const fnName = isFunction(token) ? token.slice(0, token.indexOf("(")).toLowerCase() : null;
  // var() can resolve to anything; the function check handles other functions.
  if (fnName === "var") return true;
  for (const v of values) {
    if (v.startsWith("<")) {
      // A function in a <length>/<color>/... slot is valid CSS; lookupFunction decides.
      if (fnName !== null || PATTERNS[v]?.(token, isNumber)) return true;
    } else if (fnName !== null ? fnName === v.toLowerCase() : lower === v.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/** A multi-word keyword the entry lists as a whole (`x mandatory`), not token by token. */
const wholeValueAccepted = (value: string, values: readonly string[]): boolean =>
  value.includes(" ") && values.includes(value.trim().toLowerCase().replace(/\s+/g, " "));

/** What a leaf's check may read from the rest of its rule. */
type RuleContext = Readonly<{ lineHeight: LineHeightBasis | null }>;

/**
 * Apply the lowering's compile-time substitutions (`env(safe-area-inset-*)`
 * to var(), `lh` to px/em) so the rest of the check sees what React Native
 * will get. Null when the value cannot be substituted; the finding is pushed.
 */
function substitute(
  property: string,
  value: string,
  conditions: readonly string[],
  context: RuleContext,
  out: Finding[],
): string | null {
  const env = rewriteEnv(value);
  if (env.unknown.length) {
    const note = lookupFunction("env").note ?? "not supported on React Native";
    for (const name of env.unknown) {
      out.push({
        kind: "function",
        status: "unsupported",
        property,
        conditions,
        value,
        message: `${property}: env(${name}) — ${note}`,
      });
    }
    return null;
  }
  if (!containsLh(env.value)) return env.value;
  if (property !== "lineHeight" && context.lineHeight)
    return rewriteLh(env.value, context.lineHeight);
  out.push({
    kind: "unit",
    status: "unsupported",
    property,
    conditions,
    value,
    message: `${property}: ${property === "lineHeight" ? LH_IN_LINE_HEIGHT : LH_NEEDS_LINE_HEIGHT}`,
  });
  return null;
}

function checkLeaf(
  property: string,
  entry: Entry,
  written: Leaf,
  conditions: readonly string[],
  context: RuleContext,
  out: Finding[],
): void {
  if (written === null || isSentinel(written)) return; // unset, or only known at runtime
  const value =
    typeof written === "string" ? substitute(property, written, conditions, context, out) : written;
  if (value === null) return;
  const isNumber = typeof value === "number";
  const tokens = isNumber ? [String(value)] : splitSpace(value);

  if (
    entry.status === "partial" &&
    entry.values &&
    !(typeof value === "string" && wholeValueAccepted(value, entry.values))
  ) {
    const rejected = tokens.filter((t) => !tokenAccepted(t, isNumber, entry.values as string[]));
    if (rejected.length) {
      out.push({
        kind: "value",
        status: "partial",
        property,
        conditions,
        value: written,
        message: `${property}: "${rejected.join(" ")}" is not supported on React Native; accepted: ${entry.values.join(", ")}`,
      });
    }
  }
  if (isNumber) return;

  for (const token of tokens) {
    if (isFunction(token)) {
      const name = token.slice(0, token.indexOf("(")).toLowerCase();
      const fn = lookupFunction(name);
      // Functions the table does not list (rotate(), blur(), ...) belong to a
      // property; the property's own values list judges them.
      // Math and color functions are fine when lowering can make them static
      // (or, for math with relative units / var(), resolve them at runtime).
      const report = (reason: string) =>
        out.push({
          kind: "function",
          status: "partial",
          property,
          conditions,
          value: written,
          message: `${property}: ${reason}`,
        });
      const folded = foldMath(token) ?? convertColor(token);
      if (folded) {
        if (folded.ok === false) report(folded.reason);
        continue;
      }
      if (fn === UNKNOWN) {
        // A transform/gradient/... function: check the math and colors inside it.
        mapFunctions(token, (inner) => {
          if (inner === token) return undefined;
          const r = foldMath(inner) ?? convertColor(inner);
          if (r && r.ok === false) report(r.reason);
          return undefined;
        });
        continue;
      }
      if (fn.status === "unsupported" || fn.status === "web-only" || fn.status === "partial") {
        out.push({
          kind: "function",
          status: fn.status,
          property,
          conditions,
          value: written,
          message: `${property}: ${name}() — ${fn.note ?? "not supported on React Native"}`,
        });
      }
      continue;
    }
    const length = parseLength(token);
    if (length && length.unit !== "" && length.unit !== "%") {
      const unit = lookupUnit(length.unit);
      if (unit.status === "unsupported" || unit.status === "web-only") {
        out.push({
          kind: "unit",
          status: unit.status,
          property,
          conditions,
          value: written,
          message: `${property}: unit "${length.unit}" — ${unit.note ?? "not supported on React Native"}`,
        });
      }
    }
  }
}

const MEDIA_FEATURE = /\(\s*([a-z-]+)\s*(?::|\)|>=|<=|>|<)/gi;

/** A `when.*` condition key: `:where-ancestor(:hover, <marker>)`. Markers are opaque. */
const RELATIONAL = /^:where-([a-z-]+)\((.*), ([^,]*)\)$/s;
const WHEN_API: Readonly<Record<string, string>> = {
  ancestor: "ancestor",
  descendant: "descendant",
  "sibling-before": "siblingBefore",
  "sibling-after": "siblingAfter",
  "any-sibling": "anySibling",
};
const WHEN_SUPPORTED: readonly string[] = apis.when.values;

/**
 * Findings for a `when.*` condition: `ancestor` is judged by its
 * pseudo-class like a plain one; the other kinds by the `when` API entry.
 */
function checkRelational(
  property: string,
  condition: string,
  conditions: readonly string[],
  out: Finding[],
): void {
  const m = condition.match(RELATIONAL);
  const api = m ? WHEN_API[m[1] as string] : undefined;
  const pseudo = m?.[2] as string;
  const shown = api ? `when.${api}(${pseudo})` : describeSentinels(condition, "marker");
  let entry: Entry;
  if (!api) entry = { status: "unsupported", note: "Not a condition StyleXN understands." };
  else if (!WHEN_SUPPORTED.includes(api)) entry = { status: "unsupported", note: apis.when.note };
  else entry = lookupPseudoClass(pseudo);
  if (entry.status === "unsupported" || entry.status === "web-only") {
    out.push({
      kind: "condition",
      status: entry.status,
      property,
      conditions,
      message: `${shown} on ${property} — ${entry.note ?? "not supported on React Native"}`,
    });
  }
}

function checkCondition(
  property: string,
  condition: string,
  conditions: readonly string[],
  out: Finding[],
): void {
  if (condition === "default") return;
  if (condition.startsWith(":where-")) {
    checkRelational(property, condition, conditions, out);
    return;
  }
  let entry: Entry;
  if (condition.startsWith("::")) {
    entry = lookupPseudoElement(condition);
    if (entry.status === "partial" && entry.values && !entry.values.includes(property)) {
      out.push({
        kind: "condition",
        status: "unsupported",
        property,
        conditions,
        message: `${condition} on ${property}: only ${entry.values.join(", ")} is supported on React Native`,
      });
      return;
    }
  } else if (condition.startsWith(":")) {
    entry = lookupPseudoClass(condition);
  } else if (condition.startsWith("@")) {
    entry = lookupAtRule(condition);
    if (condition.startsWith("@media") && entry.status !== "unsupported") {
      for (const m of condition.matchAll(MEDIA_FEATURE)) {
        const feature = (m[1] as string)
          .toLowerCase()
          .replace(/^(min|max)-(?=(width|height|aspect-ratio|resolution)$)/, "$1-");
        const f = lookupMediaFeature(feature);
        if (f.status === "unsupported" || f.status === "web-only") {
          out.push({
            kind: "media-feature",
            status: f.status,
            property,
            conditions,
            message: `${condition} on ${property}: ${feature} — ${f.note ?? "not supported on React Native"}`,
          });
        }
      }
    }
  } else {
    entry = { status: "unsupported", note: "Not a condition StyleXN understands." };
  }
  if (entry.status === "unsupported" || entry.status === "web-only") {
    out.push({
      kind: "condition",
      status: entry.status,
      property,
      conditions,
      message: `${condition} on ${property} — ${entry.note ?? "not supported on React Native"}`,
    });
  }
}

function walk(
  property: string,
  entry: Entry,
  value: Value,
  conditions: readonly string[],
  context: RuleContext,
  out: Finding[],
): void {
  if (!isConditional(value)) {
    checkLeaf(property, entry, value, conditions, context, out);
    return;
  }
  for (const [condition, branch] of Object.entries(value)) {
    const chain = [...conditions, condition];
    checkCondition(property, condition, chain, out);
    walk(property, entry, branch, chain, context, out);
  }
}

/**
 * Check expanded declarations against the compat table. Findings are
 * descriptive; callers decide what is an error (see the Babel plugin).
 */
export function checkDeclarations(
  style: Readonly<Record<string, Value>>,
  options: CheckOptions = {},
): Finding[] {
  const rnVersion = options.rnVersion ?? RN_TARGET;
  const out: Finding[] = [];
  const context: RuleContext = { lineHeight: lineHeightBasis(style.lineHeight) };
  for (const [property, value] of Object.entries(style)) {
    if (rnOnlyKeys.has(property)) continue; // React Native-only keys from expansion/renames
    const entry = lookupProperty(property);
    if (entry.status === "unsupported" || entry.status === "web-only") {
      out.push({
        kind: "property",
        status: entry.status,
        property,
        conditions: [],
        message: `${property} — ${entry.note ?? "not supported on React Native"}`,
      });
      continue;
    }
    if (!isAvailable(entry, rnVersion)) {
      out.push({
        kind: "version",
        status: "unsupported",
        property,
        conditions: [],
        message: `${property} needs React Native ${entry.since}; targeting ${rnVersion}`,
      });
      continue;
    }
    walk(property, entry, value, [], context, out);
  }
  return out;
}

/** Findings that should fail a strict build. */
/**
 * Findings a strict build rejects and a lenient one strips: no native
 * behaviour at all, or a value outside a `partial` property's list (it
 * would reach React Native unchanged and fail there).
 */
export function isBlocking(finding: Finding): boolean {
  return (
    finding.status === "unsupported" || (finding.kind === "value" && finding.status === "partial")
  );
}

/** Whether `value` is one the `partial` entry accepts; used by the runtime for dynamic values. */
export function acceptsValue(entry: Entry, value: string | number): boolean {
  if (entry.status !== "partial" || !entry.values) return true;
  const isNumber = typeof value === "number";
  if (typeof value === "string" && wholeValueAccepted(value, entry.values)) return true;
  const tokens = isNumber ? [String(value)] : splitSpace(value);
  return tokens.every((t) => tokenAccepted(t, isNumber, entry.values as string[]));
}
