// Packs the package the way `pnpm publish` would and checks that the
// tarball has what the published `exports` point at, and nothing from src.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "stylexn-pack-"));
try {
  execFileSync("pnpm", ["pack", "--pack-destination", dir], { stdio: "pipe" });
  const tarball = execFileSync("ls", [dir], { encoding: "utf8" }).trim();
  const files = execFileSync("tar", ["-tzf", join(dir, tarball)], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((f) => f.replace(/^package\//, ""));
  execFileSync("tar", ["-xzf", join(dir, tarball), "-C", dir, "package/package.json"]);
  const pkg = JSON.parse(readFileSync(join(dir, "package/package.json"), "utf8"));

  const problems = [];
  const expectPath = (p) => {
    if (!files.includes(p)) problems.push(`missing from tarball: ${p}`);
  };
  const walk = (value) => {
    if (typeof value === "string") expectPath(value.replace(/^\.\//, ""));
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(pkg.exports);
  walk(pkg.bin);
  if (JSON.stringify(pkg.exports).includes("./src/")) problems.push("exports still point at src");
  if (files.some((f) => f.startsWith("src/"))) problems.push("src is included in the tarball");
  for (const f of ["README.md", "dist/elements.css", "dist/runtime/index.d.ts"]) expectPath(f);

  if (problems.length) {
    console.error(problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }

  // Install the tarball for a pretend consumer (peers resolve from this
  // package's node_modules) and type-check against both export conditions,
  // then load the entries Node can run.
  const consumer = join(process.cwd(), "node_modules/.pack-check/consumer");
  rmSync(consumer, { recursive: true, force: true });
  mkdirSync(join(consumer, "node_modules/stylexn"), { recursive: true });
  // Its own package scope: without this, TypeScript would resolve "stylexn"
  // as a self-reference of the workspace package (through its src exports).
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", type: "module" }),
  );
  execFileSync("tar", [
    "-xzf",
    join(dir, tarball),
    "-C",
    join(consumer, "node_modules/stylexn"),
    "--strip-components",
    "1",
  ]);
  writeFileSync(
    join(consumer, "consumer.tsx"),
    `import * as stylex from "stylexn";
import { keyframes } from "stylexn";
import { Pressable, ScrollView, Text, TextInput, View } from "stylexn/elements";
import { lookupProperty } from "stylexn/compiler";
import { styleOf } from "stylexn/testing/react-native";
const fade = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const styles = stylex.create({
  a: { padding: 8, color: { default: "red", ":hover": "blue" }, animationName: fade },
});
export function C() {
  return (
    <ScrollView sx={styles.a}>
      <View sx={styles.a}><Text>hi</Text></View>
      <TextInput keyboardType="email-address" onChangeText={(t) => t} />
      <Pressable onPress={() => {}} aria-label="go"><Text>go</Text></Pressable>
    </ScrollView>
  );
}
export const entry = lookupProperty("float").status;
export const read = styleOf;
// @ts-expect-error float has no native behaviour
export const bad = stylex.create({ b: { float: "left" } });
`,
  );
  for (const condition of ["default", "react-native"]) {
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "bundler",
          target: "ES2022",
          lib: ["ES2023", "DOM"],
          types: ["react"],
          customConditions: condition === "default" ? [] : [condition],
        },
        files: ["consumer.tsx"],
      }),
    );
    execFileSync("npx", ["tsc", "-p", join(consumer, "tsconfig.json")], { stdio: "inherit" });
    console.log(`stylexn: consumer type-checks with the "${condition}" condition`);
  }
  writeFileSync(
    join(consumer, "load.mjs"),
    `import * as web from "stylexn";
import * as elements from "stylexn/elements";
import * as compiler from "stylexn/compiler";
import * as babel from "stylexn/babel";
import * as check from "stylexn/check";
import * as lint from "stylexn/eslint-plugin";
for (const [name, mod] of Object.entries({ web, elements, compiler, babel, check, lint })) {
  if (!mod || Object.keys(mod).length === 0) throw new Error(name + " is empty");
}
console.log("stylexn: entries load: " + Object.keys({ web, elements, compiler, babel, check, lint }).join(", "));
`,
  );
  execFileSync("node", [join(consumer, "load.mjs")], { stdio: "inherit" });
  console.log(`stylexn: ${tarball} ok (${files.length} files)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
