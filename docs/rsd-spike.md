# Spike: React Strict DOM (RSD) in this monorepo

Date: 2026-09-25. Branch: `spike/rsd`. Package: `react-strict-dom@0.0.55`.

Goal (handoff step 4): prototype one component on RSD, render it in both
apps, and note what's missing for our use case so we can decide
"adopt RSD" vs "build StyleXN as a custom layer" (step 5).

## What was built

- `packages/shared/src/HelloStrict.tsx` — a single component, no platform
  forks, using `html.div/h2/p/button` and `css.create` with:
  `:hover` / `:active`, `@media (min-width: 800px)`, `rem` units, a
  `transition`, a dynamic style function, and `css.defineVars` (with a
  `prefers-color-scheme: dark` variant, in `tokens.css.ts`) plus a
  `css.createTheme` override applied to a subtree.
- `apps/web/app/rsd/page.tsx` renders it; `apps/mobile/App.tsx` renders it
  next to the existing plain-StyleX `Hello`.
- Toolchain wiring in `apps/web` (`babelLoader.config.js`, `next.config.ts`,
  `postcss.config.js`, `globals.css`), `apps/mobile/babel.config.js`, and
  `vitest.shared.ts`.

## What worked

| Feature                               | Web (Next 16 / Turbopack)                                | iOS (Expo 57 / RN 0.86)                   |
| ------------------------------------- | -------------------------------------------------------- | ----------------------------------------- |
| `html.*` elements                     | ✅ real DOM                                              | ✅ View/Text polyfills                    |
| `css.create` static styles            | ✅ compiled to atomic CSS, extracted by PostCSS          | ✅ runtime objects                        |
| `:hover` → `#7a4fb5`                  | ✅ verified via computed style                           | n/a (no hover)                            |
| `:active`                             | ✅                                                       | ✅ Pressable-style state                  |
| `onClick` state update                | ✅                                                       | ✅                                        |
| `@media (min-width: 800px)` → `32rem` | ✅ 512px at 1000px viewport, 100% at 387px               | 🟡 polyfilled (not exercised on device)   |
| `rem` units                           | ✅                                                       | ✅ polyfilled                             |
| `defineVars` + dark mode              | ✅ `#b48ee6` in dark scheme, `rebeccapurple` in light    | ✅                                        |
| `createTheme` subtree override        | ✅                                                       | ✅                                        |
| `transition`                          | ✅ real CSS transition                                   | 🟡 polyfilled via Animated (not measured) |
| Static CSS extraction                 | ✅ one 2.3 KB stylesheet with layers, vars, media, hover | n/a                                       |
| Vitest with RSD components            | ✅ after transform changes (see below)                   | —                                         |
| Playwright                            | ✅ unchanged                                             | —                                         |

## What did not work / costs found

1. **RSD pins its own StyleX.** `react-strict-dom@0.0.55` depends on
   `@stylexjs/stylex@^0.15.4` and `@stylexjs/babel-plugin@^0.15.4` as regular
   dependencies (repo `main` is on `^0.18.3`, so a bump is coming, but we
   don't control the cadence). We are on 0.19.1. Both versions now coexist in
   `node_modules`. Consequences:
   - Two compilers and two runtimes in the web bundle. Mixing them in one
     module breaks at runtime (0.19's `inject()` output fed to 0.15's
     runtime → `cssText.startsWith is not a function`); the Vitest transform
     had to route RSD files to RSD's preset _only_.
   - `defineVars` from `@stylexjs/stylex` and from `react-strict-dom` are not
     interoperable: separate hashing, separate CSS.
   - Practically: **an RSD codebase should use RSD's `css` everywhere and drop
     direct `@stylexjs/stylex` usage**, accepting RSD's StyleX version.
2. **RSD's published dist is not pre-compiled.** `dist/web/runtime.js` contains
   `stylex.create()` for default element styles; consumers must run RSD's
   Babel preset over `node_modules/react-strict-dom`. Next needs
   `transpilePackages` + an explicit Turbopack `babel-loader` rule (RSD's
   documented setup); Vitest needs `server.deps.inline: ["react-strict-dom"]`
   plus the transform. Every JS pipeline that touches shared code must know
   about RSD.
3. **Web build pipeline changes.** Next's auto-detected `babel.config.js`
   can't be used (it wouldn't reach `node_modules/react-strict-dom`), so the
   web app now has an explicit `babelLoader.config.js` + Turbopack rule and
   `experimental.turbopackUseBuiltinBabel: false`. Loader options must be
   JSON-serialisable, so presets/plugins are referenced by name. Two PostCSS
   plugins run (`@stylexjs/postcss-plugin` for `@stylex;`,
   `react-strict-dom/postcss-plugin` for `@react-strict-dom;`).
4. **Docs vs. code drift (0.0.x reality).** The docs site
   (facebook.github.io/react-strict-dom) returned 404 on every page during
   the spike; docs had to be read from the repo. The PostCSS option is
   `useCSSLayers`, not `useLayers` as documented. The Babel preset ignores
   the documented `rootDir` option and hardcodes `process.cwd()`. The docs'
   theming example (`style={[theme, styles.x]}`) does not typecheck with a
   typed `defineVars` group (`Styles` accepts
   `Theme<VarGroup<{[k]: unknown}>>` only) — needs `@ts-expect-error`.
5. **React Server Components.** Any interactive RSD component (and anything
   re-exported next to it from a barrel that a Server Component imports)
   needs `"use client"`. Not RSD-specific, but RSD's `html.*` invites
   web-style composition that hits this immediately.
6. **RN habits break on native.** `html.div` is `display: block` on native
   too; `flex: 1` / `alignItems` without `display: flex` do nothing and log
   `React Strict DOM: "display:flex" is required…` errors. This is RSD
   working as designed (web semantics), but it means RN-native components and
   RSD trees don't mix freely — `compat.native` is the escape hatch and is
   marked experimental.
7. **Native layout diverges from CSS in two visible ways.**
   - `display: flex` gets the _CSS_ default `flex-direction: row`, not RN's
     `column`. Correct per spec, but every RN developer will trip on it once.
   - `width: 100%` inside a padded parent overflows on native (the card
     ignores the root's `padding: 16` and its inner card spills past the
     right edge), while on web it fits the content box. Not root-caused in
     this spike (Yoga percentage semantics vs. RSD's block polyfill); worth a
     follow-up because percentage widths are common.
   - Root `padding: "1rem"` vs `padding: 16` both applied once
     `display: flex` was set; the earlier "no padding" observation was the
     block-layout polyfill, not the `rem` polyfill.
8. **Element/API coverage on native** (from RSD's tables): no `form`,
   `select`, `option`, `dialog`, `svg`, `input[type=checkbox|radio|date|file]`;
   no `onClick`/`onFocus`/`onBlur` in the props table (pointer events and
   `onChange` are the supported path; `onClick` did work on `html.button` in
   this spike); no `display: grid | inline*`, `position: fixed | sticky`,
   `calc()`, `clamp()`, `min()/max()`, `overflowX/Y`, `whiteSpace`,
   `wordBreak`, `css.keyframes`/`animation*` (issue #3). `caretColor` and
   `verticalAlign` iOS-only gaps.
9. **Metro in `CI=1` mode disables watch/reload**; use interactive mode for
   iteration. Unrelated to RSD, noted for the workflow.

## Implications for StyleXN (handoff "Key conclusion")

- RSD _is_ the "keep the authoring API, replace the output backend" design,
  implemented by Meta, with the runtime-context machinery (vars, media
  queries, inheritance, units) already built and used in production.
- Its constraint is the element model: it requires `html.*` elements. Plain
  RN components (`View`/`Text`, third-party RN libs) cannot take
  `css.create` styles; `compat.native` is the only bridge and is unstable.
- The compatibility-checking layers the handoff wants (types, lint, build,
  runtime) do **not** exist in RSD beyond runtime `console.error`s and a
  markdown table. That table is exactly the "single source of truth" the
  handoff describes — but as prose, not data.

## Options for step 5

A. **Adopt RSD wholesale.** Shared components use `html.*` + `css` from
`react-strict-dom`; drop direct `@stylexjs/stylex` in shared. StyleXN
becomes the compatibility-checking layer on top: a typed table derived
from RSD's tables, a lint rule, a Babel/build check, and thin typings.
Cost: RSD's 0.0.x churn, pinned StyleX version, `html.*`-only trees.

B. **Build StyleXN as its own runtime** (handoff's proposed architecture),
using RSD's native implementation as reference. Cost: re-implementing the
polyfills RSD already has (vars via context, media queries, units,
transitions, pseudo-states); benefit: works on plain RN primitives and
third-party RN components, and decouples from RSD's StyleX pin.

C. **Hybrid.** Adopt RSD for shared UI now (A), and scope StyleXN v1 to the
compatibility checker + a `stylexn.native()` escape hatch built on
`compat.native` for the cases that need raw RN components. Revisit B only
if `html.*`-only becomes a blocker.

Recommendation: **C.** The spike shows RSD does the hard runtime work well and
its gaps are mostly _checking_ gaps, which is the part the handoff identifies
as a hard requirement anyway. Decide the RN-primitives question explicitly:
choosing RSD means "no, `html.*` only, `compat.native` for exceptions".

## Decision (2026-09-25)

**Option B: build StyleXN as its own runtime**, using RSD's native
implementation as the reference for the polyfills (variables via context,
media queries, relative units, pseudo-states, transitions). Grounds from this
spike: StyleXN must work on plain RN primitives and third-party RN
components (RSD's `html.*`-only model and unstable `compat.native` rule that
out), and it must not be coupled to RSD's pinned StyleX version and 0.0.x
churn (findings 1–4). `react-strict-dom` is therefore not a dependency on
`main`; the `spike/rsd` branch is kept as a reference.

Implication for the handoff's open question on shared components: the
element model is RN primitives (`View`/`Text` semantics), reached through
StyleXN wrappers (`<SxView>`/`<SxText>` or a hook) that render DOM elements
on web and RN components on native. react-native-web is not planned.

## How to run this spike

```
git checkout spike/rsd && pnpm install
pnpm --filter @stylexn/web dev        # open http://localhost:3000/rsd
pnpm --filter @stylexn/mobile ios     # Expo Go
pnpm test && pnpm test:e2e
```
