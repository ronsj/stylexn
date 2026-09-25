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
- Shared components: do they use RN primitives (`View`/`Text`) rendered on web via react-native-web, or HTML-like elements (React Strict DOM style)? This decision drives StyleXN's design.

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
  - Interim: `packages/shared` ships `Hello.tsx` (StyleX, web) and `Hello.native.tsx` (RN `StyleSheet`); the native file goes away once StyleXN exists.
  - TypeScript is pinned to 6.x: 7.x (Go port) drops the JS compiler API that Next/Expo/vitest tooling still call.
- [x] Add vitest (web, shared, stylexn) and Playwright (web) with one passing test each.
  - Root `vitest.config.ts` fans out via `test.projects`; each package has its own `vitest.config.ts` (Vitest 5 no longer searches parent dirs). `pnpm test` at root runs everything; `pnpm test:e2e` runs Playwright.
  - `vitest.shared.ts` holds a small Vite plugin that runs `@stylexjs/babel-plugin` over test modules, so unit tests assert against compiled StyleX output. No `@vitejs/plugin-react` (Vite 8 compiles TSX natively; the plugin is for HMR).
  - `apps/web` must set `oxc.jsx.runtime: "automatic"` because its tsconfig has `jsx: "preserve"` for Next.
  - Playwright specs live in `apps/web/e2e/` and are excluded from Vitest's glob; the e2e test asserts the computed color, proving StyleX CSS from `packages/shared` actually ships.
- [x] Spike: prototype a component on React Strict DOM and note what's missing for our use case. See `docs/rsd-spike.md` (branch `spike/rsd` has the code).
- [x] Decide: adopt RSD vs. build StyleXN as a custom layer. **Decision: build StyleXN as a custom layer (option B in the spike doc)**, with RSD's native implementation as the reference. `react-strict-dom` is not a dependency on `main`.
  - This also sets the direction for the "Shared components" open question: RN-primitive semantics via StyleXN wrappers that render DOM on web and RN on native; react-native-web not planned. Confirm when designing the wrappers (architecture item 4).
- [ ] In `packages/stylexn`: write the compatibility table first, then shorthand expansion + last-wins merge with tests first. Babel plugin, runtime, types and lint rules can be separate entry points in the same package.
- [ ] Implement compatibility checking in the order recommended above.
