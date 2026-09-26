import { StripedList } from "@stylexn/shared";
import type { Metadata } from "next";
import { Example } from "../_components/Example";
import {
  A,
  Code,
  CodeBlock,
  H3,
  Note,
  OnThisPage,
  PageHeader,
  P,
  Section,
  Table,
  Ul,
} from "../_components/ui";
import { buildError, lintProblems, SAMPLE, SAMPLE_PATH, typeErrors } from "../_lib/diagnostics";
import { readRepoFile } from "../_lib/repo";

export const metadata: Metadata = { title: "Checking styles" };

// A dynamic style: the value is only known when the component renders.
const DYNAMIC = `const styles = stylex.create({
  bar: (width: string) => ({ width, height: 8 }),
});

<View sx={styles.bar("calc(100% - 1rem)")} />`;

export default function CheckingStyles() {
  const scripts = JSON.parse(readRepoFile("package.json")) as { scripts: Record<string, string> };
  return (
    <>
      <PageHeader
        title="Checking styles"
        lead="Every layer that sees a style checks it against the same compatibility table, from the editor to the running app, so a style that cannot work on React Native is reported where it is written."
      />
      <OnThisPage
        sections={[
          ["layers", "Four layers"],
          ["types", "Types"],
          ["lint", "Lint and CLI"],
          ["build", "Build"],
          ["runtime", "Runtime"],
          ["fixing", "Fixing what they report"],
        ]}
      />

      <Section id="layers" title="Four layers, one table">
        <Table
          head={["Layer", "Where", "Unsupported style", "Web-only style"]}
          rows={[
            ["Types", "Editor, typecheck", "Type error", "Accepted"],
            [
              "Lint",
              "Editor, pre-commit, CI",
              "Error",
              <>
                Warning with <Code>reportWebOnly</Code>
              </>,
            ],
            [
              "Build",
              <>
                <Code>stylexn/babel</Code> on native
              </>,
              "Error in strict mode, otherwise a warning and stripped",
              "Stripped",
            ],
            ["Runtime", "Development builds", "Warning once, value dropped", "Ignored"],
          ]}
        />
        <P>
          Each layer below shows what it prints for this file, which has one problem of each kind.
          The messages are produced by the tools themselves when this site is built.
        </P>
        <CodeBlock code={SAMPLE} caption={SAMPLE_PATH} />
      </Section>

      <Section id="types" title="Types">
        <P>
          Shared code imports StyleX as <Code>stylexn</Code>, whose <Code>create()</Code>,{" "}
          <Code>keyframes()</Code> and <Code>createTheme()</Code> types are narrowed from the table.
          Unsupported properties, values, function names, conditions, keyframe selectors and theme
          value kinds are red in the editor, on whichever platform the editor resolves:
        </P>
        <CodeBlock code={typeErrors().join("\n")} lang="text" />
        <P>
          Types are the fast first line, not the authority: they cannot see inside{" "}
          <Code>calc()</Code> or multi-part strings, or check values computed at runtime. The{" "}
          <Code>willChange</Code> line passes, because web-only styles are valid StyleX.
        </P>
      </Section>

      <Section id="lint" title="Lint and CLI">
        <P>
          The <Code>stylexn/compat</Code> rule from <Code>stylexn/eslint-plugin</Code> runs in
          ESLint 9 or in oxlint as a JS plugin, so the editor and a pre-commit hook see the same
          findings. <Code>stylexn check</Code> is the same core as a command for CI and whole trees:
        </P>
        <CodeBlock code={lintProblems().join("\n")} lang="text" />
        <Ul>
          <li>Unsupported properties, conditions and functions are errors.</li>
          <li>Values outside a partially supported property&apos;s list are warnings.</li>
          <li>
            With <Code>reportWebOnly</Code> (<Code>--report-web-only</Code>), web-only declarations
            outside <Code>web({"{ }"})</Code> are warnings too, and <Code>--strict</Code> makes
            every warning fail the run.
          </li>
        </Ul>
        <P>This repository runs the CLI over everything that runs on native, as CI does:</P>
        <CodeBlock code={`pnpm check:styles\n# ${scripts.scripts["check:styles"]}`} lang="sh" />
        <H3>The rule in oxlint</H3>
        <P>
          This repository enables the rule for the shared package and the mobile app, with web-only
          reporting on:
        </P>
        <CodeBlock code={readRepoFile(".oxlintrc.json")} lang="json" caption=".oxlintrc.json" />
      </Section>

      <Section id="build" title="Build">
        <P>
          <Code>stylexn/babel</Code> in native mode is the authority: it checks every rule it
          compiles. Web-only declarations are stripped silently. Unsupported ones fail the build in
          strict mode, which is on when <Code>CI</Code> is set or with the <Code>strict</Code>{" "}
          option; otherwise they are stripped with a warning.
        </P>
        <CodeBlock code={buildError()} lang="text" />
        <Note title="Partially supported values">
          Only unsupported styles stop the build. A value outside a partially supported
          property&apos;s list, like <Code>display: &quot;grid&quot;</Code> above, is reported by
          the types and the lint rule but compiled as written, so keep those checks in CI.
        </Note>
      </Section>

      <Section id="runtime" title="Runtime">
        <P>
          Some values are only known when a component renders: dynamic styles, variable values, math
          with relative units. The native runtime resolves them then, and a value it cannot use is
          dropped, with a warning printed once per value in development. It never throws.
        </P>
        <CodeBlock code={DYNAMIC} />
        <CodeBlock
          code="[stylexn] calc(100% - 16px): cannot add a percentage and a length (dropped)"
          lang="text"
        />
      </Section>

      <Section id="fixing" title="Fixing what they report">
        <Ul>
          <li>
            A web-only declaration you want on the web goes in <Code>web({"{ }"})</Code>; a native
            alternative goes before it, since later keys win. See{" "}
            <A href="/styles/#escape-hatches">escape hatches</A>.
          </li>
          <li>
            Percentages mixed with lengths need layout information React Native does not give
            styles. Use padding on the parent, or a fixed length.
          </li>
          <li>
            Structural pseudo-classes have no native equivalent; the component usually knows the
            index already. This list stripes its rows by index instead of <Code>:nth-child</Code>:
          </li>
        </Ul>
        <Example name="StripedList">
          <StripedList />
        </Example>
        <P>
          Inline ignores exist for the rare false positive:{" "}
          <Code>{"// oxlint-disable-next-line stylexn/compat"}</Code> for the lint rule and{" "}
          <Code>{"// stylexn-ignore"}</Code> for the CLI. Prefer the escape hatches, which say what
          is intended.
        </P>
      </Section>
    </>
  );
}
