import { expect, test } from "vitest";
import { commonProps, elementProps, handleMethods, typeDoc, unionValues } from "./props";

const names = (rows: readonly { name: string }[]) => rows.map((row) => row.name);

test("element props combine the shared types with the element's own", () => {
  expect(names(elementProps("View"))).toEqual(["sx", "children"]);
  expect(names(elementProps("Pressable"))).toEqual([
    "disabled",
    "onPress",
    "onPressIn",
    "onPressOut",
    "onLongPress",
    "sx",
    "children",
  ]);
  expect(names(elementProps("ScrollView"))).toEqual([
    "horizontal",
    "onScroll",
    "sx",
    "contentSx",
    "children",
    "ref",
  ]);
});

test("rows carry the type text, whether the prop is required, and its doc comment", () => {
  const image = elementProps("Image");
  expect(image.find((row) => row.name === "alt")).toEqual({
    name: "alt",
    type: "string",
    required: true,
    doc: "Accessible description; empty string for decorative images.",
  });
  const flatList = elementProps("FlatList");
  expect(flatList.find((row) => row.name === "renderItem")?.type).toBe(
    "(info: Readonly<{ item: T; index: number }>) => ReactNode",
  );
  expect(flatList.find((row) => row.name === "sx")?.doc).toMatch(/stylex\.create/);
});

test("common props, handle methods, unions and type docs", () => {
  expect(names(commonProps())).toContain("aria-label");
  expect(names(commonProps())).toContain("testID");
  expect(names(handleMethods("TextInputHandle"))).toEqual(["focus()", "blur()", "clear()"]);
  expect(unionValues("KeyboardType")).toContain("email-address");
  expect(unionValues("Role")).toContain("navigation");
  expect(typeDoc("ImageSource")).toMatch(/require\(\)/);
});
