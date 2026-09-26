import { act, fireEvent, render, screen } from "@testing-library/react";
import { propsOf, resetTestEnv, setColorScheme, styleOf } from "stylexn/testing/react-native";
import { beforeEach, expect, test } from "vitest";
import App from "./App";

// The same component tree Metro renders on a device, through StyleXN's
// runtime and the mocked React Native primitives.

beforeEach(resetTestEnv);

test("renders the shared component with compiled native styles", () => {
  render(<App />);
  const title = screen.getByText("Hello from @stylexn/shared, mobile!");
  expect(title.tagName).toBe("RN-TEXT");
  expect(styleOf(title)).toMatchObject({ color: "rebeccapurple", fontSize: 24, flexShrink: 1 });
  // The card is a View with React Native keys (shorthands expanded by the plugin).
  const card = title.closest("rn-view")?.parentElement as HTMLElement;
  expect(styleOf(card)).toMatchObject({ paddingTop: 16, borderTopWidth: 1, elevation: 2 });
});

test("presses count and the name field drives the greeting", () => {
  render(<App />);
  const button = screen.getByTestId("hello-button");
  expect(button.tagName).toBe("RN-PRESSABLE");
  expect(propsOf(button)).toMatchObject({ role: "button" });
  fireEvent.mouseDown(button); // :active -> the transition attaches Animated nodes
  fireEvent.mouseUp(button);
  fireEvent.click(button);
  expect(screen.getByText("Pressed 1 times")).toBeTruthy();
  fireEvent.change(screen.getByTestId("hello-name"), { target: { value: "Ada" } });
  expect(screen.getByText("Hello from @stylexn/shared, Ada!")).toBeTruthy();
});

const title = () => screen.getByText("Hello from @stylexn/shared, mobile!");

test("follows the colour scheme through defineVars", () => {
  render(<App />);
  expect(styleOf(title()).color).toBe("rebeccapurple");
  act(() => setColorScheme("dark"));
  expect(styleOf(title()).color).toBe("#b48ee6");
});
