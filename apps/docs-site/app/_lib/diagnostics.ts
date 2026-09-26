/**
 * Runs StyleXN's checks over a sample file at build time, so the Checking
 * styles page shows the messages the tools print today rather than copies.
 */
import { dirname, join } from "node:path";
import { transformSync } from "@babel/core";
import { checkSource, formatProblem } from "stylexn/check";
import ts from "typescript";
import { REPO_ROOT } from "./repo";

/** A sample file with one problem of each kind; it lives nowhere on disk. */
export const SAMPLE_PATH = "packages/shared/src/Card.tsx";
export const SAMPLE = `import * as stylex from "stylexn";

const styles = stylex.create({
  card: {
    display: "grid",
    width: "calc(100% - 2rem)",
    willChange: "transform",
    color: { default: "black", ":nth-child(2)": "red" },
  },
});
`;

const samplePath = () => join(REPO_ROOT, SAMPLE_PATH);

/** Layer 1: TypeScript, with the shared package's compiler options. */
export function typeErrors(): string[] {
  const configPath = join(REPO_ROOT, "packages/shared/tsconfig.json");
  const config = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    },
  );
  if (!config) throw new Error("docs-site: cannot read packages/shared/tsconfig.json");
  const file = samplePath();
  const host = ts.createCompilerHost(config.options);
  const { getSourceFile, fileExists, readFile } = host;
  host.fileExists = (name) => name === file || fileExists(name);
  host.readFile = (name) => (name === file ? SAMPLE : readFile(name));
  host.getSourceFile = (name, version, ...rest) =>
    name === file
      ? ts.createSourceFile(name, SAMPLE, version, true)
      : getSourceFile(name, version, ...rest);
  const program = ts.createProgram([file], config.options, host);
  return ts.getPreEmitDiagnostics(program, program.getSourceFile(file)).map((d) => {
    const { line, character } = d.file?.getLineAndCharacterOfPosition(d.start ?? 0) ?? {
      line: 0,
      character: 0,
    };
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n  ");
    return `${SAMPLE_PATH}(${line + 1},${character + 1}): error TS${d.code}: ${message}`;
  });
}

/** Layer 2: the lint rule's core, as `stylexn check --report-web-only` runs it. */
export function lintProblems(): string[] {
  return checkSource(SAMPLE, samplePath(), { reportWebOnly: true }).map((problem) =>
    formatProblem({ ...problem, file: SAMPLE_PATH }),
  );
}

/** Layer 3: the Babel plugin in strict mode, as a CI build runs it for native. */
export function buildError(): string {
  try {
    transformSync(SAMPLE, {
      filename: samplePath(),
      cwd: dirname(samplePath()),
      babelrc: false,
      configFile: false,
      highlightCode: false,
      parserOpts: { plugins: ["typescript", "jsx"] },
      plugins: [["stylexn/babel", { platform: "native", strict: true }]],
    });
  } catch (error) {
    return (error as Error).message.replaceAll(`${REPO_ROOT}/`, "");
  }
  throw new Error("docs-site: the sample compiled without an error");
}
