import { FirstCard } from "@stylexn/shared";
import type { Metadata } from "next";
import { Example } from "../_components/Example";
import { A, Code, CodeBlock, H3, OnThisPage, PageHeader, P, Section } from "../_components/ui";
import { codeUnder, parseMarkdown } from "../_lib/markdown";
import { readRepoFile } from "../_lib/repo";

export const metadata: Metadata = { title: "Getting started" };

/** The README's snippets, so this page and the README cannot drift apart. */
function readmeSnippets() {
  const readme = parseMarkdown(readRepoFile("packages/stylexn/README.md"));
  const [install] = codeUnder(readme, "Install");
  const [babelNative, metro] = codeUnder(readme, "React Native (Expo / Metro)");
  const [babelWeb, css] = codeUnder(readme, "Web (Next.js or any StyleX setup)");
  if (!install || !babelNative || !metro || !babelWeb || !css) {
    throw new Error("docs-site: the README no longer has the expected install snippets");
  }
  return { install, babelNative, metro, babelWeb, css };
}

export default function GettingStarted() {
  const s = readmeSnippets();
  return (
    <>
      <PageHeader
        title="Getting started"
        lead="Install the package, add the Babel plugin to each platform's build, and write a component that runs on both."
      />
      <OnThisPage
        sections={[
          ["install", "Install"],
          ["native", "React Native"],
          ["web", "Web"],
          ["first-component", "A first component"],
        ]}
      />

      <Section id="install" title="Install">
        <CodeBlock code={s.install.code} lang={s.install.lang} />
        <P>
          <Code>react</Code> and <Code>react-native</Code> are peer dependencies;{" "}
          <Code>@babel/core</Code> is needed where the Babel plugin runs.
        </P>
      </Section>

      <Section id="native" title="React Native (Expo / Metro)">
        <P>
          Add <Code>stylexn/babel</Code> in native mode to the app&apos;s Babel config:
        </P>
        <CodeBlock code={s.babelNative.code} lang={s.babelNative.lang} caption="babel.config.js" />
        <P>
          The plugin compiles <Code>stylex.create</Code>, <Code>stylex.keyframes</Code> and{" "}
          <Code>defineVars</Code>, checks every style against the compatibility table (errors when{" "}
          <Code>CI</Code> is set, warnings otherwise), gives variable groups and keyframes ids that
          survive Fast Refresh, and reads the React Native version from the installed{" "}
          <Code>react-native</Code> package.
        </P>
        <P>
          <Code>stylexn</Code> resolves to the native runtime through the <Code>react-native</Code>{" "}
          export condition. Code that imports StyleX by its own name, <Code>@stylexjs/stylex</Code>,
          needs an alias in <Code>metro.config.js</Code>:
        </P>
        <CodeBlock code={s.metro.code} lang={s.metro.lang} caption="metro.config.js" />
      </Section>

      <Section id="web" title="Web (Next.js or any StyleX setup)">
        <P>
          Run <Code>stylexn/babel</Code> in web mode <strong>before</strong>{" "}
          <Code>@stylexjs/babel-plugin</Code>, and tell StyleX that <Code>stylexn</Code> is an
          import source:
        </P>
        <CodeBlock code={s.babelWeb.code} lang={s.babelWeb.lang} caption="babel.config.js" />
        <P>
          The web plugin inlines <Code>web({"{ }"})</Code> blocks and drops{" "}
          <Code>native({"{ }"})</Code> blocks, so StyleX sees plain style objects. Then import the
          elements&apos; stylesheet once, for example in the root layout. It gives <Code>View</Code>
          , <Code>Text</Code> and the other elements React Native&apos;s layout defaults on the web:
        </P>
        <CodeBlock code={s.css.code} lang={s.css.lang} />
        <H3 id="nextjs">A complete Next.js setup</H3>
        <P>
          This site is a Next.js app configured that way. Its Babel config also runs StyleX in dev
          mode during development, and its PostCSS config collects the CSS StyleX extracts, from the
          app and from the workspace package the examples live in:
        </P>
        <CodeBlock
          code={readRepoFile("apps/docs-site/babel.config.js")}
          lang="js"
          caption="apps/docs-site/babel.config.js"
        />
        <CodeBlock
          code={readRepoFile("apps/docs-site/postcss.config.js")}
          lang="js"
          caption="apps/docs-site/postcss.config.js"
        />
        <P>
          Packages that ship TypeScript source, as a monorepo&apos;s shared package usually does,
          also go in <Code>transpilePackages</Code> in <Code>next.config.ts</Code> so that Next
          compiles them with the same plugins.
        </P>
        <H3 id="server-components">React Server Components</H3>
        <P>
          <Code>stylexn/elements</Code> uses React hooks and is not marked as a client module, so
          Next.js refuses to import it into a Server Component, even for <Code>View</Code> or{" "}
          <Code>Text</Code>. Import the elements in files marked <Code>&quot;use client&quot;</Code>
          , as the examples on this site are. To use them from server components, re-export them
          from such a file; this site&apos;s pages do:
        </P>
        <CodeBlock
          code={readRepoFile("apps/docs-site/app/_components/elements.ts")}
          lang="ts"
          caption="apps/docs-site/app/_components/elements.ts"
        />
      </Section>

      <Section id="first-component" title="A first component">
        <P>
          Import StyleX as <Code>stylexn</Code> and the elements from <Code>stylexn/elements</Code>.
          The same file then compiles to CSS on the web and to the runtime on native. This is the
          card from the README:
        </P>
        <Example name="FirstCard">
          <FirstCard />
        </Example>
        <P>
          Next: <A href="/styles/">authoring styles</A> covers the conditions, units and variables
          the card uses, and what else works on both platforms.
        </P>
      </Section>
    </>
  );
}
