# stylexn

Author styles with the [StyleX](https://stylexjs.com) API and render them on
React Native. Web keeps the real StyleX compiler; native gets a runtime that
evaluates the same rules against device state, plus four layers of checks
(types, lint, build, runtime) that read one compatibility table.

```tsx
import * as stylex from "stylexn";
import { Pressable, Text, View } from "stylexn/elements";

const styles = stylex.create({
  card: {
    padding: 16,
    borderRadius: 12,
    width: { default: "100%", "@media (min-width: 800px)": 512 },
    backgroundColor: { default: "white", "@media (prefers-color-scheme: dark)": "#1c1c1e" },
    transitionProperty: "transform",
    transitionDuration: "150ms",
    transform: { default: "scale(1)", ":active": "scale(0.97)" },
  },
});

export function Card({ children }) {
  return <View sx={styles.card}>{children}</View>;
}
```

One file runs on Next.js (StyleX compiles it to atomic CSS) and in Expo
(`stylexn/babel` compiles it to style objects plus condition metadata that
the runtime resolves).

## Install

```sh
pnpm add stylexn @stylexjs/stylex
```

`react` and `react-native` are peer dependencies; `@babel/core` is needed
where the Babel plugin runs.

### React Native (Expo / Metro)

`babel.config.js`:

```js
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["stylexn/babel", { platform: "native" }]],
  };
};
```

The plugin compiles `stylex.create`, `stylex.keyframes` and `defineVars`,
checks every style against the compatibility table (errors when `CI` is
set, warnings otherwise), gives `defineVars` groups and `keyframes` names
ids that survive Fast Refresh, and detects the React Native version from
your `react-native` package. `stylexn` resolves to the native runtime through
the `react-native` export condition. If shared code imports
`@stylexjs/stylex` by name, alias it in `metro.config.js`:

```js
config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    context,
    moduleName === "@stylexjs/stylex" ? "stylexn/native" : moduleName,
    platform,
  );
```

### Web (Next.js or any StyleX setup)

Run `stylexn/babel` in web mode **before** `@stylexjs/babel-plugin`, and
tell StyleX that `stylexn` is an import source:

```js
plugins: [
  ["stylexn/babel", { platform: "web" }],
  ["@stylexjs/babel-plugin", { importSources: ["@stylexjs/stylex", "stylexn"] /* ... */ }],
],
```

Import the elements' stylesheet once (React Native layout defaults for
`View`, `Text`, ... on the web):

```ts
import "stylexn/elements.css";
```

## What you get

- **`stylexn`**: the StyleX API (`create`, `props`, `defineVars`,
  `createTheme`, `keyframes`, `firstThatWorks`), typed so that styles with
  no native equivalent are editor errors. On native, `useProps` and the
  elements subscribe to dimensions, colour scheme, reduced motion, theme
  context and interaction state only when a rule needs them.
- **`stylexn/elements`**: `View`, `Text`, `Pressable`, `Image`,
  `TextInput`, `ScrollView`, `FlatList`, `Switch` with an `sx` prop, DOM on
  web and React Native primitives on native, with the same props (including
  `role` and the `aria-*` attributes React Native supports). Text styles
  cascade from a `View` to nested `Text` as on the web. `TextInput`,
  `ScrollView` and `FlatList` take a `ref` for `focus()`, `scrollTo()` and
  the like; `Pressable` has `onPressIn`/`onPressOut`/`onLongPress`.
  `FlatList` is virtualised on native and a plain scrolling list on web;
  on native it also accepts every other React Native `FlatList` prop, so
  native-only code can use `initialNumToRender`, `refreshControl` and the
  like through the same component (the web element takes only the shared
  props, which keeps code in a shared package portable). Any React Native
  component also works directly with `useProps` when a wrapper is in the way.
  For safe areas use `react-native-safe-area-context` (React Native's own
  `SafeAreaView` is deprecated) and, on web, CSS `env(safe-area-inset-*)`.
- **Conditions**: `:hover`, `:active`, `:focus`, `:disabled`, `@media`
  (width, height, orientation, `prefers-color-scheme`,
  `prefers-reduced-motion`, `hover`, `pointer`), nested conditions.
- **Units and values**: `rem`, `em`, `vw`/`vh`, `calc()`/`min()`/`max()`/
  `clamp()` (folded at compile time, or at runtime for relative units and
  `var()`), `lab()`/`lch()`/`oklab()`/`oklch()`/`color()`/`color-mix()`
  converted to `rgb()`, `light-dark()`.
- **Motion**: `transition*` and `animation*` with `stylex.keyframes`, run
  on React Native's `Animated` (native driver for opacity, transform,
  colours, radii and shadows; layout keys stay on the JS driver). Easing
  keywords, `cubic-bezier()`, `steps()` and `linear()` are supported.
- **Escape hatches**: `...web({ })` and `...native({ })` inside a rule for
  platform-only declarations; later keys win, so
  `display: "flex", ...web({ display: "grid" })` is the pattern for a
  native fallback.

## Checking styles

- Types narrow `create()`, `keyframes()` and `createTheme()` from the table
  (unsupported properties, values, function names, conditions, keyframe
  selectors and theme value kinds are red in the editor).
- Lint: the `stylexn/compat` rule from `stylexn/eslint-plugin` (ESLint v9
  or oxlint `jsPlugins`), or `stylexn check <files>` for CI.
- Build: `stylexn/babel` strips web-only declarations, errors on
  unsupported ones in strict mode (`strict` option or `CI`), and compiles
  the rest.
- Runtime: values only known at render time warn once in development and
  are dropped in production.

## Testing native components

Alias `react-native` to `stylexn/testing/react-native` in Vitest or Jest and
resolve packages with the `react-native` export condition: the primitives
render DOM elements that expose their style (`styleOf`, `propsOf`), the
environment is controllable (`setWindow`, `setColorScheme`), and animations
are recorded instead of run.

## Status

0.x: the API follows StyleX; the native behaviour is documented per
property in [COMPATIBILITY.md](./COMPATIBILITY.md), rendered from the
compatibility table (`stylexn/compiler` exports it).
