---
title: Getting started
order: 1
---

# Getting started

BoringJS is a small application model on top of Vite. Vite owns the machinery: the dev server, hot reload,
TypeScript, JSX. Boring owns the shape: where things go, how routes are declared, how data reaches a view, how a
form reaches the server.

Requires Node 22.5 or newer.

```bash
pnpm create @boring-dev my-app
cd my-app
pnpm install
pnpm dev
```

The new app has one feature, one test, and these commands:

```bash
pnpm dev            # http://localhost:5173
pnpm test           # feature tests through the real request path
pnpm check          # boring check: the shape rules
pnpm explain        # features, what they expose, every URL, how layouts compose
pnpm typecheck
```

## What you get

```text
app/
├── routes.ts                 every URL, in one place
├── styles.css
└── features/
    └── home/
        ├── index.ts          public API: the only door in
        ├── routes.ts         the URLs this feature owns
        ├── views/            route-level UI
        └── tests/
boring.config.ts              the application contract
vite.config.ts                the infrastructure shell
```

`boring.config.ts` names the runtime, the view layer and the state model, and later the database and auth:

```ts
export default defineBoring({
  runtime: "node",
  view: react(),
  state: signals(),
  // database: sqlite({ file: ".boring/dev.db", migrate }),
  // auth: auth({ getUser }),
});
```

## Packages

| Package              |                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `@boring-dev/core`   | Routing tree and compiler, `resource`, `action`, `policy`, `job`, signals. Platform-free. |
| `@boring-dev/vite`   | The Vite plugin: serves the app, keeps server code out of the browser.                    |
| `@boring-dev/node`   | Request handler, SQLite on `node:sqlite`, durable jobs.                                   |
| `@boring-dev/react`  | Server render, hydration, client router, `Outlet`, the form-aware JSX runtime.            |
| `@boring-dev/test`   | `testApp()`.                                                                              |
| `@boring-dev/check`  | `boring check`, `boring explain`.                                                         |
| `@boring-dev/create` | `pnpm create @boring-dev`.                                                                |

Not built yet: a production build, a Postgres adapter, `boring check` autofixes.
