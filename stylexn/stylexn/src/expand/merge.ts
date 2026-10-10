import type { Expanded, Value } from "./types.ts";

/**
 * Mirrors StyleX's `styleResolution` option.
 * - `property-specificity` (StyleX's default, and how React Native/Yoga
 *   behave): a value written as a longhand beats one that came from a
 *   shorthand, whatever the order; ties go to the last one applied.
 * - `application-order`: last one applied wins, like inline styles.
 */
export type StyleResolution = "property-specificity" | "application-order";

/**
 * Merge expanded rules in application order. Conditional values are merged
 * whole per property (as StyleX does), not per condition. A winning `null`
 * removes the property.
 */
export function mergeExpanded(
  rules: readonly (Expanded | null | undefined | false)[],
  resolution: StyleResolution = "property-specificity",
): Expanded {
  const style: Record<string, Value> = {};
  const depth: Record<string, number> = {};

  for (const rule of rules) {
    if (!rule) continue;
    for (const [key, value] of Object.entries(rule.style)) {
      const incoming = rule.depth[key] ?? 0;
      if (resolution === "property-specificity" && key in style && incoming > (depth[key] ?? 0)) {
        continue; // a more specific declaration already applies
      }
      style[key] = value;
      depth[key] = incoming;
    }
  }

  for (const key of Object.keys(style)) {
    if (style[key] === null) {
      delete style[key];
      delete depth[key];
    }
  }
  return { style, depth };
}
