// Reads files from the monorepo at build time, so the pages show the real
// README snippets, example sources and generated docs instead of copies.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** The directory holding pnpm-workspace.yaml, searched upwards from the cwd. */
function findRepoRoot(from: string): string {
  let dir = resolve(from);
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`docs-site: no pnpm-workspace.yaml above ${from}`);
    dir = parent;
  }
  return dir;
}

export const REPO_ROOT = findRepoRoot(process.cwd());

/** A file's contents by its path from the repository root. */
export function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

export const EXAMPLES_DIR = "packages/shared/src/examples";

export const examplePath = (name: string) => `${EXAMPLES_DIR}/${name}.tsx`;
