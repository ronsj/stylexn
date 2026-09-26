import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "stylexn/elements";
import type { FlatListHandle, ScrollViewHandle, TextInputHandle } from "stylexn/elements";
import { expect, test, vi } from "vitest";
import * as stylex from "stylexn";
import { buttonColors } from "./examples/buttonTheme.stylex";

// The web implementation of stylexn/elements, compiled by the real StyleX plugin.

test("Image renders an img with src and alt and StyleX classes", () => {
  render(<Image src="data:image/png;base64," alt="pixel" testID="img" />);
  const img = screen.getByTestId("img") as HTMLImageElement;
  expect(img.tagName).toBe("IMG");
  expect(img.alt).toBe("pixel");
  expect(img.className).toMatch(/\bx[a-z0-9]+\b/);
});

test("TextInput is an input, a password input, or a textarea, and reports text changes", () => {
  const onChangeText = vi.fn();
  render(
    <>
      <TextInput testID="plain" onChangeText={onChangeText} placeholder="Name" />
      <TextInput testID="secret" secureTextEntry />
      <TextInput testID="multi" multiline disabled />
    </>,
  );
  const plain = screen.getByTestId("plain") as HTMLInputElement;
  expect(plain.type).toBe("text");
  expect(plain.placeholder).toBe("Name");
  fireEvent.change(plain, { target: { value: "Ada" } });
  expect(onChangeText).toHaveBeenCalledWith("Ada");
  expect((screen.getByTestId("secret") as HTMLInputElement).type).toBe("password");
  const multi = screen.getByTestId("multi") as HTMLTextAreaElement;
  expect(multi.tagName).toBe("TEXTAREA");
  expect(multi.disabled).toBe(true);
});

test("ScrollView wraps children in a content container", () => {
  render(
    <ScrollView testID="s" horizontal>
      <Text>a</Text>
    </ScrollView>,
  );
  const outer = screen.getByTestId("s");
  expect(outer.children).toHaveLength(1);
  expect(outer.firstElementChild?.tagName).toBe("DIV");
  expect(outer.firstElementChild?.textContent).toBe("a");
});

test("accessibility props reach the DOM on every element", () => {
  render(
    <View role="navigation" aria-label="main" testID="v">
      <Pressable aria-disabled testID="p">
        <Text aria-hidden testID="t">
          x
        </Text>
      </Pressable>
    </View>,
  );
  expect(screen.getByTestId("v").getAttribute("role")).toBe("navigation");
  expect(screen.getByTestId("v").getAttribute("aria-label")).toBe("main");
  expect(screen.getByTestId("p").getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByTestId("t").getAttribute("aria-hidden")).toBe("true");
});

test("TextInput keyboard props map to HTML, Enter submits, focus callbacks fire", () => {
  const onSubmitEditing = vi.fn();
  const onFocus = vi.fn();
  render(
    <TextInput
      testID="email"
      keyboardType="email-address"
      returnKeyType="send"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={20}
      onSubmitEditing={onSubmitEditing}
      onFocus={onFocus}
    />,
  );
  const input = screen.getByTestId("email") as HTMLInputElement;
  expect(input.type).toBe("email");
  expect(input.getAttribute("inputmode")).toBe("email");
  expect(input.getAttribute("enterkeyhint")).toBe("send");
  expect(input.getAttribute("autocapitalize")).toBe("none");
  expect(input.getAttribute("autocorrect")).toBe("off");
  expect(input.maxLength).toBe(20);
  fireEvent.keyDown(input, { key: "a" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSubmitEditing).toHaveBeenCalledOnce();
  fireEvent.focus(input);
  expect(onFocus).toHaveBeenCalledOnce();
});

test("Image accepts bundler objects and ScrollView reports the scroll offset", () => {
  const onScroll = vi.fn();
  render(
    <>
      <Image src={{ src: "/static/a.png" }} alt="" testID="img" />
      <ScrollView testID="s" onScroll={onScroll}>
        <Text>x</Text>
      </ScrollView>
    </>,
  );
  expect((screen.getByTestId("img") as HTMLImageElement).getAttribute("src")).toBe("/static/a.png");
  const box = screen.getByTestId("s");
  box.scrollTop = 25;
  fireEvent.scroll(box);
  expect(onScroll).toHaveBeenCalledWith({ x: 0, y: 25 });
});

test("FlatList renders every item in a cell with header, separators and footer, and reports the end", () => {
  const onEndReached = vi.fn();
  render(
    <FlatList
      data={[{ id: "a" }, { id: "b" }, { id: "c" }]}
      renderItem={({ item }) => <Text>{item.id}</Text>}
      header={<Text>top</Text>}
      footer={<Text>end</Text>}
      separator={<View testID="sep" />}
      onEndReached={onEndReached}
      testID="list"
    />,
  );
  const outer = screen.getByTestId("list");
  const content = outer.firstElementChild as HTMLElement;
  expect(content.textContent).toBe("topabcend");
  expect(content.querySelectorAll("[data-index]")).toHaveLength(3);
  expect(screen.getAllByTestId("sep")).toHaveLength(2);
  // jsdom has no layout: everything is at the end, so the first scroll reports it once.
  fireEvent.scroll(outer, { target: { scrollTop: 0 } });
  fireEvent.scroll(outer, { target: { scrollTop: 1 } });
  expect(onEndReached).toHaveBeenCalledOnce();
});

test("FlatList shows the empty slot and derives keys from key, id or index", () => {
  const { rerender } = render(
    <FlatList data={[]} renderItem={() => null} empty={<Text>none</Text>} testID="list" />,
  );
  expect(screen.getByTestId("list").textContent).toBe("none");
  rerender(
    <FlatList
      data={[{ key: "k" }, { id: 7 }, {}]}
      renderItem={({ index }) => <Text>{index}</Text>}
      testID="list"
    />,
  );
  expect(screen.getByTestId("list").textContent).toBe("012");
});

test("Switch is a checkbox with the switch role", () => {
  const onValueChange = vi.fn();
  render(<Switch value onValueChange={onValueChange} testID="sw" />);
  const input = screen.getByTestId("sw") as HTMLInputElement;
  expect(input.type).toBe("checkbox");
  expect(input.getAttribute("role")).toBe("switch");
  expect(input.checked).toBe(true);
  fireEvent.click(input);
  expect(onValueChange).toHaveBeenCalledWith(false);
});

test("Pressable reports press-in/out and long presses; a long press swallows the click", () => {
  vi.useFakeTimers();
  const onPress = vi.fn();
  const onPressIn = vi.fn();
  const onPressOut = vi.fn();
  const onLongPress = vi.fn();
  render(
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      testID="p"
    >
      <Text>go</Text>
    </Pressable>,
  );
  const button = screen.getByTestId("p");
  fireEvent.pointerDown(button);
  expect(onPressIn).toHaveBeenCalledOnce();
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(onPressOut).toHaveBeenCalledOnce();
  expect(onPress).toHaveBeenCalledOnce();
  expect(onLongPress).not.toHaveBeenCalled();
  fireEvent.pointerDown(button);
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(onLongPress).toHaveBeenCalledOnce();
  fireEvent.pointerUp(button);
  fireEvent.click(button);
  expect(onPress).toHaveBeenCalledOnce(); // not again
  vi.useRealTimers();
});

test("refs expose focus/clear on TextInput and scrolling on ScrollView and FlatList", () => {
  const input = createRef<TextInputHandle>();
  const scroll = createRef<ScrollViewHandle>();
  const list = createRef<FlatListHandle>();
  const onChangeText = vi.fn();
  render(
    <>
      <TextInput ref={input} onChangeText={onChangeText} defaultValue="abc" testID="in" />
      <ScrollView ref={scroll} testID="s">
        <Text>x</Text>
      </ScrollView>
      <FlatList ref={list} data={[1, 2]} renderItem={() => <Text>x</Text>} testID="l" />
    </>,
  );
  const el = screen.getByTestId("in") as HTMLInputElement;
  input.current?.focus();
  expect(document.activeElement).toBe(el);
  input.current?.clear();
  expect(el.value).toBe("");
  expect(onChangeText).toHaveBeenCalledWith("");
  // jsdom does not implement scrolling; observe the calls.
  const scrollTo = vi.fn();
  Object.assign(screen.getByTestId("s"), { scrollTo });
  scroll.current?.scrollTo({ y: 40, animated: false });
  expect(scrollTo).toHaveBeenCalledWith({ left: undefined, top: 40, behavior: "instant" });
  const listScrollTo = vi.fn();
  Object.assign(screen.getByTestId("l"), { scrollTo: listScrollTo });
  list.current?.scrollToOffset({ offset: 12 });
  expect(listScrollTo).toHaveBeenCalledWith({ top: 12, behavior: "smooth" });
  list.current?.scrollToIndex({ index: 1, animated: false });
  expect(listScrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" }); // no layout in jsdom
});

test("ThemeProvider wraps a subtree in a display: contents element carrying the theme", () => {
  // defineVars must live in a *.stylex file; reuse the ThemeDemo's group.
  const blue = stylex.createTheme(buttonColors, { background: "blue" });
  render(
    <stylex.ThemeProvider theme={blue}>
      <Text testID="t">x</Text>
    </stylex.ThemeProvider>,
  );
  const wrapper = screen.getByTestId("t").parentElement as HTMLElement;
  expect(wrapper.tagName).toBe("DIV");
  expect(wrapper.style.display).toBe("contents");
  expect(wrapper.className).toMatch(/\bx[a-z0-9]+\b/); // the theme's class
});
