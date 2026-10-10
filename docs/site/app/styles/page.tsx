import {
  AncestorPress,
  BadgeVariants,
  ColorFunctions,
  ColorSchemeCard,
  EscapeHatches,
  InteractionStates,
  KeyframesDemo,
  NestedConditions,
  ResponsiveRow,
  SafeAreaHeader,
  TextInheritance,
  ThemeDemo,
  TransitionDemo,
  UnitsDemo,
} from "@stylexn/shared";
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
  Ul,
} from "../_components/ui";
import { EXAMPLES_DIR, readRepoFile } from "../_lib/repo";

export const metadata: Metadata = { title: "Authoring styles" };

const SECTIONS = [
  ["rules", "Rules and variants"],
  ["conditions", "Conditions"],
  ["nested", "Nested conditions"],
  ["units", "Units"],
  ["functions", "Math and colour functions"],
  ["themes", "Variables and themes"],
  ["motion", "Transitions and keyframes"],
  ["escape-hatches", "Escape hatches"],
  ["text", "Text inheritance"],
] as const;

export default function AuthoringStyles() {
  return (
    <>
      <PageHeader
        title="Authoring styles"
        lead="StyleXN takes StyleX's authoring API as it is. This page covers what behaves the same on both platforms, and where React Native needs a hand."
      />
      <OnThisPage sections={SECTIONS} />

      <Section id="rules" title="Rules and variants">
        <P>
          <Code>stylex.create</Code> takes named rules, each a flat object of style properties.
          Elements take rules through <Code>sx</Code>: one rule, or an array in which falsy entries
          are skipped, so variants are plain conditions. Later rules win property by property, with
          StyleX&apos;s merge rules on both platforms (a longhand such as <Code>paddingTop</Code>{" "}
          beats the <Code>padding</Code> shorthand).
        </P>
        <Example name="BadgeVariants">
          <BadgeVariants />
        </Example>
        <P>
          Outside the elements, <Code>stylex.props()</Code> gives a DOM element its{" "}
          <Code>className</Code> on the web, and <Code>useProps()</Code> from <Code>stylexn</Code>{" "}
          gives any React Native component its <Code>style</Code> on native.
        </P>
      </Section>

      <Section id="conditions" title="Conditions">
        <P>
          Condition keys work as in StyleX. On native the runtime evaluates them, and an element
          subscribes only to the state its rules mention:
        </P>
        <Ul>
          <li>
            <Code>:hover</Code>, <Code>:active</Code>, <Code>:focus</Code>,{" "}
            <Code>:focus-visible</Code> (treated as <Code>:focus</Code> on native) and{" "}
            <Code>:disabled</Code> (from the <Code>disabled</Code> prop).
          </li>
          <li>
            Form states, from element props: <Code>:checked</Code> (a <Code>Switch</Code>&apos;s{" "}
            <Code>value</Code>), <Code>:placeholder-shown</Code> (a <Code>TextInput</Code> with a{" "}
            <Code>placeholder</Code> and no text), <Code>:read-only</Code> and{" "}
            <Code>:read-write</Code> (a <Code>TextInput</Code>&apos;s <Code>readOnly</Code> and{" "}
            <Code>disabled</Code> props; a <Code>Switch</Code> is always read-only, as on the web).
          </li>
          <li>
            <Code>@media</Code> with <Code>width</Code>, <Code>height</Code>,{" "}
            <Code>orientation</Code>, <Code>prefers-color-scheme</Code>,{" "}
            <Code>prefers-reduced-motion</Code>, <Code>prefers-contrast</Code>,{" "}
            <Code>prefers-reduced-transparency</Code>, <Code>inverted-colors</Code>,{" "}
            <Code>hover</Code> and <Code>pointer</Code>.
          </li>
          <li>
            <Code>::placeholder</Code> on a <Code>TextInput</Code>, which becomes the{" "}
            <Code>placeholderTextColor</Code> prop.
          </li>
          <li>
            Ancestor conditions: <Code>stylex.when.ancestor(&quot;:active&quot;, marker)</Code> as a
            key holds while the nearest element carrying <Code>marker</Code> (from{" "}
            <Code>defineMarker</Code>, or <Code>defaultMarker()</Code> when none is given) is in
            that state. On native the marked element publishes its interaction state to its
            descendants through context.
          </li>
        </Ul>
        <Example name="InteractionStates">
          <InteractionStates />
        </Example>
        <P>
          <Code>:hover</Code> needs a pointer, so it does not fire on a touch screen. Media queries
          read the window, not a container. The row below is a column until the window is 700px
          wide:
        </P>
        <Example name="ResponsiveRow">
          <ResponsiveRow />
        </Example>
        <P>The colour scheme is a media feature too. Switch your system to dark mode:</P>
        <Example name="ColorSchemeCard">
          <ColorSchemeCard />
        </Example>
        <P>
          A marker lets a child react to an ancestor&apos;s state. Like <Code>defineVars</Code>,{" "}
          <Code>defineMarker</Code> is a named export of a <Code>*.stylex.ts</Code> file:
        </P>
        <CodeBlock
          code={readRepoFile(`${EXAMPLES_DIR}/cardMarker.stylex.ts`)}
          lang="ts"
          caption={`${EXAMPLES_DIR}/cardMarker.stylex.ts`}
        />
        <P>
          Put the marker in the card&apos;s <Code>sx</Code>, and the text inside styles itself with{" "}
          <Code>stylex.when.ancestor</Code>:
        </P>
        <Example name="AncestorPress">
          <AncestorPress />
        </Example>
        <Note title="No structural or sibling selectors">
          <Code>:nth-child</Code>, <Code>:first-child</Code> and similar conditions need context
          React Native does not have, and so do <Code>when.descendant</Code> and the sibling
          conditions; <Code>when.ancestor</Code> is the one relational condition native supports.
          Pass the state to the style instead:{" "}
          <Code>sx={"{[styles.row, index % 2 === 1 && styles.odd]}"}</Code>. See{" "}
          <A href="/checking/">Checking styles</A> for the error they produce.
        </Note>
      </Section>

      <Section id="nested" title="Nested conditions">
        <P>
          Conditions nest, as in StyleX: a media query can hold its own pseudo-classes, and the more
          specific branch wins. Here the dark scheme has its own hover and pressed colours:
        </P>
        <Example name="NestedConditions">
          <NestedConditions />
        </Example>
      </Section>

      <Section id="units" title="Units">
        <P>
          Numbers are pixels on the web and density-independent pixels on native. Relative units
          resolve at runtime on native:
        </P>
        <Ul>
          <li>
            <Code>rem</Code> is 16px unless the app changes it with{" "}
            <Code>configure({"{ rootFontSize }"})</Code>.
          </li>
          <li>
            <Code>em</Code> is relative to the element&apos;s own font size, or the inherited one
            when it has none, as in CSS.
          </li>
          <li>
            <Code>vw</Code>, <Code>vh</Code>, <Code>vmin</Code> and <Code>vmax</Code> follow the
            window; the element re-renders when it is resized.
          </li>
          <li>
            <Code>lh</Code> is the line height of the same rule, resolved when the styles are
            compiled: the rule needs a static <Code>lineHeight</Code>. A unitless, percentage or{" "}
            <Code>em</Code> line height makes an <Code>em</Code> value, an absolute one a number.
          </li>
          <li>Percentages pass through to React Native&apos;s layout, which supports them.</li>
        </Ul>
        <Example name="UnitsDemo">
          <UnitsDemo />
        </Example>
        <H3>Safe areas</H3>
        <P>
          <Code>env(safe-area-inset-top)</Code> and its <Code>right</Code>, <Code>bottom</Code> and{" "}
          <Code>left</Code> siblings work on both platforms, also inside <Code>calc()</Code>. The
          browser supplies them on the web. On native, wrap the app in{" "}
          <Code>SafeAreaInsetsProvider</Code> with the insets from{" "}
          <Code>react-native-safe-area-context</Code>, inside its <Code>SafeAreaProvider</Code>:{" "}
          <Code>{"<SafeAreaInsetsProvider insets={useSafeAreaInsets()}>"}</Code>.
        </P>
        <P>
          Without a provider the insets are 0, as in a browser on a rectangular screen, so a
          fallback such as <Code>env(safe-area-inset-top, 12px)</Code> is not used on either
          platform; add a minimum with <Code>calc()</Code> or <Code>max()</Code> instead. Other
          environment variables (<Code>keyboard-inset-*</Code>, <Code>titlebar-area-*</Code>, …) do
          not exist on native and are reported.
        </P>
        <Example name="SafeAreaHeader">
          <SafeAreaHeader />
        </Example>
      </Section>

      <Section id="functions" title="Math and colour functions">
        <P>
          <Code>calc()</Code>, <Code>min()</Code>, <Code>max()</Code> and <Code>clamp()</Code> are
          folded to a number at build time when every operand is a number, an absolute length or a
          percentage. With relative units or variables they are kept and resolved at runtime, once
          the window, the font size or the variable is known. Adding a percentage to a length cannot
          be resolved without the layout pass, and is an error.
        </P>
        <P>
          Colour functions are converted to <Code>rgb()</Code> at build time: <Code>lab()</Code>,{" "}
          <Code>lch()</Code>, <Code>oklab()</Code>, <Code>oklch()</Code>, <Code>color()</Code> and{" "}
          <Code>color-mix()</Code>, clipped to sRGB. <Code>light-dark()</Code> becomes a{" "}
          <Code>prefers-color-scheme</Code> condition.
        </P>
        <Example name="ColorFunctions">
          <ColorFunctions />
        </Example>
        <Note title="light-dark() on the web">
          Browsers pick the <Code>light-dark()</Code> value from the <Code>color-scheme</Code>{" "}
          property, not from the media query. Set <Code>color-scheme: light dark</Code> on the root
          element, as this site does, so that both platforms follow the system setting.
        </Note>
      </Section>

      <Section id="themes" title="Variables and themes">
        <P>
          <Code>defineVars</Code> declares variables in a <Code>*.stylex.ts</Code> file, as named
          exports (a StyleX rule). A variable&apos;s value can itself be conditional, like the dark
          background below. On the web the variables are CSS custom properties; on native they
          resolve through React context, with ids that survive Fast Refresh.
        </P>
        <CodeBlock
          code={readRepoFile(`${EXAMPLES_DIR}/buttonTheme.stylex.ts`)}
          lang="ts"
          caption={`${EXAMPLES_DIR}/buttonTheme.stylex.ts`}
        />
        <P>
          <Code>createTheme</Code> gives the same variables new values. Put the theme in an
          element&apos;s <Code>sx</Code> and that element&apos;s styles read the new values:
        </P>
        <Example name="ThemeDemo">
          <ThemeDemo />
        </Example>
        <Note title="Themes and descendants">
          A theme in <Code>sx</Code> reaches everything inside the element on both platforms: on the
          web custom properties cascade, and on native the element wraps its children in a theme
          scope. To theme a subtree without an element of your own, or below a custom component
          styled with <Code>useProps</Code> (which does not wrap its children), use{" "}
          <Code>ThemeProvider</Code> from <Code>stylexn</Code>. The button above sets{" "}
          <Code>color</Code> on itself, so the resolved colour reaches its text through text
          inheritance on both platforms.
        </Note>
      </Section>

      <Section id="motion" title="Transitions and keyframes">
        <P>
          <Code>transition*</Code> and <Code>animation*</Code> properties run on React Native&apos;s{" "}
          <Code>Animated</Code>. A transition starts when a transitioned value changes, whether a
          condition changed it or new props did:
        </P>
        <Example name="TransitionDemo">
          <TransitionDemo />
        </Example>
        <P>
          <Code>stylex.keyframes</Code> works the same way; the frames are checked like any other
          rule. Easing keywords, <Code>cubic-bezier()</Code>, <Code>steps()</Code> and{" "}
          <Code>linear()</Code> are supported, and so are delays, iteration counts, directions, fill
          modes and <Code>animationPlayState</Code>.
        </P>
        <Example name="KeyframesDemo">
          <KeyframesDemo />
        </Example>
        <Ul>
          <li>
            Opacity, transforms, colours, radii and shadows run on Animated&apos;s native driver;
            layout properties such as <Code>width</Code> or margins stay on the JS driver.
          </li>
          <li>
            Transform lists interpolate part by part, so keep the same functions in every state (
            <Code>translateY(0px) scale(1)</Code> to <Code>translateY(-3px) scale(1)</Code>).
          </li>
          <li>
            With reduced motion on, native transitions jump to their end and animations rest at
            their final frame. On the web, add a <Code>prefers-reduced-motion</Code> condition, as
            the example does.
          </li>
        </Ul>
      </Section>

      <Section id="escape-hatches" title="Escape hatches">
        <P>
          Some styles only make sense on one platform. Say so explicitly instead of disabling a
          check: <Code>...web({"{ }"})</Code> holds declarations that only reach the web, and{" "}
          <Code>...native({"{ }"})</Code> holds declarations, including React Native-only keys such
          as <Code>elevation</Code>, that only reach native. Later keys win, so a native-friendly
          value followed by a <Code>web({"{ }"})</Code> override is the pattern for a fallback:
        </P>
        <Example name="EscapeHatches">
          <EscapeHatches />
        </Example>
        <P>
          Web-only declarations outside <Code>web({"{ }"})</Code> are reported by the lint rule and
          by <Code>stylexn check --report-web-only</Code>, so leaks are caught in review. Inline
          ignore comments exist but are discouraged.
        </P>
      </Section>

      <Section id="text" title="Text inheritance">
        <P>
          In CSS, text styles cascade from any element to the text inside it; in React Native they
          only pass between nested <Code>Text</Code>. StyleXN&apos;s <Code>View</Code> and{" "}
          <Code>Pressable</Code> pass <Code>color</Code>, the <Code>font*</Code> properties,{" "}
          <Code>lineHeight</Code>, <Code>letterSpacing</Code>, <Code>textAlign</Code>,{" "}
          <Code>textTransform</Code>, <Code>textShadow*</Code> and <Code>writingDirection</Code>{" "}
          down to their <Code>Text</Code>, so the same styles work on both platforms:
        </P>
        <Example name="TextInheritance">
          <TextInheritance />
        </Example>
        <H3>What does not inherit</H3>
        <P>
          <Code>TextInput</Code> stays outside the cascade, as inputs do on the web, where the
          browser gives them their own font and colour: style an input directly. A unitless{" "}
          <Code>lineHeight</Code> inherits as a multiplier, and <Code>em</Code> and percentage font
          sizes resolve against the inherited size, as in CSS.
        </P>
      </Section>
    </>
  );
}
