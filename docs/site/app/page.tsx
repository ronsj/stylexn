import { PressCard } from "@stylexn/shared";
import { Example } from "./_components/Example";
import { A, Code, PageHeader, P, Section, Table, Ul } from "./_components/ui";

export default function Introduction() {
  return (
    <>
      <PageHeader
        title="StyleXN"
        lead={
          <>
            Author styles with the StyleX API and render them on React Native. The web keeps the
            real StyleX compiler; native gets a runtime that evaluates the same rules against device
            state.
          </>
        }
      />
      <Example name="PressCard">
        <PressCard />
      </Example>

      <Section id="one-code" title="One code, two platforms">
        <P>
          A component written with <Code>stylex.create</Code> and the elements from{" "}
          <Code>stylexn/elements</Code> is one file for both platforms. The card above is such a
          file: on this page StyleX compiled it to atomic CSS, and in an Expo app{" "}
          <Code>stylexn/babel</Code> compiles the same rules to style objects plus the conditions
          they depend on, which the runtime resolves as the window, the colour scheme or the press
          state change.
        </P>
        <Table
          head={["", "Web", "React Native"]}
          rows={[
            [<Code key="i">stylexn</Code>, "StyleX itself", "The StyleXN runtime"],
            [
              <Code key="e">stylexn/elements</Code>,
              "DOM elements with React Native's layout defaults",
              "React Native primitives",
            ],
            [
              "Build step",
              <>
                <Code>stylexn/babel</Code> (web mode), then <Code>@stylexjs/babel-plugin</Code>
              </>,
              <>
                <Code>stylexn/babel</Code> (native mode) in Metro
              </>,
            ],
            [
              "Conditions",
              "CSS: pseudo-classes and media queries",
              "Evaluated at runtime: press, hover and focus state, window size, colour scheme, reduced motion",
            ],
            ["Variables", "CSS custom properties", "React context"],
            ["Motion", "CSS transitions and animations", "React Native's Animated"],
          ]}
        />
        <P>
          This site is written the same way. Its layout is <Code>View</Code> and <Code>Text</Code>{" "}
          from <Code>stylexn/elements</Code>, and its own styles go through{" "}
          <Code>stylex.create</Code> from <Code>stylexn</Code>, so the types that guard shared code
          guard the site too; the few CSS-only declarations it needs, such as{" "}
          <Code>position: &quot;sticky&quot;</Code> for the navigation, sit in{" "}
          <Code>stylex.web({"{ }"})</Code>.
        </P>
      </Section>

      <Section id="checks" title="One compatibility table, four checks">
        <P>
          Not every CSS feature has a React Native equivalent. StyleXN keeps one table of what each
          property, condition, unit and function does on native, and four layers read it: the
          TypeScript types, a lint rule, the Babel plugin and the runtime. A style that cannot work
          on a phone is an editor error first, a lint error at commit time and a build error in CI,
          instead of a silent difference on the device.
        </P>
      </Section>

      <Section id="next" title="Where to go next">
        <Ul>
          <li>
            <A href="/getting-started/">Getting started</A>: install, configure Babel for web and
            native, write a first component.
          </li>
          <li>
            <A href="/styles/">Authoring styles</A>: conditions, units, variables and themes,
            motion, and the escape hatches for platform-only styles.
          </li>
          <li>
            <A href="/elements/">Elements</A>: <Code>View</Code>, <Code>Text</Code>,{" "}
            <Code>Pressable</Code> and the rest, with their props.
          </li>
          <li>
            <A href="/checking/">Checking styles</A> and the{" "}
            <A href="/compatibility/">compatibility reference</A>.
          </li>
          <li>
            <A href="/testing/">Testing</A> native components in Vitest, and end to end with
            Maestro.
          </li>
        </Ul>
        <P>
          StyleXN is at 0.x: the API follows StyleX, and native behaviour is documented property by
          property in the compatibility reference.
        </P>
      </Section>
    </>
  );
}
