# StyleXN

Write styles once with the [StyleX](https://stylexjs.com) API and render them
on the web and on React Native. On the web the real StyleX compiler runs as
usual; on native a small runtime evaluates the same rules against device, theme
and interaction state, and four layers of checks (types, lint, build, runtime)
tell you up front which CSS has no React Native counterpart.

> **Experimental.** StyleXN is under active development and unpublished. The
> API, the compatibility table and the element set change without notice, and
> there is no stability guarantee yet.

## Where things are

- [`stylexn/stylexn`](stylexn/stylexn/README.md): the package, with the usage
  guide and setup for Next.js and Expo. Its
  [`COMPATIBILITY.md`](stylexn/stylexn/COMPATIBILITY.md) lists what every CSS
  feature does on React Native.
- [`examples/`](examples): a todo app shared between an Expo app
  (`todo-ios`) and a Next.js app (`todo-web`), plus the components the docs
  render live.
- [`docs/site`](docs/site): the documentation site, built from the package
  README, the examples and the compatibility table.

## Working in this repo

```bash
pnpm install
pnpm verify
```

`STYLEX_RN_HANDOFF.md` holds the decisions, commands and gotchas.

MIT
