// Renders src/compat/table.ts to COMPATIBILITY.md so the table and the docs
// cannot drift: `--check` fails when the file on disk is not what the table
// renders to, and CI runs it.
//
//   node --experimental-strip-types scripts/compat-docs.ts          # write
//   node --experimental-strip-types scripts/compat-docs.ts --check  # verify
//
// The script imports the table as TypeScript (Node's type stripping), so it
// reads the source of truth directly and needs no build. The property
// groups come from the `// --- Section ---` comments in table.ts; every key
// must sit under one, and the script refuses to render otherwise.
//
// Tables are emitted in the shape oxfmt normalises to (padded columns), so
// the pre-commit formatter leaves the file alone.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  apis,
  atRules,
  functions,
  mediaFeatures,
  properties,
  pseudoClasses,
  pseudoElements,
  RN_TARGET,
  units,
} from "../src/compat/table.ts";
import { STATUSES } from "../src/compat/types.ts";
import type { Entry, Status, Table } from "../src/compat/types.ts";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const tablePath = join(packageDir, "src/compat/table.ts");
const outputPath = join(packageDir, "COMPATIBILITY.md");

const STATUS_MEANING: Readonly<Record<Status, string>> = {
  supported:
    "Maps directly to React Native, possibly under another style key or after compile-time shorthand expansion.",
  polyfilled: "StyleXN emulates it, at compile time or at runtime.",
  partial: "Only the listed values are accepted.",
  "web-only":
    "Valid on web, deliberately ignored on native. Not an error; `web({ })` marks it as intentional.",
  unsupported: "No reasonable native behaviour. An error in strict builds (`CI`).",
};

type Group = Readonly<{ title: string; keys: readonly string[] }>;
type Section = Readonly<{
  title: string;
  nameHeader: string;
  intro?: string;
  groups: readonly Group[];
}>;

/** The `// --- Title ---` groups of the `properties` object, in source order. */
function propertyGroups(source: string): Group[] {
  const start = source.indexOf("export const properties = {");
  const end = source.indexOf("} as const satisfies Table;", start);
  if (start < 0 || end < 0) throw new Error("compat-docs: cannot find `properties` in table.ts");
  const groups: { title: string; keys: string[] }[] = [];
  for (const line of source.slice(start, end).split("\n")) {
    const header = line.match(/^ {2}\/\/ --- (.+?) -+$/);
    if (header?.[1]) {
      groups.push({ title: header[1], keys: [] });
      continue;
    }
    const key = line.match(/^ {2}(?:"([^"]+)"|([A-Za-z][A-Za-z0-9]*)):/);
    const name = key?.[1] ?? key?.[2];
    if (!name) continue;
    const group = groups.at(-1);
    if (!group) throw new Error(`compat-docs: property ${name} is above the first section comment`);
    group.keys.push(name);
  }
  const parsed = new Set(groups.flatMap((g) => g.keys));
  const actual = Object.keys(properties);
  const missing = actual.filter((k) => !parsed.has(k));
  const extra = [...parsed].filter((k) => !(k in properties));
  if (missing.length || extra.length || parsed.size !== actual.length) {
    throw new Error(
      `compat-docs: property sections do not match the table (missing: ${missing.join(", ") || "none"}; unknown: ${extra.join(", ") || "none"})`,
    );
  }
  return groups;
}

const code = (s: string) => `\`${s}\``;
const list = (items: readonly string[]) => items.map(code).join(", ");
const cell = (s: string) => s.replace(/\|/g, "\\|");

function notes(entry: Entry): string {
  const parts: string[] = [];
  // Component and token names such as <TextInput> or <length> would be read
  // as HTML tags by Markdown renderers; show them as code.
  if (entry.note) parts.push(entry.note.replace(/<[^>`]+>/g, (tag) => code(tag)));
  if (entry.values) parts.push(`Values: ${list(entry.values)}.`);
  if (entry.native) parts.push(`React Native key: ${code(entry.native)}.`);
  if (entry.prop) parts.push(`Prop: ${code(entry.prop)}.`);
  if (entry.expandsTo) parts.push(`Expands to ${list(entry.expandsTo)}.`);
  if (entry.ref) parts.push(`See ${entry.ref}.`);
  return parts.join(" ");
}

/** A Markdown table with columns padded the way oxfmt/prettier pad them. */
function renderTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const all = [headers, ...rows].map((r) => r.map(cell));
  const widths = headers.map((_, i) => Math.max(3, ...all.map((r) => r[i]?.length ?? 0)));
  const line = (r: readonly string[]) =>
    `| ${r.map((c, i) => c.padEnd(widths[i] ?? 0)).join(" | ")} |`;
  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;
  return [line(all[0] ?? []), separator, ...all.slice(1).map(line)].join("\n");
}

function renderGroup(table: Table, group: Group, nameHeader: string): string {
  const entries = group.keys.map((key) => {
    const entry = table[key];
    if (!entry) throw new Error(`compat-docs: no entry for ${key}`);
    return [key, entry] as const;
  });
  const hasSince = entries.some(([, e]) => e.since);
  const hasPlatform = entries.some(([, e]) => e.platform);
  const headers = [
    nameHeader,
    "Status",
    ...(hasSince ? ["Since"] : []),
    ...(hasPlatform ? ["Platform"] : []),
    "Notes",
  ];
  const rows = entries.map(([key, e]) => [
    code(key),
    e.status,
    ...(hasSince ? [e.since ?? ""] : []),
    ...(hasPlatform ? [e.platform ?? ""] : []),
    notes(e),
  ]);
  return renderTable(headers, rows);
}

function counts(table: Table): Record<Status, number> {
  const result = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const entry of Object.values(table)) result[entry.status] += 1;
  return result;
}

const single = (table: Table, title: string): Group[] => [{ title, keys: Object.keys(table) }];

export function render(): string {
  const source = readFileSync(tablePath, "utf8");
  const sections: readonly (Section & { table: Table })[] = [
    {
      title: "Properties",
      nameHeader: "Property",
      table: properties,
      intro:
        "Keys are camelCase CSS property names, as written in `stylex.create`. Custom properties (`--*`) share one entry.",
      groups: propertyGroups(source),
    },
    {
      title: "Pseudo-classes",
      nameHeader: "Pseudo-class",
      table: pseudoClasses,
      intro: 'As StyleX condition keys, for example `{ default: 1, ":hover": 0.8 }`.',
      groups: single(pseudoClasses, "Pseudo-classes"),
    },
    {
      title: "Pseudo-elements",
      nameHeader: "Pseudo-element",
      table: pseudoElements,
      groups: single(pseudoElements, "Pseudo-elements"),
    },
    {
      title: "At-rules",
      nameHeader: "At-rule",
      table: atRules,
      intro: 'As StyleX condition keys, for example `"@media (min-width: 800px)"`.',
      groups: single(atRules, "At-rules"),
    },
    {
      title: "Media features",
      nameHeader: "Feature",
      table: mediaFeatures,
      intro: "How each feature inside `@media` is evaluated on native.",
      groups: single(mediaFeatures, "Media features"),
    },
    {
      title: "Units",
      nameHeader: "Unit",
      table: units,
      intro: "`<number>` is a unitless number.",
      groups: single(units, "Units"),
    },
    {
      title: "Functions",
      nameHeader: "Function",
      table: functions,
      intro: "Value functions inside strings, such as `calc()` or `linear-gradient()`.",
      groups: single(functions, "Functions"),
    },
    {
      title: "StyleX API",
      nameHeader: "API",
      table: apis,
      intro: "The `stylex.*` functions themselves.",
      groups: single(apis, "StyleX API"),
    },
  ];

  const out: string[] = [];
  const relTable = relative(packageDir, tablePath);
  out.push(
    "# StyleXN compatibility",
    "",
    `<!-- Generated from ${relTable} by scripts/compat-docs.ts. Do not edit by hand: run \`pnpm compat:docs\`. -->`,
    "",
    `What StyleX styles do when StyleXN renders them on React Native. The target is React Native **${RN_TARGET}**; a **Since** version marks behaviour that needs at least that React Native, and \`stylexn check --rn-version\` and the Babel plugin evaluate entries against the installed version.`,
    "",
    `This file is rendered from \`${relTable}\`, the table that the types, the lint rule, the Babel plugin and the runtime all read, so the documentation and the tooling cannot disagree.`,
    "",
    "## Statuses",
    "",
    renderTable(
      ["Status", "Meaning"],
      STATUSES.map((s) => [code(s), STATUS_MEANING[s]]),
    ),
    "",
    "## Summary",
    "",
    renderTable(
      ["Table", "Entries", ...STATUSES],
      sections.map((s) => {
        const c = counts(s.table);
        return [
          s.title,
          String(Object.keys(s.table).length),
          ...STATUSES.map((status) => String(c[status])),
        ];
      }),
    ),
  );

  for (const section of sections) {
    out.push("", `## ${section.title}`);
    if (section.intro) out.push("", section.intro);
    for (const group of section.groups) {
      if (section.groups.length > 1) out.push("", `### ${group.title}`);
      out.push("", renderGroup(section.table, group, section.nameHeader));
    }
  }
  return `${out.join("\n")}\n`;
}

function main(argv: readonly string[]): number {
  const check = argv.includes("--check");
  const rendered = render();
  const rel = relative(process.cwd(), outputPath);
  let current: string | undefined;
  try {
    current = readFileSync(outputPath, "utf8");
  } catch {
    current = undefined;
  }
  if (current === rendered) {
    console.log(`stylexn: ${rel} is up to date`);
    return 0;
  }
  if (check) {
    console.error(
      `stylexn: ${rel} is stale. Run \`pnpm --filter stylexn compat:docs\` and commit the result.`,
    );
    return 1;
  }
  writeFileSync(outputPath, rendered);
  console.log(`stylexn: wrote ${rel}`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
