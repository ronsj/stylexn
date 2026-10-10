import { VisibilityToggle } from "@stylexn/shared";
import type { Metadata } from "next";
import { Example } from "../_components/Example";
import { Markdown } from "../_components/Markdown";
import { Code, OnThisPage, PageHeader, P } from "../_components/ui";
import { parseMarkdown } from "../_lib/markdown";
import { readRepoFile } from "../_lib/repo";

export const metadata: Metadata = { title: "Compatibility" };

const SOURCE = "stylexn/stylexn/COMPATIBILITY.md";

export default function Compatibility() {
  const blocks = parseMarkdown(readRepoFile(SOURCE));
  const sections = blocks.flatMap((block) =>
    block.type === "heading" && block.depth === 2 ? [[block.id, block.text] as const] : [],
  );
  // The live example goes after the status legend, before the summary.
  const split = blocks.findIndex((block) => block.type === "heading" && block.text === "Summary");
  return (
    <>
      <PageHeader
        title="Compatibility"
        lead={
          <>
            What every StyleX property, condition, unit, function and API does when StyleXN renders
            it on React Native. This page is <Code>{SOURCE}</Code>, read when the site is built.
          </>
        }
      />
      <OnThisPage sections={sections} />
      <Markdown blocks={blocks.slice(0, split)} />
      <P>
        A <Code>polyfilled</Code> property in practice: React Native has no <Code>visibility</Code>,
        so StyleXN renders <Code>hidden</Code> as zero opacity without pointer events. As on the
        web, the hidden box keeps its space:
      </P>
      <Example name="VisibilityToggle">
        <VisibilityToggle />
      </Example>
      <Markdown blocks={blocks.slice(split)} />
    </>
  );
}
