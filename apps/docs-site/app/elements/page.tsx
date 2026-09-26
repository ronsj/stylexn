import {
  ChipScroller,
  EmailField,
  ImageCard,
  InfiniteList,
  PressableCounter,
  SettingsSwitches,
  TextBasics,
  ViewLayout,
} from "@stylexn/shared";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Example } from "../_components/Example";
import { PropsTable } from "../_components/PropsTable";
import { Code, H3, Note, OnThisPage, PageHeader, P, Section, Ul } from "../_components/ui";
import { commonProps, elementProps, handleMethods, typeDoc, unionValues } from "../_lib/props";

export const metadata: Metadata = { title: "Elements" };

const ELEMENTS = [
  "View",
  "Text",
  "Pressable",
  "Image",
  "TextInput",
  "ScrollView",
  "FlatList",
  "Switch",
] as const;

/** One value per `<Code>`, comma separated. */
function Values({ values }: { values: readonly string[] }) {
  return values.map((value, i) => (
    <span key={value}>
      {i > 0 ? ", " : null}
      <Code>{value}</Code>
    </span>
  ));
}

function Platforms({ web, native }: { web: ReactNode; native: ReactNode }) {
  return (
    <Ul>
      <li>
        <strong>Web:</strong> {web}
      </li>
      <li>
        <strong>Native:</strong> {native}
      </li>
    </Ul>
  );
}

export default function Elements() {
  return (
    <>
      <PageHeader
        title="Elements"
        lead={
          <>
            <Code>stylexn/elements</Code> has eight elements that take styles through an{" "}
            <Code>sx</Code> prop. They render DOM elements with React Native&apos;s layout defaults
            on the web and React Native&apos;s own components on native, with the same props on
            both.
          </>
        }
      />
      <OnThisPage
        sections={[
          ...ELEMENTS.map((name) => [name.toLowerCase(), name] as const),
          ["common", "Common props"],
        ]}
      />
      <P>
        The props tables below are read from the elements&apos; TypeScript source when this site is
        built. The elements are a convenience, not a requirement: any React Native component can
        take StyleX styles through <Code>useProps()</Code> from <Code>stylexn</Code>.
      </P>

      <Section id="view" title="View">
        <P>
          A flex container with React Native&apos;s defaults: a column, children stretched, nothing
          shrinking unless told to, <Code>position: relative</Code>, solid zero-width borders. Text
          styles set on a <Code>View</Code> reach the <Code>Text</Code> inside it.
        </P>
        <Example name="ViewLayout">
          <ViewLayout />
        </Example>
        <Platforms web={<Code>&lt;div&gt;</Code>} native={<Code>View</Code>} />
        <PropsTable rows={elementProps("View")} />
      </Section>

      <Section id="text" title="Text">
        <P>
          Text nests, and nested text inherits the outer text&apos;s styles. As in React Native, a{" "}
          <Code>Text</Code> in a row does not shrink by default, on the web too: set{" "}
          <Code>flexShrink: 1</Code> to let it wrap.
        </P>
        <Example name="TextBasics">
          <TextBasics />
        </Example>
        <Platforms web={<Code>&lt;span&gt;</Code>} native={<Code>Text</Code>} />
        <PropsTable rows={elementProps("Text")} />
      </Section>

      <Section id="pressable" title="Pressable">
        <P>
          A <Code>View</Code> that responds to presses. Its rules can use <Code>:hover</Code>,{" "}
          <Code>:active</Code>, <Code>:focus</Code> and <Code>:disabled</Code>. A long press (500ms)
          calls <Code>onLongPress</Code> instead of <Code>onPress</Code>. Hold the button to reset
          the count:
        </P>
        <Example name="PressableCounter">
          <PressableCounter />
        </Example>
        <Platforms
          web={
            <>
              <Code>&lt;button type=&quot;button&quot;&gt;</Code>; pointer events drive press-in,
              press-out and the long-press timer, and keyboard activation counts as a press.
            </>
          }
          native={
            <>
              <Code>Pressable</Code>, with the callbacks composed after the runtime&apos;s own{" "}
              <Code>:active</Code> tracking.
            </>
          }
        />
        <PropsTable rows={elementProps("Pressable")} />
      </Section>

      <Section id="image" title="Image">
        <P>
          A leaf that covers its box by default (React Native&apos;s <Code>resizeMode</Code>{" "}
          &quot;cover&quot;); <Code>objectFit</Code> in the styles changes that. <Code>alt</Code> is
          required: pass an empty string for decorative images.
        </P>
        <Example name="ImageCard">
          <ImageCard />
        </Example>
        <Platforms
          web={
            <>
              <Code>&lt;img&gt;</Code>. Metro&apos;s numeric assets have no URL on the web and log a
              warning.
            </>
          }
          native={
            <>
              <Code>Image</Code>; strings and objects become <Code>{"{ uri }"}</Code>, numbers pass
              through.
            </>
          }
        />
        <PropsTable rows={elementProps("Image")} />
        <P>
          <Code>ImageSource</Code>: {typeDoc("ImageSource")}
        </P>
      </Section>

      <Section id="textinput" title="TextInput">
        <P>
          A text field. <Code>::placeholder</Code> and <Code>caretColor</Code> in the styles set the
          placeholder and cursor colours, and <Code>:focus</Code> works as a condition.
        </P>
        <Example name="EmailField">
          <EmailField />
        </Example>
        <Platforms
          web={
            <>
              <Code>&lt;input&gt;</Code>, or <Code>&lt;textarea&gt;</Code> when{" "}
              <Code>multiline</Code>. <Code>keyboardType</Code> maps to <Code>inputMode</Code> (and
              a matching <Code>type</Code>), <Code>returnKeyType</Code> to <Code>enterKeyHint</Code>
              , and Enter on a single-line input calls <Code>onSubmitEditing</Code>.
            </>
          }
          native={
            <>
              <Code>TextInput</Code>; the placeholder colour becomes{" "}
              <Code>placeholderTextColor</Code> and the caret colour <Code>cursorColor</Code>.
            </>
          }
        />
        <Note title="Not part of text inheritance">
          <Code>color</Code> and font styles on an enclosing <Code>View</Code> do not reach a{" "}
          <Code>TextInput</Code>, as the browser&apos;s own input styles block them on the web.
          Style the input itself.
        </Note>
        <PropsTable rows={elementProps("TextInput")} />
        <P>
          <Code>keyboardType</Code>: <Values values={unionValues("KeyboardType")} />.{" "}
          <Code>returnKeyType</Code>: <Values values={unionValues("ReturnKeyType")} />.
        </P>
        <H3>Ref methods</H3>
        <PropsTable rows={handleMethods("TextInputHandle")} label="Method" />
      </Section>

      <Section id="scrollview" title="ScrollView">
        <P>
          <Code>sx</Code> styles the scroll container and <Code>contentSx</Code> the content inside
          it. <Code>onScroll</Code> reports the content offset as <Code>{"{ x, y }"}</Code> on both
          platforms.
        </P>
        <Example name="ChipScroller">
          <ChipScroller />
        </Example>
        <Platforms
          web={
            <>
              a scrolling <Code>&lt;div&gt;</Code> around a content <Code>&lt;div&gt;</Code>; the
              ref scrolls it with <Code>scrollTo</Code>.
            </>
          }
          native={
            <>
              <Code>ScrollView</Code>, with <Code>contentSx</Code> as{" "}
              <Code>contentContainerStyle</Code>.
            </>
          }
        />
        <PropsTable rows={elementProps("ScrollView")} />
        <H3>Ref methods</H3>
        <PropsTable rows={handleMethods("ScrollViewHandle")} label="Method" />
      </Section>

      <Section id="flatlist" title="FlatList">
        <P>
          A list of items with optional header, footer, separator and empty content. Scroll to the
          end of the list to load the next page:
        </P>
        <Example name="InfiniteList">
          <InfiniteList />
        </Example>
        <Platforms
          web={
            <>
              a plain scrolling list: every item is rendered, each in its own cell;{" "}
              <Code>onEndReached</Code> is computed from the scroll position.
            </>
          }
          native={
            <>
              React Native&apos;s virtualised <Code>FlatList</Code>. For native-only props (
              <Code>initialNumToRender</Code>, <Code>getItemLayout</Code>, …), use React
              Native&apos;s <Code>FlatList</Code> directly with <Code>useProps()</Code>.
            </>
          }
        />
        <PropsTable rows={elementProps("FlatList")} />
        <H3>Ref methods</H3>
        <PropsTable rows={handleMethods("FlatListHandle")} label="Method" />
      </Section>

      <Section id="switch" title="Switch">
        <P>
          A toggle for a boolean. <Code>sx</Code> sizes and places the control; its colours are the
          platform&apos;s own.
        </P>
        <Example name="SettingsSwitches">
          <SettingsSwitches />
        </Example>
        <Platforms
          web={
            <>
              a checkbox <Code>&lt;input&gt;</Code> with <Code>role=&quot;switch&quot;</Code>.
            </>
          }
          native={<Code>Switch</Code>}
        />
        <PropsTable rows={elementProps("Switch")} />
      </Section>

      <Section id="common" title="Common props">
        <P>
          Every element also takes these. The accessibility props use the web names; React Native
          accepts <Code>role</Code> and these <Code>aria-*</Code> props directly, so nothing is
          renamed on either platform. On the web, <Code>testID</Code> becomes{" "}
          <Code>data-testid</Code>.
        </P>
        <PropsTable rows={commonProps()} />
        <P>
          <Code>role</Code>: <Values values={unionValues("Role")} />.
        </P>
      </Section>
    </>
  );
}
