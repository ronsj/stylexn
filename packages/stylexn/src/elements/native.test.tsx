// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// React Native primitives stand in as DOM elements that expose their style.
vi.mock("react-native", () => import("../testing/react-native.ts"));

import { create } from "../runtime/api.ts";
import { createTheme, defineVars, resetVarsForTesting } from "../runtime/vars.ts";
import { createRef } from "react";
import { FlatList, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "./native.ts";
import type { FlatListHandle, ScrollViewHandle, TextInputHandle } from "./native.ts";

beforeEach(() => {
  resetVarsForTesting();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// This package compiles without DOM types; read elements through a local shape.
type Host = { getAttribute(name: string): string | null; tagName: string };
const host = (testID: string) => screen.getByTestId(testID) as unknown as Host;
const styleOf = (testID: string) =>
  JSON.parse(host(testID).getAttribute("data-style") ?? "null") as Record<string, unknown>;
const tagOf = (testID: string) => host(testID).tagName;
// Likewise for the bits of the DOM the list and focus tests read.
type Dom = { children: ArrayLike<unknown>; textContent: string | null };
const dom = (testID: string) => screen.getByTestId(testID) as unknown as Dom;
const activeElement = () =>
  (globalThis as unknown as { document: { activeElement: unknown } }).document.activeElement;
const propsOf = (testID: string) =>
  JSON.parse(host(testID).getAttribute("data-props") ?? "null") as Record<string, unknown>;

const styles = create({
  card: { padding: 8, color: "red", fontSize: 20, fontFamily: "Inter" },
  big: { fontSize: 32 },
  blue: { color: "blue" },
  em: { paddingTop: "1em", lineHeight: 1.5 },
  lead: { fontSize: 20, lineHeight: 1.5 },
  leadPx: { fontSize: 20, lineHeight: "24px" },
  pct: { fontSize: "120%" },
  pad: { paddingTop: "1em" },
  button: { color: "white", backgroundColor: "black" },
  fading: { opacity: { default: 1, ":active": 0.5 }, transitionDuration: "100ms" },
  input: {
    color: { default: "black", "::placeholder": "gray", ":focus": "blue" },
    caretColor: "red",
    borderBottomWidth: 1,
  },
  clamp: { lineClamp: 2, textOverflow: "ellipsis" },
  formState: {
    opacity: { default: 1, ":checked": 0.9 },
    color: { default: "black", ":placeholder-shown": "gray" },
    borderBottomColor: { default: "blue", ":read-only": "silver" },
    backgroundColor: { default: "white", ":read-write": "ivory" },
  },
  scroll: { color: "red", padding: 4 },
  content: { gap: 8 },
});

describe("text inheritance", () => {
  test("View keeps layout keys and hands text keys to nested Text", () => {
    render(
      <View sx={styles.card} testID="view">
        <Text testID="text">hi</Text>
      </View>,
    );
    expect(styleOf("view")).toEqual({
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    });
    expect(styleOf("text")).toEqual({ color: "red", fontSize: 20, fontFamily: "Inter" });
  });

  test("the element's own text style wins; deeper Views add to the cascade", () => {
    render(
      <View sx={styles.card}>
        <View sx={styles.big} testID="inner">
          <Text sx={styles.blue} testID="text">
            hi
          </Text>
        </View>
      </View>,
    );
    expect(styleOf("inner")).toEqual({});
    expect(styleOf("text")).toEqual({ color: "blue", fontSize: 32, fontFamily: "Inter" });
  });

  test("em units resolve against the inherited font size", () => {
    render(
      <View sx={styles.card}>
        <Text sx={styles.em} testID="text">
          hi
        </Text>
      </View>,
    );
    expect(styleOf("text")).toEqual({
      color: "red",
      fontSize: 20,
      fontFamily: "Inter",
      paddingTop: 20,
      lineHeight: 30,
    });
  });

  test("Text provides its own text style to nested elements", () => {
    render(
      <Text sx={styles.big}>
        <Text sx={styles.em} testID="nested">
          hi
        </Text>
      </Text>,
    );
    expect(styleOf("nested")).toEqual({ fontSize: 32, paddingTop: 32, lineHeight: 48 });
  });

  test("a unitless lineHeight inherits as a multiplier of the child's font size; a length as is", () => {
    render(
      <View sx={styles.lead}>
        <Text sx={styles.big} testID="big">
          hi
        </Text>
        <Text testID="same">hi</Text>
        <View sx={styles.leadPx}>
          <Text sx={styles.big} testID="px">
            hi
          </Text>
        </View>
      </View>,
    );
    expect(styleOf("big")).toEqual({ fontSize: 32, lineHeight: 48 });
    expect(styleOf("same")).toEqual({ fontSize: 20, lineHeight: 30 });
    expect(styleOf("px")).toEqual({ fontSize: 32, lineHeight: 24 });
  });

  test("fontSize percentages resolve against the inherited font size", () => {
    render(
      <View sx={styles.lead}>
        <Text sx={styles.pct} testID="in">
          hi
        </Text>
        <Text sx={styles.pct}>
          <Text sx={styles.pct} testID="deeper">
            hi
          </Text>
        </Text>
      </View>,
    );
    expect(styleOf("in")).toEqual({ fontSize: 24, lineHeight: 36 });
    expect(styleOf("deeper").fontSize).toBeCloseTo(28.8); // 120% of 24
    expect(styleOf("deeper").lineHeight).toBeCloseTo(43.2);
    render(
      <Text sx={styles.pct} testID="root">
        hi
      </Text>,
    );
    expect(styleOf("root")).toEqual({ fontSize: 16.8 }); // 120% of config.fontSize (14)
  });

  test("TextInput does not take inherited text style, like inputs on the web", () => {
    render(
      <View sx={styles.card}>
        <TextInput testID="in" />
      </View>,
    );
    expect(styleOf("in")).toEqual({});
  });

  test("Pressable behaves like View", () => {
    render(
      <Pressable sx={styles.button} testID="button">
        <Text testID="label">Go</Text>
      </Pressable>,
    );
    expect(styleOf("button")).toEqual({ backgroundColor: "black" });
    expect(styleOf("label")).toEqual({ color: "white" });
  });

  test("nothing to inherit: no provider, plain styles", () => {
    render(
      <View sx={styles.pad} testID="view">
        <Text testID="text">hi</Text>
      </View>,
    );
    expect(styleOf("view")).toEqual({ paddingTop: 14 }); // config.fontSize = 14
    expect(styleOf("text")).toEqual({});
  });
});

describe("animated elements", () => {
  test("use Animated components when the rules mention motion", () => {
    render(
      <Pressable sx={styles.fading} testID="p">
        <Text testID="t">hi</Text>
      </Pressable>,
    );
    // Rules with motion render on Animated components from the start (no remount on press).
    expect(propsOf("p").animated).toBe(true);
    expect(propsOf("t").animated).toBeUndefined();
    fireEvent.mouseDown(screen.getByTestId("p")); // the host mock maps onPressIn to mousedown
    expect(styleOf("p").opacity).toMatchObject({ $$interpolation: { outputRange: [1, 0.5] } });
  });
});

describe("Image, TextInput, ScrollView", () => {
  test("Image maps src to a uri source and keeps alt", () => {
    render(<Image sx={styles.pad} src="https://x/y.png" alt="y" testID="img" />);
    expect(propsOf("img")).toMatchObject({ source: { uri: "https://x/y.png" }, alt: "y" });
    expect(styleOf("img")).toEqual({ paddingTop: 14 });
  });

  test("TextInput receives style-derived props and focus handlers", () => {
    render(<TextInput sx={styles.input} placeholder="Name" testID="in" />);
    expect(propsOf("in")).toMatchObject({
      placeholder: "Name",
      placeholderTextColor: "gray",
      cursorColor: "red",
      editable: true,
    });
    expect(styleOf("in")).toEqual({ color: "black", borderBottomWidth: 1 });
    // :focus is driven by the runtime's onFocus/onBlur, which the input receives.
    expect(Object.keys(propsOf("in"))).not.toContain("onHoverIn");
    render(<TextInput sx={styles.input} disabled testID="off" />);
    expect(propsOf("off").editable).toBe(false);
  });

  test("TextInput :placeholder-shown follows a controlled value", () => {
    const { rerender } = render(
      <TextInput sx={styles.formState} placeholder="Name" value="" testID="in" />,
    );
    expect(styleOf("in").color).toBe("gray");
    rerender(<TextInput sx={styles.formState} placeholder="Name" value="Ada" testID="in" />);
    expect(styleOf("in").color).toBe("black");
    rerender(<TextInput sx={styles.formState} placeholder="Name" value="" testID="in" />);
    expect(styleOf("in").color).toBe("gray");
  });

  test("TextInput :placeholder-shown tracks typing when uncontrolled", () => {
    const onChangeText = vi.fn();
    render(
      <TextInput
        sx={styles.formState}
        placeholder="Name"
        onChangeText={onChangeText}
        testID="in"
      />,
    );
    const input = screen.getByTestId("in");
    expect(styleOf("in").color).toBe("gray");
    fireEvent.change(input, { target: { value: "A" } }); // the double maps onChangeText to change
    expect(styleOf("in").color).toBe("black");
    expect(onChangeText).toHaveBeenCalledWith("A");
    fireEvent.change(input, { target: { value: "" } });
    expect(styleOf("in").color).toBe("gray");
  });

  test("TextInput :placeholder-shown starts from defaultValue and needs a placeholder", () => {
    render(<TextInput sx={styles.formState} placeholder="Name" defaultValue="Ada" testID="in" />);
    expect(styleOf("in").color).toBe("black");
    render(<TextInput sx={styles.formState} value="" testID="bare" />);
    expect(styleOf("bare").color).toBe("black");
  });

  test("TextInput ref.clear() shows the placeholder again", () => {
    const input = createRef<TextInputHandle>();
    render(
      <TextInput
        sx={styles.formState}
        placeholder="Name"
        defaultValue="Ada"
        ref={input}
        testID="in"
      />,
    );
    const clear = vi.fn();
    Object.assign(screen.getByTestId("in"), { clear });
    expect(styleOf("in").color).toBe("black");
    act(() => input.current?.clear());
    expect(clear).toHaveBeenCalledOnce();
    expect(styleOf("in").color).toBe("gray");
  });

  test("TextInput forwards readOnly and matches :read-only/:read-write", () => {
    render(<TextInput sx={styles.formState} testID="rw" />);
    expect(styleOf("rw")).toMatchObject({ borderBottomColor: "blue", backgroundColor: "ivory" });
    render(<TextInput sx={styles.formState} readOnly testID="ro" />);
    expect(propsOf("ro")).toMatchObject({ readOnly: true, editable: true });
    expect(styleOf("ro")).toMatchObject({ borderBottomColor: "silver", backgroundColor: "white" });
    render(<TextInput sx={styles.formState} disabled testID="off" />);
    expect(styleOf("off")).toMatchObject({ borderBottomColor: "silver", backgroundColor: "white" });
  });

  test("Text gets numberOfLines and ellipsizeMode from lineClamp/textOverflow", () => {
    render(
      <Text sx={styles.clamp} testID="t">
        long
      </Text>,
    );
    expect(propsOf("t")).toMatchObject({ numberOfLines: 2, ellipsizeMode: "tail" });
  });

  test("ScrollView styles the container and the content separately and cascades text", () => {
    render(
      <ScrollView sx={styles.scroll} contentSx={styles.content} horizontal testID="s">
        <Text testID="t">hi</Text>
      </ScrollView>,
    );
    expect(tagOf("s")).toBe("RN-SCROLLVIEW");
    expect(styleOf("s")).toEqual({
      paddingTop: 4,
      paddingRight: 4,
      paddingBottom: 4,
      paddingLeft: 4,
    });
    expect(propsOf("s")).toMatchObject({
      horizontal: true,
      contentContainerStyle: { rowGap: 8, columnGap: 8 },
    });
    expect(styleOf("t")).toEqual({ color: "red" });
  });

  test("accessibility props pass through unchanged", () => {
    render(
      <View role="button" aria-label="go" aria-disabled testID="v">
        <Text>x</Text>
      </View>,
    );
    expect(propsOf("v")).toMatchObject({
      role: "button",
      "aria-label": "go",
      "aria-disabled": true,
    });
  });
});

describe("element follow-ups", () => {
  test("Image accepts require() numbers and bundler objects, and forwards load callbacks", () => {
    const onLoad = vi.fn();
    render(
      <>
        <Image src={42} alt="" testID="num" onLoad={onLoad} />
        <Image src={{ src: "https://x/y.png" }} alt="" testID="obj" />
      </>,
    );
    expect(propsOf("num").source).toBe(42);
    expect(propsOf("obj").source).toEqual({ uri: "https://x/y.png" });
    expect(onLoad).not.toHaveBeenCalled();
  });

  test("TextInput passes keyboard props through and composes focus callbacks with the runtime", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextInput
        sx={styles.input}
        keyboardType="email-address"
        returnKeyType="send"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={10}
        onFocus={onFocus}
        onBlur={onBlur}
        testID="in"
      />,
    );
    expect(propsOf("in")).toMatchObject({
      keyboardType: "email-address",
      returnKeyType: "send",
      autoCapitalize: "none",
      autoCorrect: false,
      maxLength: 10,
    });
    // The host mock maps onFocus/onBlur to DOM focus events.
    fireEvent.focus(screen.getByTestId("in"));
    expect(onFocus).toHaveBeenCalledOnce();
    expect(styleOf("in").color).toBe("blue"); // :focus from the runtime still applies
    fireEvent.blur(screen.getByTestId("in"));
    expect(onBlur).toHaveBeenCalledOnce();
    expect(styleOf("in").color).toBe("black");
  });

  test("ScrollView normalises scroll events to a content offset", () => {
    const onScroll = vi.fn();
    render(
      <ScrollView onScroll={onScroll} testID="s">
        <Text>x</Text>
      </ScrollView>,
    );
    expect(propsOf("s").scrollEventThrottle).toBe(16);
    fireEvent.scroll(screen.getByTestId("s"), { target: { scrollLeft: 3, scrollTop: 40 } });
    expect(onScroll).toHaveBeenCalledWith({ x: 3, y: 40 });
  });
});

describe("more elements", () => {
  test("FlatList renders through React Native's FlatList with header, separator, empty and text cascade", () => {
    render(
      <FlatList
        sx={styles.card}
        contentSx={styles.content}
        data={[{ id: "a" }, { id: "b" }]}
        renderItem={({ item, index }) => <Text testID={`item-${index}`}>{item.id}</Text>}
        header={<Text testID="header">top</Text>}
        separator={<View testID="sep" />}
        empty={<Text testID="empty">none</Text>}
        onEndReached={() => {}}
        onEndReachedThreshold={1}
        testID="list"
      />,
    );
    expect(tagOf("list")).toBe("RN-FLATLIST");
    expect(styleOf("list")).toEqual({
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
    });
    expect(propsOf("list")).toMatchObject({
      contentContainerStyle: { rowGap: 8, columnGap: 8 },
      onEndReachedThreshold: 1,
    });
    expect(dom("list").children).toHaveLength(4); // header, a, sep, b
    expect(screen.getAllByTestId("sep")).toHaveLength(1);
    expect(screen.queryByTestId("empty")).toBeNull();
    // Text styles on the list cascade into the items like on a View.
    expect(styleOf("item-0")).toEqual({ color: "red", fontSize: 20, fontFamily: "Inter" });
    expect(styleOf("header")).toEqual({ color: "red", fontSize: 20, fontFamily: "Inter" });
  });

  test("FlatList with no data shows the empty slot; plain nodes are accepted in the slots", () => {
    render(
      <FlatList data={[]} renderItem={() => null} empty="nothing" footer="end" testID="list" />,
    );
    expect(dom("list").textContent).toBe("nothingend");
  });

  test("Switch passes value, change and disabled through", () => {
    const onValueChange = vi.fn();
    render(<Switch sx={styles.pad} value onValueChange={onValueChange} testID="sw" />);
    expect(tagOf("sw")).toBe("RN-SWITCH");
    expect(propsOf("sw")).toMatchObject({ value: true });
    expect(styleOf("sw")).toEqual({ paddingTop: 14 });
    fireEvent.change(screen.getByTestId("sw"), { target: { checked: false } });
    expect(onValueChange).toHaveBeenCalledWith(false);
    render(<Switch value={false} disabled testID="off" />);
    expect(propsOf("off")).toMatchObject({ value: false, disabled: true });
  });

  test("Switch matches :checked from its value and is always :read-only", () => {
    const { rerender } = render(<Switch sx={styles.formState} value={false} testID="sw" />);
    expect(styleOf("sw")).toMatchObject({ opacity: 1, borderBottomColor: "silver" });
    expect(styleOf("sw").backgroundColor).toBe("white");
    rerender(<Switch sx={styles.formState} value testID="sw" />);
    expect(styleOf("sw").opacity).toBe(0.9);
  });

  test("Pressable composes the author's press callbacks with the runtime's tracking", () => {
    const onPressIn = vi.fn();
    const onPressOut = vi.fn();
    render(
      <Pressable sx={styles.fading} onPressIn={onPressIn} onPressOut={onPressOut} testID="p">
        <Text>hi</Text>
      </Pressable>,
    );
    fireEvent.mouseDown(screen.getByTestId("p"));
    expect(onPressIn).toHaveBeenCalledOnce();
    expect(styleOf("p").opacity).toMatchObject({ $$interpolation: { outputRange: [1, 0.5] } });
    fireEvent.mouseUp(screen.getByTestId("p"));
    expect(onPressOut).toHaveBeenCalledOnce();
  });

  test("Pressable forwards onLongPress (the double fires it on contextmenu)", () => {
    const onLongPress = vi.fn();
    render(
      <Pressable onLongPress={onLongPress} testID="p">
        <Text>hi</Text>
      </Pressable>,
    );
    fireEvent.contextMenu(screen.getByTestId("p"));
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  test("a theme in sx reaches the subtree, like custom properties on the web", () => {
    const tokens = defineVars({ tone: "red" });
    const theme = createTheme(tokens, { tone: "blue" });
    const s = create({ label: { color: tokens.tone } });
    render(
      <View sx={[theme, styles.pad]}>
        <View>
          <Text sx={s.label} testID="inner">
            hi
          </Text>
        </View>
      </View>,
    );
    expect(styleOf("inner")).toEqual({ color: "blue" });
  });

  test("refs expose focus/blur/clear and the scroll methods of the underlying component", () => {
    const input = createRef<TextInputHandle>();
    const scroll = createRef<ScrollViewHandle>();
    const list = createRef<FlatListHandle>();
    render(
      <>
        <TextInput ref={input} testID="in" />
        <ScrollView ref={scroll} testID="s">
          <Text>x</Text>
        </ScrollView>
        <FlatList ref={list} data={[1]} renderItem={() => null} testID="l" />
      </>,
    );
    input.current?.focus();
    expect(activeElement()).toBe(screen.getByTestId("in"));
    input.current?.blur();
    expect(activeElement()).not.toBe(screen.getByTestId("in"));
    // The doubles are DOM elements; give them the React Native methods to observe the calls.
    const scrollTo = vi.fn();
    const scrollToEnd = vi.fn();
    Object.assign(screen.getByTestId("s"), { scrollTo, scrollToEnd });
    scroll.current?.scrollTo({ y: 40 });
    scroll.current?.scrollToEnd({ animated: false });
    expect(scrollTo).toHaveBeenCalledWith({ x: undefined, y: 40, animated: true });
    expect(scrollToEnd).toHaveBeenCalledWith({ animated: false });
    const scrollToIndex = vi.fn();
    const scrollToOffset = vi.fn();
    Object.assign(screen.getByTestId("l"), { scrollToIndex, scrollToOffset });
    list.current?.scrollToIndex({ index: 3 });
    list.current?.scrollToOffset({ offset: 10, animated: false });
    expect(scrollToIndex).toHaveBeenCalledWith({ index: 3, animated: true });
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 10, animated: false });
  });
});
