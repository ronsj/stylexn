import { act, fireEvent, render, screen } from "@testing-library/react";
import { PressableCounter } from "@stylexn/shared";
import { resetTestEnv, setColorScheme, styleOf } from "stylexn/testing/react-native";
import { beforeEach, expect, test } from "vitest";

// A shared example rendered the way React Native renders it: the plugin
// compiled its styles for native, and the primitives are StyleXN's test
// doubles, which expose the resolved style.

beforeEach(resetTestEnv);

const button = () => screen.getByText("0").closest("rn-pressable") as HTMLElement;

test("counts presses and reports press-in and press-out", () => {
  render(<PressableCounter />);
  fireEvent.mouseDown(button());
  expect(screen.getByText("Pressing…")).toBeTruthy();
  fireEvent.mouseUp(button());
  fireEvent.click(button());
  expect(screen.getByText("1")).toBeTruthy();
  expect(screen.getByText("Press, or hold to reset")).toBeTruthy();
});

test("resolves the styles to React Native keys", () => {
  render(<PressableCounter />);
  expect(styleOf(button())).toMatchObject({
    width: 120,
    height: 120,
    borderTopLeftRadius: 60,
    backgroundColor: "#6a3db8",
  });
  // The colour is set on the Pressable and inherited by the Text inside it.
  expect(styleOf(screen.getByText("0"))).toMatchObject({ color: "#ffffff", fontSize: 36 });
});

test("follows the colour scheme", () => {
  render(<PressableCounter />);
  const status = screen.getByText("Press, or hold to reset");
  expect(styleOf(status).color).toBe("#5b5566");
  act(() => setColorScheme("dark"));
  expect(styleOf(status).color).toBe("#b9b2c6");
});
