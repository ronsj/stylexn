import { fireEvent, render, screen } from "@testing-library/react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "stylexn/elements";
import { expect, test, vi } from "vitest";

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
