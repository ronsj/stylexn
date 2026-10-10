/**
 * Compatibility status of one StyleX/CSS feature on React Native.
 *
 * - `supported`   maps directly to React Native (possibly under another key,
 *                 see `native`, or after compile-time shorthand expansion).
 * - `polyfilled`  StyleXN emulates it, at compile time or at runtime.
 * - `partial`     only the listed `values` are accepted.
 * - `web-only`    valid on web, deliberately ignored on native. Not an error.
 * - `unsupported` no reasonable native behavior. Error in strict builds.
 */
export type Status = "supported" | "polyfilled" | "partial" | "web-only" | "unsupported";

/** "major.minor" React Native version. */
export type RNVersion = `${number}.${number}`;

export type Platform = "ios" | "android";

export type Entry = Readonly<{
  status: Status;
  /**
   * Accepted values for `partial` entries. Plain keywords, function names
   * (for `transform`/`filter`), or `<token>` patterns such as `<length>`.
   */
  values?: readonly string[];
  /** Why the status is what it is. Required unless `status` is `supported`. */
  note?: string;
  /** First React Native version with this behavior, when known. */
  since?: RNVersion;
  /** Only on this platform; the other platform ignores the value. */
  platform?: Platform;
  /** React Native style key this CSS property is renamed to at compile time. */
  native?: string;
  /** The value becomes a component prop with this name instead of a style. */
  prop?: string;
  /** Longhands this shorthand is expanded into at compile time. */
  expandsTo?: readonly string[];
  /** Tracking issue or reference. */
  ref?: string;
}>;

export type Table = Readonly<Record<string, Entry>>;

/** Higher is worse. Used to pick the most severe status for a rule. */
export const SEVERITY: Readonly<Record<Status, number>> = {
  supported: 0,
  polyfilled: 1,
  partial: 2,
  "web-only": 3,
  unsupported: 4,
};

export const STATUSES = Object.keys(SEVERITY) as readonly Status[];
