/**
 * CSS `env()` on React Native. The four `safe-area-inset-*` variables become
 * references to a built-in variable group (`stylexn-env`) that
 * `SafeAreaInsetsProvider` (runtime/env-vars.ts) sets for its subtree, so
 * they resolve through the ordinary var() path, inside `calc()` too. Other
 * environment variables do not exist on native.
 */
import { splitComma } from "../expand/tokenize.ts";
import { mapFunctions } from "./fold.ts";

/** The id of the built-in variable group behind `env(safe-area-inset-*)`. */
export const ENV_GROUP = "stylexn-env";

/** CSS environment variable -> key in the `stylexn-env` group. */
export const ENV_VARIABLES: Readonly<Record<string, string>> = {
  "safe-area-inset-top": "safeAreaInsetTop",
  "safe-area-inset-right": "safeAreaInsetRight",
  "safe-area-inset-bottom": "safeAreaInsetBottom",
  "safe-area-inset-left": "safeAreaInsetLeft",
};

const ENV = /^env\(/i;
const ENV_ANYWHERE = /\benv\(/i;

export type EnvRewrite = Readonly<{
  /** The value with every known `env()` rewritten to `var()`. */
  value: string;
  /** Environment variable names with no native counterpart, left as written. */
  unknown: readonly string[];
}>;

/**
 * Rewrite `env(safe-area-inset-top)` to `var(--stylexn-env.safeAreaInsetTop)`
 * and `env(safe-area-inset-top, 12px)` to `var(--stylexn-env.safeAreaInsetTop, 12px)`,
 * anywhere in a value (nested in `calc()` and other functions as well).
 * Unknown names are left in place and listed.
 */
export function rewriteEnv(value: string): EnvRewrite {
  if (!ENV_ANYWHERE.test(value)) return { value, unknown: [] };
  const unknown: string[] = [];
  const rewritten = mapFunctions(value, (token) => {
    if (!ENV.test(token) || !token.endsWith(")")) return undefined;
    const [name = "", ...fallback] = splitComma(token.slice(token.indexOf("(") + 1, -1));
    const key = ENV_VARIABLES[name.trim()];
    if (!key) {
      unknown.push(name.trim());
      return token;
    }
    const inner = fallback.length ? rewriteEnv(fallback.join(", ")) : null;
    if (inner) unknown.push(...inner.unknown);
    return `var(--${ENV_GROUP}.${key}${inner ? `, ${inner.value}` : ""})`;
  });
  return { value: rewritten ?? value, unknown };
}
