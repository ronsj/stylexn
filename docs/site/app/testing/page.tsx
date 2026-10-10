import { PressableCounter } from "@stylexn/shared";
import type { Metadata } from "next";
import { Example } from "../_components/Example";
import { A, Code, CodeBlock, OnThisPage, PageHeader, P, Section, Table } from "../_components/ui";
import { readRepoFile } from "../_lib/repo";

export const metadata: Metadata = { title: "Testing" };

const VITEST_CONFIG = "examples/todo-ios/vitest.config.ts";
const COUNTER_TEST = "examples/todo-ios/PressableCounter.test.tsx";
const MAESTRO_FLOW = "examples/todo-ios/e2e/todo.yaml";

export default function Testing() {
  return (
    <>
      <PageHeader
        title="Testing"
        lead="Native components run in Vitest or Jest against StyleXN's React Native test double, and end to end with Maestro on a simulator."
      />
      <OnThisPage
        sections={[
          ["unit", "Unit tests"],
          ["example", "A component and its test"],
          ["maestro", "End to end with Maestro"],
          ["web", "On the web"],
        ]}
      />

      <Section id="unit" title="Unit tests on native">
        <P>
          <Code>stylexn/testing/react-native</Code> stands in for <Code>react-native</Code> in a
          jsdom test run. Alias <Code>react-native</Code> to it, resolve packages with the{" "}
          <Code>react-native</Code> export condition as Metro does, and run{" "}
          <Code>stylexn/babel</Code> in native mode over the test files. This repository&apos;s
          mobile app does it in its Vitest config:
        </P>
        <CodeBlock code={readRepoFile(VITEST_CONFIG)} lang="ts" caption={VITEST_CONFIG} />
        <P>
          The plugin that config uses, <Code>stylexnNativeTestPlugin</Code>, is a few lines around{" "}
          <Code>transformAsync</Code> with <Code>stylexn/babel</Code> in native mode; see{" "}
          <Code>vitest.shared.ts</Code> at the repository root. What the double provides:
        </P>
        <Table
          head={["Export", "What it does"]}
          rows={[
            [
              <Code key="p">View, Text, Pressable, …</Code>,
              "DOM elements that carry their resolved style and props as attributes. Presses, focus, text changes, submit and scroll are wired to the DOM events Testing Library fires.",
            ],
            [
              <Code key="s">styleOf(element), propsOf(element)</Code>,
              "The style and the other props an element received, as objects.",
            ],
            [
              <Code key="w">setWindow(), setColorScheme(), setAccessibilityInfo()</Code>,
              "Change the window size, the colour scheme or an AccessibilityInfo setting; subscribed elements re-render.",
            ],
            [
              <Code key="e">testEnv, resetTestEnv()</Code>,
              "The environment the mocked modules read (window, colour scheme, accessibility settings, platform), and a reset for between tests.",
            ],
            [
              <Code key="a">Animated, startedAnimations</Code>,
              "A fake Animated that records the animations it was asked to run instead of running them.",
            ],
          ]}
        />
      </Section>

      <Section id="example" title="A component and its test">
        <P>
          The counter from the <A href="/elements/#pressable">Pressable</A> section is a shared
          component; the mobile app&apos;s test suite renders it through the double:
        </P>
        <Example name="PressableCounter">
          <PressableCounter />
        </Example>
        <CodeBlock code={readRepoFile(COUNTER_TEST)} lang="tsx" caption={COUNTER_TEST} />
      </Section>

      <Section id="maestro" title="End to end with Maestro">
        <P>
          A Maestro flow drives the real app in Expo Go on a simulator or emulator, through the{" "}
          <Code>exp://</Code> deep link, so no native build is needed. Start Metro in the app (
          <Code>pnpm exec expo start</Code>), boot a simulator, then run the flow:
        </P>
        <CodeBlock code={readRepoFile(MAESTRO_FLOW)} lang="yaml" caption={MAESTRO_FLOW} />
        <CodeBlock code="pnpm --filter @stylexn/todo-ios test:e2e" lang="sh" />
        <P>
          The flow is not part of CI yet: it needs a booted simulator. Unit tests are where most
          checking happens; Maestro catches what only a device shows, such as a crash when two
          animation drivers meet on one view.
        </P>
      </Section>

      <Section id="web" title="On the web">
        <P>
          Web tests use the real StyleX compiler, so unit tests assert against compiled class names,
          and Playwright checks computed styles in a browser. This site has a Playwright smoke test
          that opens every page and checks that a live example rendered with StyleX classes.
        </P>
      </Section>
    </>
  );
}
