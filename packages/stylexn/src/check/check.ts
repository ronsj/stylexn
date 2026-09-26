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
import { rnOnlyKeys } from "../compat/table.ts";
import { isSentinel } from "../sentinel.ts";
import { isFunction, looksLikeColor, splitSpace } from "../expand/tokenize.ts";
import type { Leaf, Value } from "../expand/types.ts";
import { isConditional } from "../expand/types.ts";
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
    } else if (fnName !== null ? fnName === v : lower === v) {
      return true;
    }
  }
  return false;
}

function checkLeaf(
  property: string,
  entry: Entry,
  value: Leaf,
  conditions: readonly string[],
  out: Finding[],
): void {
  if (value === null || isSentinel(value)) return; // unset, or only known at runtime
  const isNumber = typeof value === "number";
  const tokens = isNumber ? [String(value)] : splitSpace(value);

  if (entry.status === "partial" && entry.values) {
    const rejected = tokens.filter((t) => !tokenAccepted(t, isNumber, entry.values as string[]));
    if (rejected.length) {
      out.push({
        kind: "value",
        status: "partial",
        property,
        conditions,
        value,
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
      if (fn === UNKNOWN) continue;
      if (fn.status === "unsupported" || fn.status === "web-only" || fn.status === "partial") {
        out.push({
          kind: "function",
          status: fn.status,
          property,
          conditions,
          value,
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
          value,
          message: `${property}: unit "${length.unit}" — ${unit.note ?? "not supported on React Native"}`,
        });
      }
    }
  }
}

const MEDIA_FEATURE = /\(\s*([a-z-]+)\s*(?::|\)|>=|<=|>|<)/gi;

function checkCondition(
  property: string,
  condition: string,
  conditions: readonly string[],
  out: Finding[],
): void {
  if (condition === "default") return;
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
  out: Finding[],
): void {
  if (!isConditional(value)) {
    checkLeaf(property, entry, value, conditions, out);
    return;
  }
  for (const [condition, branch] of Object.entries(value)) {
    const chain = [...conditions, condition];
    checkCondition(property, condition, chain, out);
    walk(property, entry, branch, chain, out);
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
    walk(property, entry, value, [], out);
  }
  return out;
}

/** Findings that should fail a strict build. */
export function isBlocking(finding: Finding): boolean {
  return finding.status === "unsupported";
}
