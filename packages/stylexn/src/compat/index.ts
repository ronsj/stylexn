import {
  apis,
  atRules,
  functions,
  mediaFeatures,
  properties,
  pseudoClasses,
  pseudoElements,
  RN_TARGET,
  rnOnlyKeys,
  units,
} from "./table.ts";
import { SEVERITY } from "./types.ts";
import type { Entry, RNVersion, Status, Table } from "./types.ts";

export {
  apis,
  atRules,
  functions,
  mediaFeatures,
  properties,
  pseudoClasses,
  pseudoElements,
  units,
};
export { RN_TARGET, rnOnlyKeys };
export type { KnownProperty } from "./table.ts";
export type { Entry, Platform, RNVersion, Status, Table } from "./types.ts";
export { SEVERITY, STATUSES } from "./types.ts";

/** Returned for anything the table does not list. Strict builds reject it. */
export const UNKNOWN: Entry = {
  status: "unsupported",
  note: "Not in the StyleXN compatibility table.",
};

function lookup(table: Table, key: string): Entry {
  return table[key] ?? UNKNOWN;
}

/** Compatibility of a camelCase CSS property (`--*` covers custom properties). */
export function lookupProperty(name: string): Entry {
  if (name.startsWith("--")) return properties["--*"];
  return lookup(properties, name);
}

/** Compatibility of a `:pseudo-class` condition key. Arguments are ignored. */
export function lookupPseudoClass(selector: string): Entry {
  const bare = selector.replace(/\(.*$/, "");
  return lookup(pseudoClasses, bare);
}

/** Compatibility of a `::pseudo-element` condition key. */
export function lookupPseudoElement(selector: string): Entry {
  return lookup(pseudoElements, selector);
}

/** Compatibility of an at-rule condition key such as `@media (min-width: 800px)`. */
export function lookupAtRule(rule: string): Entry {
  const name = rule.match(/^@[a-z-]+/)?.[0];
  return name ? lookup(atRules, name) : UNKNOWN;
}

/** Compatibility of one media feature such as `min-width` or `prefers-color-scheme`. */
export function lookupMediaFeature(feature: string): Entry {
  return lookup(mediaFeatures, feature);
}

/** Compatibility of a unit suffix such as `rem`. Use `<number>` for unitless numbers. */
export function lookupUnit(unit: string): Entry {
  return lookup(units, unit);
}

/** Compatibility of a value function, given with parentheses: `calc()`. */
export function lookupFunction(name: string): Entry {
  return lookup(functions, name.endsWith("()") ? name : `${name}()`);
}

/** Compatibility of a StyleX API such as `createTheme`. */
export function lookupApi(name: string): Entry {
  return lookup(apis, name.replace(/^stylex\./, ""));
}

/** Whether `entry` is available on React Native `version` (default RN_TARGET). */
export function isAvailable(entry: Entry, version: RNVersion = RN_TARGET): boolean {
  if (entry.status === "unsupported") return false;
  if (!entry.since) return true;
  return compareVersions(version, entry.since) >= 0;
}

/** Worst status of several, by SEVERITY. */
export function worstStatus(statuses: readonly Status[]): Status {
  let worst: Status = "supported";
  for (const s of statuses) if (SEVERITY[s] > SEVERITY[worst]) worst = s;
  return worst;
}

export function compareVersions(a: RNVersion, b: RNVersion): number {
  const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
  const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}
