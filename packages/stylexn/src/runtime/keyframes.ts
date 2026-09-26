/**
 * `stylex.keyframes` on native: frames are compiled like rules (by
 * stylexn/babel, or here as a fallback) and registered under a name, which
 * is what `animationName` carries at runtime.
 *
 * The name is the `id` injected by stylexn/babel (a hash of file and export
 * name, as for `defineVars`). It keeps names stable across Fast Refresh:
 * re-running a keyframes module re-registers the same name with the new
 * frames, so rules in other modules that still hold the old name animate
 * with the reloaded frames on their next run. Without the plugin a
 * process-level counter names the frames.
 */
import { compileRule } from "../compile/compile.ts";
import type { CompiledRule } from "../compile/compile.ts";
import type { Declarations } from "../expand/types.ts";
import { isCompiledRule } from "./types.ts";

export type Keyframe = Readonly<{ offset: number; rule: CompiledRule }>;
export type Keyframes = Readonly<{ name: string; frames: readonly Keyframe[] }>;

const registry = new Map<string, Keyframes>();
let counter = 0;

/** `from`, `to`, `50%`, or a comma list of those. */
function offsets(selector: string): number[] {
  return selector.split(",").map((s) => {
    const t = s.trim().toLowerCase();
    if (t === "from") return 0;
    if (t === "to") return 1;
    const pct = t.match(/^(\d*\.?\d+)%$/);
    return pct ? Math.min(1, Math.max(0, Number(pct[1]) / 100)) : NaN;
  });
}

export function keyframes(
  frames: Record<string, Declarations | CompiledRule>,
  id?: string,
): string {
  const name = id ?? `stylexn-keyframes-${++counter}`;
  const out: Keyframe[] = [];
  for (const [selector, frame] of Object.entries(frames)) {
    const rule = isCompiledRule(frame) ? frame : compileRule(frame as Declarations).rule;
    for (const offset of offsets(selector)) {
      if (Number.isNaN(offset)) {
        console.warn(`[stylexn] keyframes: unknown selector "${selector}"`);
        continue;
      }
      out.push({ offset, rule });
    }
  }
  out.sort((a, b) => a.offset - b.offset);
  registry.set(name, { name, frames: out });
  return name;
}

export function getKeyframes(name: string): Keyframes | undefined {
  return registry.get(name);
}

/** Test hook. */
export function resetKeyframesForTesting(): void {
  registry.clear();
  counter = 0;
}
