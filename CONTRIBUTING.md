# Contributing

## Running locally

Requires Node 22.5+ (for `node:sqlite`) and pnpm.

```bash
pnpm install
pnpm dev            # the Acme example on http://localhost:5173
```

This is a pnpm workspace. Every `@boring-dev/*` package in `packages/` and every app in `examples/` is a workspace
member, and the examples depend on the packages with `workspace:*`. `pnpm install` symlinks them, so the example
runs straight from `packages/*/src`: edit a package, and Vite reloads the example. There is no build step, because
the packages ship TypeScript source and Vite handles it.

To try the packages in an app outside this repo, link them the same way:

```bash
cd packages/core && pnpm link --global           # once per package
cd ~/my-app && pnpm link --global @boring-dev/core
```

To try what npm would actually install: `pnpm -r --filter './packages/*' exec pnpm pack --pack-destination
/tmp/boring`, scaffold an app with `node packages/create/bin/create-boring.js /tmp/boring/demo`, and point its
`pnpm.overrides` at the `file:` tarballs before `pnpm install`.

## Releasing

Every package is published as-is from `packages/*/src`: no build step, and `pnpm publish` rewrites `workspace:*`
to the released version. All packages share one version.

```bash
pnpm release:version 0.2.0     # bump every package
pnpm release                   # runs the checks, then publishes packages/* (needs `npm login`)
```

`@boring-dev/create` ships its `template/` folder; a new app depends on `^<its own version>`, so publish the
packages together.

## Layout

```text
packages/
├── core      routing tree, resource / action / policy / job, signals
├── vite      the Vite plugin
├── node      request handler, SQLite, jobs
├── react     rendering adapter and client router
├── test      testApp()
├── check     boring check, boring explain
└── create    pnpm create @boring-dev: the scaffolder and its template/
examples/
└── acme      the reference app: see examples/acme/README.md
site/         the marketing site and docs, itself a Boring app: `pnpm site`
```

## Checks

Run all of these before opening a pull request. CI is not set up yet, so they are the gate.

```bash
pnpm test           # boring check rules, routing, then the example's feature tests
pnpm lint           # oxlint
pnpm fmt            # oxfmt; `pnpm fmt:check` to verify without writing
pnpm --filter acme typecheck
pnpm --filter acme check
pnpm --filter site typecheck
pnpm --filter site check
```

## Conventions

- Keep the vocabulary small. Before adding a primitive, a hook or a component to a `@boring-dev/*` package, ask whether
  the platform or an existing primitive already covers it. The README's "Small vocabulary, platform first" section
  is the bar.
- Views, layouts and components are plain exported React functions. No custom syntax, no build-time rewrites.
- A new rule in `boring check` needs a case in `packages/check/fixtures/drift` that trips it and one in the example
  that passes.
- A change to routing needs a test in `packages/core/test/routing.test.ts`.
- JSDoc on exported declarations where the name does not already say it; no comment banners.
