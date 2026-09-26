#!/usr/bin/env node
import { parseArgs } from "node:util";
import type { RNVersion } from "../compat/types.ts";
import { checkFiles, formatProblem } from "./check.ts";

const USAGE = `Usage: stylexn check [options] <file>...

Report styles in stylex.create() that do not work on React Native.

Options:
  --rn-version <major.minor>  React Native version to check against
  --report-web-only           Also warn about web-only declarations
  --strict                    Treat warnings as errors
  --quiet                     Print errors only
  -h, --help                  Show this help
`;

function main(argv: readonly string[]): number {
  const [command, ...rest] = argv;
  if (command === "-h" || command === "--help" || command === undefined) {
    process.stdout.write(USAGE);
    return command === undefined ? 1 : 0;
  }
  if (command !== "check") {
    process.stderr.write(`Unknown command "${command}"\n\n${USAGE}`);
    return 1;
  }
  const { values, positionals } = parseArgs({
    args: [...rest],
    allowPositionals: true,
    options: {
      "rn-version": { type: "string" },
      "report-web-only": { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
      quiet: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (positionals.length === 0) {
    process.stderr.write(`No files given.\n\n${USAGE}`);
    return 1;
  }
  const problems = checkFiles(positionals, {
    rnVersion: values["rn-version"] as RNVersion | undefined,
    reportWebOnly: values["report-web-only"],
  });
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  for (const p of problems) {
    if (values.quiet && p.severity !== "error") continue;
    process.stdout.write(`${formatProblem(p)}\n`);
  }
  if (problems.length) {
    process.stdout.write(
      `\n${errors} error(s), ${warnings} warning(s) in ${positionals.length} file(s)\n`,
    );
  }
  return errors > 0 || (values.strict && warnings > 0) ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
