# Handoff: StyleXN (StyleX → React Native translation layer)

Project context for new sessions. Read this first; the README (`packages/stylexn/README.md`), `packages/stylexn/COMPATIBILITY.md`, the docs site and `git log` hold the details of what has been built.

## What this is

Components author styles with the StyleX API (`stylex.create`, `stylex.props`, `defineVars`, `createTheme`, `keyframes`, `defineMarker`) and render correctly on React Native (iOS/Android), while the web keeps using the real StyleX compiler. StyleXN keeps StyleX's authoring API and replaces its output backend on native: style objects plus condition metadata, resolved at runtime against device, theme and interaction state.

## Key decisions

- **Build StyleXN ourselves, do not adopt React Strict DOM.** RSD was spiked and rejected as a dependency; it stays a reference for native behaviour. Record: `docs/rsd-spike.md`, code on branch `spike/rsd`. No react-native-web either.
- **StyleX on web, a runtime on native.** Shared code imports `stylexn`. On web it re-exports StyleX (`importSources: ["stylexn"]`); on native the `react-native` export condition resolves the runtime, and `stylexn/native` is the Metro alias target for `@stylexjs/stylex`.
- **One compatibility table** (`packages/stylexn/src/compat/table.ts`) drives all four checking layers: types (Layer 1), the `stylexn/compat` oxlint rule and `stylexn check` CLI (Layer 2), `stylexn/babel` (Layer 3: error in strict mode, i.e. `CI` set, otherwise warn and strip) and one-time runtime warnings (Layer 4). Escape hatches are `...web({ })` / `...native({ })` spreads inside a rule; helper functions wrapping `stylex.create` were rejected because StyleX only compiles literal `create` calls.
- **Lint scope**: `stylexn/compat` runs with `reportWebOnly` on everything that executes on native (`packages/shared/**`, `apps/example-mobile/**`), so a web-only declaration outside `web({ })` is an error. `apps/example-web` and StyleXN's own web implementation are exempt.
- **Elements** (`stylexn/elements`: View, Text, Pressable, Image, TextInput, ScrollView, FlatList, Switch, with an `sx` prop) render DOM + StyleX on web and React Native primitives + the runtime on native, with React Native semantics on both (e.g. web `Text` has `flexShrink: 0`). They are a convenience: any React Native component works with `useProps`. They expose one shared prop surface on both platforms; native-only React Native props go to the primitive with `useProps` (and `TextStyleProvider` for the text cascade). This may change later.
- **State beyond the element's own styles.** Element props drive the form-state conditions (`:checked` from a Switch's `value`, `:placeholder-shown`/`:read-only` from a TextInput's props). `when.ancestor(pseudo, marker)` reads a marked ancestor: a marker in `sx` wraps the element in `MarkerProvider`, whose context value is a stable store, so a state change re-renders the subscribed descendants and not the subtree. The accessibility settings (reduced motion, contrast, transparency, inverted colours) share one store and one `useSyncExternalStore` slot in `useProps`, with native listeners attached per setting while an element needs it. Descendant and sibling `when.*` kinds, structural pseudo-classes and the validity form states stay unsupported because React Native exposes nothing to back them.
- **Compile-time mappings read the value.** Properties that become component props (`textOverflow`, `lineClamp`, the scroll-snap and overscroll group, `scrollPadding`, `hyphens`) and `fontFeatureSettings` are lowered by inspecting the value, so a `var()` or style-function argument is a diagnostic. Scroll-snap values go on the scroll container's `sx`, not on the children as in CSS. `env(safe-area-inset-*)` rewrites to a built-in variable group (`stylexn-env`, defaults 0 as browsers report on rectangular screens) that `SafeAreaInsetsProvider` sets per subtree; feed it react-native-safe-area-context, StyleXN measures nothing and takes no dependency. `lh` resolves at compile time against the rule's own static `lineHeight`.
- **Animation** uses React Native's `Animated` (no Reanimated): no dependencies, works in Expo Go. Layout keys stay on the JS driver until React Native's shared-backend flag ships by default.
- **Mobile testing**: Vitest for unit tests (one runner for the repo, `react-native` aliased to `stylexn/testing/react-native`); Maestro against Expo Go for end-to-end.
- **Publishing shape**: in the repo, `exports` point at `src`; `publishConfig.exports` swaps to `dist` on pack/publish. Tooling entries (babel, compiler, eslint-plugin, check, bin) are esbuild bundles because Next's Babel worker refuses `.ts` plugin files; consumer entries are per-file `tsc` output so the app and the elements share one runtime instance; web elements ship precompiled as `stylexn/elements.css`. Still `private`, version 0.1.0.
- **No task runner** (no Turborepo/Nx): plain `pnpm -r` / `--filter` scripts. When decided, CI took 76–92 s wall clock and the local checks ~9 s; revisit if the package count grows past a handful or a job crosses a few minutes.
- **Pinned versions**: TypeScript stays on 6.x (7.x, the Go port, drops the JS compiler API that Next/Expo/Vitest tooling calls). React is pinned to exactly 19.2.3 in every package (Expo SDK 57 pins it; a second React copy crashes React Native). Expo SDK 57 / React Native 0.86, Next 16 (Turbopack). `oxlint` is pinned to `1.85.0` while `jsPlugins` is alpha. StyleX on Next uses `@stylexjs/babel-plugin` + `@stylexjs/postcss-plugin`, not the stale `@stylexjs/nextjs-plugin`.

## Repo layout

```
apps/
  example-web/     # Next.js, real StyleX compiler (port 3000)
  example-mobile/  # Expo app on the StyleXN runtime; Maestro flow in e2e/todo.yaml
  docs-site/       # documentation site, Next.js static export (port 3001)
packages/
  shared/     # cross-platform components and the docs' live examples (src/examples/)
  stylexn/    # the library: compat/ expand/ lower/ check/ compile/ babel/ runtime/ elements/ types/ lint/ cli/ testing/
docs/rsd-spike.md
```

- pnpm workspaces with isolated installs (no `node-linker=hoisted`, no custom Metro config). `packages/shared` ships TS source so each platform's pipeline sees raw `stylex.create` calls.
- oxlint + oxfmt, run on staged files by lefthook at pre-commit. Vitest projects fan out from the root `vitest.config.ts`; each package has its own config (Vitest 5 does not search parent dirs).
- The docs site builds its pages from the repo at build time (README code blocks, example sources, `COMPATIBILITY.md`, element prop types, live output of the checks), so nothing there is a hand copy; unit tests fail when those sources drift.
- The docs site dogfoods the library: its own chrome imports `stylexn`, not `@stylexjs/stylex`, so its styles pass the Layer 1 types like shared code, and its CSS-only declarations (`position: sticky`, `overflowY`, `scrollMarginTop`, ...) sit in `...stylex.web({ })`. Semantic HTML (headings, links, lists, tables, code) stays HTML styled with `stylex.props`; keep new site code on the same footing.
- CI (`.github/workflows/ci.yml`, private repo `ronsj/react-stylexn-app`, runs on push): check (lint, types, unit, check:styles, compat and pack checks), web build + Playwright, docs build + Playwright, strict Expo iOS export.

## Commands

```
pnpm install                    # root prepare also builds packages/stylexn/dist
pnpm verify                     # lint, format:check, typecheck, test, check:styles, compat:check, pack:check
pnpm test:e2e                   # Playwright, example-web
pnpm test:e2e:docs              # Playwright, docs-site
pnpm build:docs                 # static export to apps/docs-site/out
pnpm --filter @stylexn/docs-site dev          # port 3001
pnpm --filter stylexn compat:docs             # regenerate COMPATIBILITY.md after editing the table
pnpm --filter stylexn bench                   # useProps benchmark; compare against the floor row, not absolute values
pnpm --filter @stylexn/example-mobile exec expo export --platform ios   # what CI's mobile job checks
pnpm --filter @stylexn/example-mobile test:e2e                          # Maestro; needs Metro and a booted simulator
```

Commits: subject line only, imperative mood, no Conventional Commits prefixes (see `git log`).

## Running on devices from an agent shell

- **iOS simulator**: `expo start --ios` crashes (Expo CLI AppleScripts Simulator.app, denied). Run `pnpm exec expo start` in `apps/example-mobile` (without `CI=1`, which disables watch mode), then `xcrun simctl boot "<device>"` and `xcrun simctl openurl booted exp://127.0.0.1:8081`. Expo Go shows a first-run dev-menu sheet. From a normal terminal `pnpm --filter @stylexn/example-mobile ios` works. Dark mode: `xcrun simctl ui booted appearance dark`.
- **Expo Go keeps the last bundle**: after starting a new Metro, `xcrun simctl terminate booted host.exp.Exponent` before `openurl`. Metro logs "iOS Bundled" once the app actually requested the bundle. After changing `packages/stylexn`, restart Metro (the plugin is loaded once per worker); `--clear` alone does not make the device refetch.
- **Android emulator** (no Android Studio): `brew install openjdk@17` and `brew install --cask android-commandlinetools`; SDK in `~/Library/Android/sdk` via `sdkmanager --sdk_root=$ANDROID_HOME --install "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis;arm64-v8a" "cmdline-tools;latest"`, `JAVA_HOME=/opt/homebrew/opt/openjdk@17`. Use the `avdmanager` under `$ANDROID_HOME/cmdline-tools/latest/bin` (the Homebrew one looks for images in the Homebrew prefix). AVD `stylexn` (pixel_7). Boot headless with `$ANDROID_HOME/emulator/emulator -avd stylexn -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect`, then `pnpm exec expo start --android` in `apps/example-mobile` (works from the sandbox, unlike `--ios`). Screenshots: `adb exec-out screencap -p > file.png`; dark mode: `adb shell cmd uimode night yes|no`.
- **Expo Go on Android is `host.exp.exponent`** (lower-case; iOS is `host.exp.Exponent`). `am force-stop`/`pm clear` with the wrong case silently do nothing, and a stale "Failed to compile" screen survives relaunches until the process is stopped. Monorepo bundle URL: `http://localhost:8081/apps/example-mobile/index.bundle?platform=android`.
- **Physical iPhone via Expo Go**: QR for `exp://<LAN IP>:8081` (`ipconfig getifaddr en0`; `qrencode -o qr.png "exp://..."`), phone on the same Wi-Fi. Expo Go refuses the project unless the phone's Expo Go **and** the CLI (`expo login`, `expo whoami`) are signed in to the same account, and Metro must be restarted after the CLI login.
- **Maestro**: `brew trust --formula mobile-dev-inc/tap/maestro && brew install mobile-dev-inc/tap/maestro` (plain `brew install maestro` installs an unrelated cask). Needs `JAVA_HOME` (`/opt/homebrew/opt/openjdk`); `MAESTRO_CLI_NO_ANALYTICS=1` silences telemetry. Failure artefacts land in `~/.maestro/tests/<timestamp>/`.

## Working notes and gotchas

Verification:

- **Screenshots do not verify motion.** A still proves one frame, not continuity. Anything that touches an attached Animated node, retargeting or the driver choice needs a person watching it move (the simulator is fine) or a numeric continuity test like those in `runtime/animated.test.ts`. The press-animation jitter was visible on the simulator all along but was "verified" by screenshots.
- Some behaviour is verified by unit tests only, not on a device: stable keyframes ids under Fast Refresh, and the second round of animation work (pause during a delay, `steps()`/`linear()` on the native driver, the widened native-driver keys).
- React Native forbids mixing Animated drivers on one component, and switching an element between plain and Animated components remounts the native view. The first was caught only by Maestro, not by unit tests.
- The example apps render the shared todo app (`packages/shared/src/todo`), so the Expo export, Maestro (`apps/example-mobile/e2e/todo.yaml`) and Playwright exercise form states, ancestor conditions, `env()` insets, transitions and keyframes on a device and in a browser. Still unit-tested only: the prop mappings and the accessibility media features. Native storage is `expo-sqlite/localStorage/install` (first import of the mobile entry; a no-op on web), so shared code uses `localStorage` directly.

StyleX and Babel:

- Only literal `stylex.create({ })` calls compile. `defineVars` must be a named export of a `*.stylex.ts` file, including in tests: the docs site's PostCSS `include` glob covers all of `packages/shared/src`, test files too, so an inline `defineVars` in a shared test breaks the docs build.
- `packages/stylexn/src/web.ts` ships uncompiled, so it cannot call `stylex.create` itself.
- `["stylexn/babel", { platform: "web" }]` must precede `@stylexjs/babel-plugin`; each app's PostCSS config reuses the plugin list from its `babel.config.js`. Next also needs `transpilePackages` and an explicit PostCSS `include` glob to reach `packages/shared` (auto-discovery stays inside the app).
- Babel plugins share one traversal: do not rely on untransformed source in a visitor (`const` may already be `var`, JSX may be gone). Use scope information (`binding.constant`).
- Fast Refresh keeps `defineVars`, `defineMarker` and `keyframes` references valid only because `stylexn/babel` injects stable ids (hash of the file path and export name); without the plugin they fall back to a process counter.
- Only literal `when.*` calls as computed keys compile; a `when.ancestor` result stored in a `const` and used as a key is an extract error on native. StyleX's own `when.ancestor` type collapses to `string`, and template-literal keys widen to an index signature inside an object literal, so Layer 1 accepts unknown computed keys and the native entry constrains the pseudo argument instead.
- Everything in `packages/stylexn/src` must stay erasable-syntax TypeScript (no parameter properties, enums, namespaces) so Node and oxlint load the source directly.
- `elements/web.ts` and `elements/native.ts` start with `"use client"` so Server Components can import them; keep the directive on any new element entry.

Tooling:

- **lefthook re-stages the lockfile**: the pre-commit `pnpm exec` triggers an install against every workspace package on disk, and oxfmt's `stage_fixed` re-stages `pnpm-lock.yaml`. A partial commit can pick up lockfile entries for an unstaged package; move it out of the tree before committing and check `git show HEAD:pnpm-lock.yaml`.
- **Playwright port**: both Playwright configs honour `PORT`. A `next dev` left over from an earlier session may hold 3000/3001, and in CI mode Playwright refuses to reuse it; run `PORT=3100 CI=1 pnpm test:e2e` rather than killing it.
- **Turbopack cache staleness**: after fixing a build error, the Next build can keep reporting the old file. Delete the app's `.next` directory and rebuild.
- `check:styles` calls `node packages/stylexn/dist/bin.mjs` directly: pnpm links workspace bins before the root `prepare` builds `dist/`, so the `stylexn` bin is missing on a fresh install. After changing the library run `pnpm build` before `pnpm verify`, or `check:styles` and `pack:check` run against a stale `dist/`; a `git stash` round-trip triggers `prepare` and rebuilds from the stashed source as well.
- CI's Playwright `install --with-deps` step is an apt download on the runner; one run took 8 min instead of 1.5 with no change in the repo. Cache the browsers if it recurs.
- pnpm writes `allowBuilds` placeholders into `pnpm-workspace.yaml` on install; set them to `true`/`false` rather than adding a second key.
- Inside Vitest, module resolution is patched (`createRequire("/x")` still resolves `react-native`), so "not found" cases need a temp project rather than an assertion against the real tree.
- oxlint's `react(refs)` rejects `ref.current` reads during render; use the derived-state pattern (`useShallowStable` in `runtime/hooks.ts`) or a controller object held in state (`useMotion`).
- Keep `useProps` cheap for long lists: no per-render closures handed to `useSyncExternalStore`, no effects without dependencies, no allocation before the cache check. Measure with the bench.
- Docs site: `globals.css` must be imported before `stylexn/elements.css` (the first `@layer` statement fixes the layer order). Two ambient `declare module "*.png"` declarations in one program conflict, so each app declares its own bundler's image type. The Next apps take theirs from `next/image-types/global` through a committed `image-types.d.ts`, because `next-env.d.ts` is generated and gitignored and CI's typecheck runs without a Next build.
- Android draws `elevation` shadows through a view without an opaque `backgroundColor`.

## Next steps

Roughly in priority order; each can be started on its own.

- **Publish 0.1.0.** Check that `stylexn` is free on npm (otherwise pick a scope), drop `private`, add a CHANGELOG, publish from a tag in CI with provenance (`pnpm publish --provenance`, `NPM_TOKEN` secret, trusted publishing if available). `pack:check` already proves the tarball; add a post-publish smoke test that installs the published version into a fresh Expo template.
- **Maestro in CI.** A macOS job that boots a simulator, installs Expo Go, starts Metro and runs `apps/example-mobile/e2e` (Maestro needs `JAVA_HOME`); then the same flow on the Android emulator (`adb`, `host.exp.exponent`). _Decision_: keep Expo Go as the target, or build a dev client (`expo run:ios`) for a more realistic app at the cost of build time.
- **Pointer and platform environment.** `config.pointer` (`runtime/env.ts`) is a static `"coarse"`, so `hover`/`pointer` media features always evaluate for touch; detect mouse/trackpad on iPad and Android desktop modes. Add `platform`-only table entries beyond `verticalAlign`/`textDecorationColor` as they are discovered, and exercise them in the Android flow.
- **Portability and upkeep.** `scripts/pack-check.mjs` shells out to `tar` and `ls` (macOS/Linux only). Renovate or Dependabot for the pinned `oxlint`, Expo SDK and StyleX (each React Native release needs a new snapshot row in `compile/versions.test.ts`). A `CONTRIBUTING.md` pointing at `pnpm verify`, the device notes above and the commit style. GitHub warns that `ubuntu-latest` moves to Ubuntu 26 on 2026-10-19 and that the v4 actions run on a deprecated Node; bump the actions and cache the Playwright browsers.
- **Found by the todo app.** `firstThatWorks` cannot be used in shared code: the types reject its array result and the native runtime just returns the first value, while `COMPATIBILITY.md` claims a compile-time pick. A marked `View` publishes hover only (pointer events), so `when.ancestor(":active")` works on the web and on native only below a Pressable. React Native's `Switch` defaults to `alignSelf: flex-start`, so a row's `alignItems: center` needs `alignSelf: center` on the switch.
- **Small follow-ups.** The boolean `@media (prefers-reduced-motion)` form always evaluates false (one case in `runtime/media.ts`). `textOverflow` forwards a runtime-only value raw into `ellipsizeMode`, unlike the newer prop mappings. Retype `when` on the web entry so shared code gets the `:first-child` editor error there too. `overflowX`/`overflowY` and the `perspective` property were judged misleading to map and stay unsupported on purpose; `env()` names beyond the safe-area insets, `rlh`, `ch`/`ex` and the structural selectors have nothing to map to.
- **Performance, if needed.** The remaining per-element cost is React's hook and element overhead; the next lever is fewer hooks per element (the four store subscriptions in `useProps`: window, colour scheme, accessibility, ancestors), not the resolver.
