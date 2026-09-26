# Handoff: StyleXN (StyleX → React Native translation layer)

Context carried over from a claude.ai conversation (Sept 2026). Read this before starting work.

## Goal

Let components author styles with the StyleX API (`stylex.create`, `stylex.props`, `defineVars`, `createTheme`, `keyframes`) and have them render correctly on React Native (iOS/Android), while web keeps using the real StyleX compiler.

## Project setup (decided)

- **Package manager**: pnpm (workspaces)
- **Language**: TypeScript everywhere
- **Repo shape**: monorepo with two apps and two packages:

```
apps/
  web/        # Next.js, styled with StyleX (real compiler)
  mobile/     # React Native via Expo, uses StyleXN
packages/
  shared/     # cross-platform components authored with the StyleX API
  stylexn/    # StyleXN: the StyleX → RN translation layer
```

- **Linting**: oxlint
- **Formatting**: oxfmt
- **Git hooks**: lefthook, running oxlint + oxfmt on pre-commit (staged files)
- **Unit tests**: vitest for `apps/web`, `packages/shared`, and `packages/stylexn`
- **E2E tests**: Playwright for `apps/web`

### Setup notes / things to verify

- pnpm + Expo: check the current Expo monorepo docs for pnpm support. Older Expo SDKs needed `node-linker=hoisted` in `.npmrc`; newer ones may work with isolated installs.
- Metro config in `apps/mobile` must watch the workspace root and resolve `packages/*`. This is also where `@stylexjs/stylex` gets aliased to StyleXN on native (or shared code imports `stylexn` directly — see Compatibility checking).
- Next.js + StyleX: follow the StyleX Next.js install guide (Babel plugin or unplugin). `packages/shared` must be compiled by the StyleX plugin too, so include it in the plugin's scope / `transpilePackages`.
- `packages/shared` should ship source (TS) consumed by both apps, not a prebuilt bundle, so each platform's StyleX pipeline sees the raw `stylex.create` calls.
- Shared `tsconfig.base.json` at the root, with per-package extends.

### Open questions

- Mobile testing: unit tests for `apps/mobile` (vitest vs. Jest with jest-expo) and mobile E2E (e.g. Maestro or Detox) aren't decided.
- Task runner: plain `pnpm -r` / `--filter` scripts, or add Turborepo/Nx?
- ~~Shared components: RN primitives via react-native-web, or HTML-like elements?~~ Decided: RN-primitive semantics through `stylexn/elements` (`View`/`Text`/`Pressable` with an `sx` prop) that render DOM + StyleX on web and RN primitives + the runtime on native. No react-native-web.

## Key conclusion

Feasible, but not a value-by-value translation. StyleX compiles to atomic CSS class names; RN has no classes, cascade, or selectors. Keep StyleX's _authoring API_ and replace its _output backend_: emit style objects + condition metadata, resolved at runtime against device/theme/interaction state.

## Prior art — evaluate FIRST

- **React Strict DOM** (Meta, MIT): https://github.com/facebook/react-strict-dom — essentially this project. `css.create` is StyleX; native polyfills exist. Uses `html.div`-style elements, not `View`/`Text`. Still 0.0.x. Read its COMPATIBILITY.md; it's a ready-made gotcha list.
- Adjacent (different syntax): NativeWind, Tamagui, Unistyles.
- Build our own only if we need StyleX styles on plain RN components / third-party RN libs. Even then, use RSD's native implementation as reference.

## Gotchas to design for

- **Conditions need runtime state**: `:hover/:focus/:active` → Pressable/focus tracking; media queries → `useWindowDimensions`; `prefers-color-scheme` → `useColorScheme`; `prefers-reduced-motion` → `AccessibilityInfo`. No native equivalent for container queries, `@supports`, `::before/::after`, `stylex.when.*` (emulate via context or reject).
- **Variables/themes**: no `var()` in RN. `defineVars` → React context; `createTheme` → subtree provider.
- **Units**: `px` strings → numbers; `rem` needs a configured root size; `em` needs inherited font size; `vw/vh` need dimensions; `calc()` unsupported (evaluate simple cases or reject).
- **Inheritance**: only nested `<Text>` inherits text styles in RN; `color` on a View doesn't cascade. Fake via context if needed.
- **Layout defaults differ**: RN defaults `flexDirection: 'column'`, `flexShrink: 0`, `position: 'relative'`; limited `display` values. zIndex quirks outside flexbox.
- **Shorthands**: RN rejects multi-value strings (`margin: '10px 20px'`, `border`, `font`). Expand to longhands at compile time so merge = last-longhand-wins (matches StyleX semantics).
- **Version-dependent support**: boxShadow, filter, boxSizing, logical props, gradients depend on RN version / New Architecture. Newer color functions (oklch, color-mix) may not parse.
- **Animations**: keyframes/transition/animation need Animated or Reanimated.
- **Style → props**: e.g. `::placeholder` color → `placeholderTextColor`, caret-color → `cursorColor`. `props()` must return more than `{ style }`.

## Proposed architecture

1. **Module swap**: Metro resolver alias (or `.native.js`) so `@stylexjs/stylex` resolves to our implementation on native.
2. **Babel plugin (compile step)**: validate `stylex.create`, expand shorthands, normalize context-free units, split each rule into static + conditional parts, e.g.
   `{ backgroundColor: { default: 'gray', ':hover': 'blue', '@media (min-width: 800px)': 'red' } }`
   → `{ static: {...}, conditional: [{ prop, when, value }], usesVars: true }`
3. **Runtime `props()`**: merge args in order (last wins) → evaluate conditions against context → resolve vars → context-dependent unit conversion → return `{ style, ...extraProps }`.
4. **Hook / wrappers**: `useStyleX(...)` or `<SxView>/<SxText>` that subscribe to dimensions, color scheme, theme context, and interaction state — only when compiled metadata says a condition exists.
5. **Guardrails**: see Compatibility checking below; plus snapshot tests of compiled output against the target RN version.

## Compatibility checking (requirement)

StyleXN must detect styles that don't work on React Native and surface them as early as possible: IDE, lint, build, and finally runtime. Recommended design: **one compatibility table, several enforcement layers.**

### Single source of truth

A typed data file in `packages/stylexn` (e.g. `src/compat/table.ts`) describing every CSS property, value pattern, unit, pseudo-class, at-rule and StyleX API, each with a status:

- `supported` — maps directly to RN
- `polyfilled` — StyleXN emulates it at runtime (e.g. `:hover`, media queries, `rem`)
- `partial` — some values only (e.g. `display`), with the allowed values listed
- `web-only` — valid on web, deliberately ignored on native (not an error)
- `unsupported` — no reasonable native behavior (e.g. container queries, `::before`)

Optionally key entries by minimum RN version so the table can be checked against the Expo SDK's RN version. Every layer below reads this table, so they never disagree.

### Layer 1: TypeScript (IDE, instant)

Shared code imports from `stylexn` instead of `@stylexjs/stylex`. On web, `stylexn` re-exports StyleX (configure the StyleX compiler's `importSources` to recognize `stylexn`, so it still compiles to CSS). Its `create()` type is narrowed from the table, so unsupported properties or conditions are type errors in the editor. Types can't catch everything (e.g. `calc()` inside a string, dynamic values), so this is a fast first line, not the authority.

### Layer 2: Lint (IDE + pre-commit via lefthook)

A rule set that walks `create()` calls and checks string values, units, at-rules and pseudo-selectors against the table: the things types can't express. Target oxlint's JS plugin support; verify its current maturity. If it's not sufficient, ship the same checks as a standalone `stylexn check` CLI and run it from lefthook and CI.

### Layer 3: Build (authoritative)

The StyleXN Babel plugin runs the same checks during the Metro build:

- `unsupported` → build error in strict mode (CI), warning + stripped otherwise
- `web-only` → silently stripped from native output
- `polyfilled` / `partial` → compiled to the runtime path

### Layer 4: Runtime (last resort)

For values only known at render time (dynamic styles, variable values): dev-only `console.warn` with the component and property; in production, drop the value silently. Never crash.

### Escape hatches

Authors need an explicit way to say "this is intentionally web-only" or to give a native alternative, rather than disabling checks — e.g. `stylexn.web({...})` / `stylexn.native({...})` helpers, or a per-rule platform override. An inline ignore comment should exist but be discouraged.

### Recommendation

Build Layer 3 first (it's the source of truth and needed anyway), then Layer 1 (cheap, high value), then Layer 2, with Layer 4 as a thin runtime guard. All four test against the same fixtures.

## Suggested first steps in Claude Code

- [x] Scaffold the pnpm monorepo: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, oxlint + oxfmt config, `lefthook.yml`.
- [x] Create `apps/web` (Next.js + StyleX) and `apps/mobile` (Expo). Get both running with a trivial component imported from `packages/shared`.
  - Web: Next 16 (Turbopack) + `@stylexjs/babel-plugin` + `@stylexjs/postcss-plugin`; `transpilePackages` + an explicit postcss `include` glob make the compiler reach `packages/shared`.
  - Mobile: Expo SDK 57 / RN 0.86 / React 19.2.3 (pinned across the workspace), isolated pnpm installs, no custom Metro config needed.
  - TypeScript is pinned to 6.x: 7.x (Go port) drops the JS compiler API that Next/Expo/vitest tooling still call.
- [x] Add vitest (web, shared, stylexn) and Playwright (web) with one passing test each.
  - Root `vitest.config.ts` fans out via `test.projects`; each package has its own `vitest.config.ts` (Vitest 5 no longer searches parent dirs). `pnpm test` at root runs everything; `pnpm test:e2e` runs Playwright.
  - `vitest.shared.ts` holds a small Vite plugin that runs `@stylexjs/babel-plugin` over test modules, so unit tests assert against compiled StyleX output. No `@vitejs/plugin-react` (Vite 8 compiles TSX natively; the plugin is for HMR).
  - `apps/web` must set `oxc.jsx.runtime: "automatic"` because its tsconfig has `jsx: "preserve"` for Next.
  - Playwright specs live in `apps/web/e2e/` and are excluded from Vitest's glob; the e2e test asserts the computed color, proving StyleX CSS from `packages/shared` actually ships.
- [x] Spike: prototype a component on React Strict DOM and note what's missing for our use case. See `docs/rsd-spike.md` (branch `spike/rsd` has the code).
- [x] Decide: adopt RSD vs. build StyleXN as a custom layer. **Decision: build StyleXN as a custom layer (option B in the spike doc)**, with RSD's native implementation as the reference. `react-strict-dom` is not a dependency on `main`.
  - This also sets the direction for the "Shared components" open question: RN-primitive semantics via StyleXN wrappers that render DOM on web and RN on native; react-native-web not planned. Confirm when designing the wrappers (architecture item 4).
- [x] In `packages/stylexn`: write the compatibility table first, then shorthand expansion + last-wins merge with tests first. Babel plugin, runtime, types and lint rules can be separate entry points in the same package.
  - Done: `compat/` (table + lookups), `expand/` (shorthands, specificity-aware merge), `lower/` (RN keys, derived props, post-merge finalize), `check/` (findings), `compile/` (rule → `{ static, conditional, props, depth, usesVars }`), `babel/` (`stylexn/babel`), `runtime/` (`stylexn` on native via the `react-native` export condition; `stylexn/native` is the Metro alias target for `@stylexjs/stylex`), `elements/` (`View`/`Text`/`Pressable` with an `sx` prop: DOM + StyleX on web, RN primitives + `useProps` on native).
  - End to end: `packages/shared/src/Hello.tsx` is one file for both platforms (vars with a dark variant, media query, `:active`/`:hover`, derived props) and runs on Next (real StyleX, `importSources: ["stylexn"]`) and in the iOS simulator through the plugin + runtime.
  - Merge semantics are StyleX's `property-specificity` (also Yoga's); later condition keys win within a rule.
  - Not yet: transitions/animations/keyframes (dropped with a one-time warning), compile-time color conversion (oklch etc.), `calc()` folding. See "Next steps".
- [x] Implement compatibility checking in the order recommended above. Layer 3 (build) is done: `stylexn/babel` errors in strict mode (`CI` set) and warns + strips otherwise; Layer 4 is the runtime's one-time warnings. Layer 1 (types) is done: `create()` on both entries is narrowed by `packages/stylexn/src/types` (derived from the table's literal types), with type-level tests in `types.typecheck.ts` run by `tsc`. Layer 2 (lint) is done: oxlint's `jsPlugins` (ESLint v9-compatible, alpha, loads `.ts` plugin files on Node ≥22.18) runs `stylexn/compat` from `packages/stylexn/src/lint/eslint-plugin.ts` on `packages/shared/**` (so the editor and the lefthook pre-commit both see it), and `stylexn check` (`pnpm check:styles`) is the same core as a CLI for CI. Web-only styles are exempt from lint by default.
  - Escape hatches are done: `...web({ })` and `...native({ })` spreads inside a rule (from `stylexn`). `web` blocks are inlined by `stylexn/babel` in `platform: "web"` mode (which must run before `@stylexjs/babel-plugin`) and dropped on native without checks; `native` blocks are dropped on web and, on native, exempt from the compat check except for table-listed unsupported properties (React Native-only keys such as `elevation` are allowed). Types brand the blocks (`Web<>`/`Native<>`) so Layer 1 skips them; lint and CLI treat native blocks as trusted; the uncompiled runtime path marks `native()` values so runtime compilation trusts them too. Later keys win, so `display: "flex", ...web({ display: "grid" })` is the native-alternative pattern. Inline ignores exist but are discouraged: `// oxlint-disable-next-line stylexn/compat` for lint, `// stylexn-ignore` for the CLI. Helper _functions_ wrapping `stylex.create` were rejected because StyleX only compiles literal `create` calls.
  - `packages/stylexn` now has a build step (`scripts/build.mjs`, esbuild): the Babel plugin, compiler, ESLint plugin, CLI and bin are bundled to `dist/` (run by the root `prepare` on install) because Next's Babel worker refuses `.ts` plugin files; runtime/elements/web entries stay as source.

## Status at the end of the first session (2026-09-25)

Everything in the checklist above is done and committed on `main`. `packages/shared/src/Hello.tsx` is a single-source component (vars with a dark variant, media query, `:hover`/`:active`, derived props, `web()`/`native()` hatches) that runs on Next through the real StyleX compiler and in the iOS simulator through `stylexn/babel` + the runtime. All four checking layers exist and read one table.

Verification commands (all green at the end of the session):

```
pnpm install            # also builds packages/stylexn/dist via the root prepare script
pnpm test               # Vitest, all projects (257 tests) incl. an oxlint jsPlugins integration test
pnpm typecheck          # all packages; also runs the type-level tests in packages/stylexn/src/types/types.typecheck.ts
pnpm lint && pnpm format:check
pnpm check:styles       # stylexn check over packages/shared
pnpm --filter @stylexn/web build && pnpm test:e2e
pnpm --filter @stylexn/mobile exec expo export --platform ios
```

Package map (`packages/stylexn/src`): `compat/` table + lookups · `expand/` shorthands + specificity merge · `lower/` RN keys, derived props, post-merge finalize · `check/` findings · `compile/` rule compiler · `babel/` plugin (`stylexn/babel`, native and web modes) · `runtime/` StyleX API on native (`stylexn` via the `react-native` export condition, `stylexn/native` for the Metro alias) · `elements/` View/Text/Pressable · `types/` Layer 1 · `lint/` shared extractor + ESLint/oxlint rule · `cli/` `stylexn check`. Tooling entries are bundled to `dist/` by `scripts/build.mjs`.

## Status at the end of the second session (2026-09-26)

Items 1–8 of the previous plan are done and committed on `main` (last commit: see `git log`); the iOS app was re-verified in the simulator and the web e2e passes against both the dev server and the production build.

- **CI**: `.github/workflows/ci.yml` (three jobs: lint/types/unit tests, web build + Playwright against `next start`, strict Expo export), running on the private repo `ronsj/react-stylexn-app`. First run caught that `check:styles` must call `node packages/stylexn/dist/bin.mjs` directly: pnpm links workspace bins before the root `prepare` builds `dist/`, so the `stylexn` bin is missing on a fresh install. `apps/web/playwright.config.ts` honours `PORT` so a second run can avoid a dev server already on 3000.
- **Animation runtime** (`runtime/motion.ts`, `runtime/animated.ts`, `runtime/keyframes.ts`): built on React Native's `Animated` (JS driver) rather than Reanimated: no dependencies, works in Expo Go. `resolve()` now parses `transition*`/`animation*` into specs; `useProps` runs a per-element `MotionController` (allocated only when the rules mention motion) and returns `animated: true` while nodes are attached, which makes the elements render `Animated.View`/`Animated.Text`/an animated Pressable. Transform strings are parsed to the array form so parts interpolate (functions must match across values). `stylex.keyframes` frames are compiled by `stylexn/babel` like rules (so they get the compat checks) and registered by name. Honours `prefers-reduced-motion` (transitions jump, animations rest at their end state). Documented simplifications in `animated.ts`: interrupted string/color transitions restart from the nearer end; the first frame shows during an animation's delay; pausing then resuming restarts; `steps()` runs as linear; no native driver.
- **Stable variable ids**: `stylexn/babel` injects `defineVars(values, "v<hash>")` (FNV-1a of the file path relative to the plugin's `rootDir`/cwd plus the export name), and `runtime/vars.ts` re-registers a group under the same id on Fast Refresh so old references keep resolving.
- **Text inheritance**: `View`/`Pressable` move `INHERITED_TEXT_KEYS` (color, font*, lineHeight, textAlign, textTransform, textShadow*, writingDirection, letterSpacing) off their own style into `TextStyleProvider`; `Text` merges the inherited values under its own. `em` resolves against the inherited `fontSize`. Caveat: `lineHeight` inherits as the resolved number, not as a multiplier.
- **Platform**: `useProps` reads `Platform.OS`. Android has still not been exercised (no Android SDK on this machine).
- **`rnVersion` default**: `src/node/rn-version.ts` resolves `react-native/package.json` from the file's directory, then the cwd; the Babel plugin, lint rule and CLI all use it, falling back to `RN_TARGET`. `compile/versions.test.ts` snapshots compiled output for 0.74/0.76/0.86.
- **Compile-time value folding** (`lower/fold.ts`, `lower/color.ts`): `calc()/min()/max()/clamp()` fold when every operand is a bare number, absolute length or percentage (nested functions and parentheses included); mixed `%`/length, relative units and `var()` are dropped with a diagnostic (a strict-build error). `lab()/lch()/oklab()/oklch()/color(srgb|srgb-linear|display-p3)/color-mix(in srgb|srgb-linear|oklab|oklch)` convert to `rgb()`/`rgba()` (clipped, no gamut mapping; `color-mix` operands must be hex/functional colors, not named). `light-dark(a, b)` is rewritten into a `prefers-color-scheme` conditional before shorthand expansion. The checker only reports math/color functions it cannot make static, so lint stays quiet for the foldable cases.
- **More elements** (`elements/types.ts`, `elements/native.ts`, `elements/web.ts`): `Image` (`src`/`alt`; native wraps `{ uri }`), `TextInput` (`onChangeText`, `secureTextEntry`, `multiline`, `disabled`; style-derived `placeholderTextColor`/`cursorColor` land as props on native, `::placeholder`/`caretColor` stay CSS on web) and `ScrollView` (`sx` for the container, `contentSx` for the content, `horizontal`). Prop types are shared between the two implementations, including an accessibility allowlist (`role` and the `aria-*` React Native supports) that passes through unchanged on both sides. The RSD-spike percentage-width overflow does not reproduce with StyleXN's elements (it was RSD's block-layout polyfill): `Hello`'s `width: 100%` root fits a padded parent on iOS.
- **Android** (verified 2026-09-26 on an Android 15 arm64 emulator through Expo Go): layout, all elements, the pulse animation, the press transition, and dark mode through variables all behave as on iOS, with no runtime warnings. `verticalAlign: "middle"` on the chips and `elevation: 2` from the `native()` block are exercised. Findings: (1) Android draws `elevation` shadows through a view without an opaque `backgroundColor` (the demo card now has one); (2) a real plugin bug: computed condition keys (`[DARK]`) failed in Metro builds because Babel runs every plugin in one traversal and a preset's block-scoping plugin had already rewritten the `const` to `var`; `stylexn/babel` now accepts any never-reassigned binding (`binding.constant`).
- **Layer 1 fix found on the way**: function-syntax strings (`rotate(45deg)`, `var()`, `calc()`) are now accepted by the types for any property; the build check judges them. Before this, `transform` strings were type errors.

## Next steps

A checklist, roughly in priority order; each unchecked item is independent enough to start with. Details for the checked ones are in the status sections above.

- [x] **CI.** `.github/workflows/ci.yml`; pushed to the private repo `ronsj/react-stylexn-app` and green.
- [x] **Animation runtime.** Transitions and `stylex.keyframes` on React Native's `Animated`.
- [x] **Stable variable ids under Fast Refresh.** Injected by `stylexn/babel`.
- [x] **Text style inheritance.** `TextStyleProvider`; View/Pressable/ScrollView cascade to nested Text.
- [x] **Platform correctness (iOS).** `useProps` reads `Platform.OS`.
- [x] **Compile-time value folding.** `calc()`-style math, CIE/OK/`color-mix()` colors, `light-dark()`.
- [x] **More elements.** `Image`, `TextInput`, `ScrollView`, shared accessibility props.
- [x] **Automatic `rnVersion`.** Detected from the installed `react-native`; per-version snapshots.
- [x] **Android.** Emulator installed and the app verified on Android 15 (see the status section below).
- [ ] **Folding follow-ups.** `calc()` with relative units could resolve at runtime (`rem`/`em`/`vw` are already runtime units); `color-mix` with named colors needs a named-color table (React Native's `@react-native/normalize-color` has one); functions nested inside `transform()` arguments are not folded.
- [ ] **Element follow-ups.** `TextInput` keyboard/return-key props, `onFocus`/`onBlur` callbacks for authors (the runtime owns them today), `Image` loading states and local `require()` sources, `ScrollView` scroll events; cross-platform text defaults (native `Text` does not shrink in a row: authors set `flexShrink: 1`, or the web base could stop shrinking to match).
- [ ] **Animation follow-ups.** Native driver for `opacity`/`transform`-only transitions; resume-from-current for paused animations; base style during delay with `fill-mode: none`; `transition` on a key that disappears from the style (CSS animates to the initial value, StyleXN jumps).
- [ ] **Mobile testing (open question).** Unit tests for `apps/mobile` (vitest with mocked `react-native`, as the runtime tests do, vs. jest-expo) and E2E (Maestro is the lighter option with Expo Go). The runtime hooks, elements and the motion controller are tested with `@testing-library/react`, a mocked `react-native` and `runtime/fake-animated.ts`.
- [ ] **Publishing shape.** `exports` for `compiler`/`babel`/`eslint-plugin`/`check` point at `dist` with `types` conditions back to `.ts` source; a published package needs generated `.d.ts` (e.g. `tsc --emitDeclarationOnly` or tsdown), a README, and a decision on whether runtime/elements ship prebuilt too. Pin `oxlint` while `jsPlugins` is alpha.
- [ ] **Lint scope.** `stylexn/compat` is enabled for `packages/shared/**` only (web-only code is exempt by design). With the hatches in place, consider enabling it for any other package that is meant to be cross-platform, and add `reportWebOnly` in CI if web-only leakage into shared code should be visible.
- [ ] **Task runner (open question).** Plain `pnpm -r`/`--filter` scripts have been enough; revisit only if CI time or the root `prepare` build becomes a problem.

## Working notes / gotchas learned

- **Running the iOS app from an agent shell**: `expo start --ios` crashes (Expo CLI AppleScripts Simulator.app, denied). Use `pnpm exec expo start` (without `CI=1`, which disables watch mode), then `xcrun simctl boot "<device>"` and `xcrun simctl openurl booted exp://127.0.0.1:8081`; Expo Go shows a first-run dev-menu sheet. `pnpm --filter @stylexn/mobile ios` works from a normal terminal.
- **Dark mode on the simulator**: the Expo template pins `userInterfaceStyle: "light"`, which makes `Appearance.getColorScheme()` always return light; it is now `automatic`. Toggle with `xcrun simctl ui booted appearance dark`.
- **Babel plugin file format**: Next's Babel worker refuses `.ts` plugin files (Metro accepted them only thanks to Node type stripping), hence the `dist/` build. Everything in `packages/stylexn/src` must stay erasable-syntax TypeScript (no parameter properties, enums, namespaces) so Node and oxlint can load the source directly.
- **Plugin order on web**: `["stylexn/babel", { platform: "web" }]` must precede `@stylexjs/babel-plugin` (it rewrites the `create` argument in `Program.enter`); the PostCSS plugin reuses the same plugin list from `babel.config.js`.
- **StyleX facts that shaped the design**: only literal `stylex.create({ })` calls compile (no wrappers, no spreads unless rewritten first); `defineVars` must live in `*.stylex.ts` files as named exports; default `styleResolution` is `property-specificity`, which Yoga also follows — the runtime merge mirrors it via per-key shorthand `depth`; `StyleXVar` is a branded string on web.
- **React Native facts (0.86)**: `display` is only `flex | none | contents`, `position` has `static` but no `sticky`/`fixed`, `overflow` has no `auto`, logical properties are native, `backgroundImage` is `experimental_backgroundImage` (gradients only), `transform` strings are accepted, `lineHeight` numbers are dp (so CSS multipliers become `em` strings for the runtime).
- **Tooling**: TypeScript stays on 6.x (7.x drops the JS compiler API tooling needs); React is pinned to 19.2.3 everywhere (Expo 57); Vitest 5 needs a per-package config and explicit Testing Library `cleanup` (`vitest.setup.ts`); `apps/web` needs `oxc.jsx.runtime: "automatic"` in its Vitest config; pnpm writes `allowBuilds` placeholders into `pnpm-workspace.yaml` on install — set them to `true`/`false` rather than adding a second key.
- **Decision record**: `docs/rsd-spike.md` (React Strict DOM evaluated and rejected as a dependency, kept as reference; branch `spike/rsd`).
- **Expo Go keeps the last bundle**: after starting a new Metro, `simctl openurl` alone does not refetch if Expo Go already has the project open; `xcrun simctl terminate booted host.exp.Exponent` first, then `openurl`. Metro logs "iOS Bundled" once the app actually requested the bundle.
- **Leftover dev servers**: a `next dev` from a previous session may still hold port 3000 (Playwright then refuses to start its own in CI mode). Run `PORT=3100 CI=1 pnpm test:e2e` instead of killing it from an agent session.
- **Vitest resolution quirk**: inside Vitest, `createRequire("/x")` resolved `react-native` even from `/` (module resolution is patched), so tests for `detectRNVersion` use a temp project with a fake `node_modules/react-native` rather than asserting "not found".
- **oxlint `react(refs)`** rejects `ref.current` reads during render; use the `useState` derived-state pattern (see `useShallowStable` in `runtime/hooks.ts`) or a controller object held in state (`useMotion`).
- **Layer 1 and function syntax**: the types cannot match `rotate()`/`calc()`/`var()` strings against the table's function-name lists, so any `name(...)` string is accepted at the type level and judged by the build check.
- **Android toolchain on this Mac** (installed 2026-09-26, no Android Studio): `brew install openjdk@17` and `brew install --cask android-commandlinetools`; SDK in `~/Library/Android/sdk` (Expo's default) via `sdkmanager --sdk_root=$ANDROID_HOME --install "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis;arm64-v8a" "cmdline-tools;latest"`, with `JAVA_HOME=/opt/homebrew/opt/openjdk@17`. Use the `avdmanager` under `$ANDROID_HOME/cmdline-tools/latest/bin` (the Homebrew one looks for images in the Homebrew prefix). AVD `stylexn` (pixel_7). Boot headless from an agent shell with `$ANDROID_HOME/emulator/emulator -avd stylexn -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect`, then `pnpm exec expo start --android` from `apps/mobile` installs Expo Go and opens the project (works from the sandbox, unlike `--ios`). Screenshots: `adb exec-out screencap -p > file.png`; dark mode: `adb shell cmd uimode night yes|no`.
- **Expo Go on Android is `host.exp.exponent`** (lower-case; iOS is `host.exp.Exponent`). `am force-stop`/`pm clear` with the wrong case silently do nothing, and a stale "Failed to compile" screen survives relaunches until the process is actually stopped. After changing `packages/stylexn` (the plugin is loaded once per Metro worker), restart Metro; `--clear` alone is not enough for the device to refetch. In a monorepo the bundle URL is `http://localhost:8081/apps/mobile/index.bundle?platform=android`.
- **Babel plugins share one traversal**: do not depend on the source being untransformed when the plugin's visitor runs (`const` may already be `var`, JSX may be gone). Use scope information (`binding.constant`) rather than syntax.
