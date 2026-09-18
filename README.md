# BoringJS

Software should be boring: predictable, explicit, composable, and hard to make incoherent by accident.
BoringJS is a small application model on top of Vite. Vite owns the machinery. Boring owns the shape.

```bash
pnpm install
pnpm dev            # example app → http://localhost:5173
pnpm check          # boring check on the example
pnpm --filter acme typecheck   # tsc --noEmit
pnpm test           # check rules, routing, then the example's feature tests
```

Running from a clone, hacking on the packages, and the checks to run: see [CONTRIBUTING.md](CONTRIBUTING.md).
The reference app is [`examples/acme`](examples/acme/README.md).

In `examples/acme`, `pnpm explain` prints what features exist, what each exposes, every URL, and how layouts
compose. That command is the success criterion for this design: you should not need to search the repository.

```text
Features
  customer exposes Customer, updateCustomer, customerRoutes
  session exposes sessionRoutes

Routes
  /customers               AppShell › CustomerList                        customer · allow:signedIn
  /customers/:id           AppShell › CustomerLayout › CustomerOverview   customer · allow:signedIn + customer:view
  /customers/:id/settings  AppShell › CustomerLayout › CustomerSettings   customer · … · 1 action
  /session                 AppShell › SessionPage                         session · allow:everyone · 1 action
  /                        → /customers
```

## The feature is the unit of understanding

Organize around capabilities, not framework concepts. Everything needed to understand a feature sits in it.

```text
app/
├── routes.ts                 every URL, in one place
├── layout.tsx                the application shell
├── features/
│   └── customer/
│       ├── index.ts          public API: the only door in
│       ├── routes.ts         the URLs this feature owns
│       ├── resource.ts       server reads and writes
│       ├── actions/          mutations
│       ├── policies/         who may do what
│       ├── jobs/             work that outlives the request
│       ├── views/            route-level UI
│       ├── components/       reusable UI
│       ├── layouts/          persistent UI for a branch of routes
│       ├── internal/         private helpers
│       └── tests/
└── shared/                   auth, ui, utils: depends on no feature
```

**Views participate in application flow. Components participate in UI composition.** A view is a route target: it
knows what the route loaded (`Customer.current()`), submits actions, and is not reused elsewhere. A component takes
props, owns no navigation or data concerns, and is reused inside the feature. Views compose components, never the
reverse.

**`internal/`, not `shared/`.** Code reused inside a feature but not part of its API goes in `internal/`. A
feature-local `shared/` becomes a dumping ground; `internal/` says what it means and is enforced.

**Features expose capabilities. Implementation stays private.**

```ts
// app/features/customer/index.ts
export { Customer, type CustomerRecord } from "./resource";
export { updateCustomer } from "./actions/update-customer";
export { customerRoutes } from "./routes";
```

```ts
import { Customer } from "@/features/customer"; // yes
import { Customer } from "@/features/customer/resource"; // B110
import { PLANS } from "@/features/customer/internal/plans"; // B111
```

### Dependency rules

```text
allowed       feature → app/shared
              feature → its own code, including internal/
              feature → another feature's index.ts

not allowed   app/shared → feature                       B112
              feature → another feature's internal/      B111
              feature → another feature's deep path      B110
              feature ⇄ feature cycles                   B113
              index.ts re-exporting internal/            B114
```

## Routing is explicit

No file-based routing. Moving a file never changes a URL. The vocabulary is five functions and the tree is plain data.

|                                                           |                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `routes(children)` / `routes({ layout, children })`       | Groups a tree. The object form is a root branch.                           |
| `route(path, View)` / `route(path, { layout, children })` | A path segment: a leaf, or a branch and layout boundary.                   |
| `index(View)`                                             | The default child of the current branch.                                   |
| `mount(path, featureRoutes)`                              | This feature owns this URL namespace. The feature never learns the prefix. |
| `redirect(from, to)`                                      | Explicit, relative to the branch that declares it. Params carry over.      |

```ts
// app/routes.ts
export default routes({
  layout: AppShell,
  children: [
    redirect("/", "/customers"),
    mount("/customers", customerRoutes),
    mount("/session", sessionRoutes),
  ],
});
```

```ts
// app/features/customer/routes.ts
export const customerRoutes = routes({
  policy: allow.signedIn,
  children: [
    index({ view: CustomerList, load: ({ search, user }) => … }),

    route("/:id", {
      layout: CustomerLayout,
      policy: CustomerPolicy.view,
      load: ({ params }) => Customer.find(params.id),
      children: [
        index(CustomerOverview),
        route("/settings", { view: CustomerSettings, action: updateCustomer }),
      ],
    }),
  ],
});
```

`app/routes.ts` is the only entry point; its default export is the tree. A feature exports its routes from `index.ts`
like any other capability, and the app imports and mounts them. Plain modules, plain imports: nothing registers
itself and nothing is scanned.

A leaf is a view, or `{ view, policy, load, action, title }` when it needs more. Any branch may declare `policy` and
`load`; everything under it inherits them. Here `/customers/:id` loads and guards the customer once, and the layout
and both views read it.

- **Every policy from root to leaf must allow the request.** A route with no policy anywhere above it denies
  everyone, and the tree reports it.
- A policy that never reads `record` is settled before anything loads. Otherwise it runs against the nearest loaded
  data.
- `Resource.current()` returns the nearest data loaded at or above whoever is asking.

### Layouts and Outlet

The route tree owns layout composition; directories never imply it. A layout is persistent UI for a branch, and
`<Outlet />` means exactly one thing: render the active child route here. It is not a slot system. Use children and
props for component composition.

```tsx
export function CustomerLayout() {
  const customer = Customer.current();
  return (
    <>
      <PageHeader title={customer.name} />
      <nav>…</nav>
      <Outlet />
    </>
  );
}
```

Layouts stay mounted while their child route changes.

### The compiled tree

`compile(tree)` flattens the tree into `{ routes, redirects, problems }`. Each route is its full path, its leaf, and
its `levels` from root to leaf (layout, policy, load). The server, the client router, `boring check` and
`boring explain` all read this one structure. Problems it reports: duplicate routes, conflicting routes
(`/b/:id` vs `/b/:slug`), routes with no policy, empty branches, shadowed redirects, redirects that lead nowhere.

## Small vocabulary, platform first

```tsx
export function CustomerSettings() {
  const customer = Customer.current();
  const save = updateCustomer.state(); // pending, succeeded, errors, values

  return (
    <form action={updateCustomer}>
      <input name="name" defaultValue={customer.name} />
      <button type="submit" disabled={save.pending}>
        Save changes
      </button>
    </form>
  );
}
```

- Views, layouts and components are ordinary exported React functions. No custom syntax, no build-time rewrites.
- `<form action={someAction}>` renders a real `method="post"` form. Without JavaScript it posts natively; with it,
  one document listener submits in place. A form with no action is a GET form, and submitting it writes the URL.
- Links are `<a href>`. Progress is `<html data-boring="loading | submitting">` and CSS.
- The whole UI-side API: `Outlet`, `useUser`, `useSignal`, `useComputed`, `useSignalValue`.

## How a request moves

- **GET**: match the tree (redirects first) → walk the branch root-first: policy, then load, at each level → render,
  or JSON when the client router asks.
- **POST**: same walk, then the action bound to the leaf: its policy → its schema → `run` inside a transaction →
  jobs enqueue only after commit → reload the branch and send fresh data. `invalid()` rolls back.
- An action ends with `success(value, { invalidate, redirect })` or `invalid(fieldErrors)`.

## Testing

One style. Tests live in `app/features/<feature>/tests/*.test.ts`; `boring()` tells Vitest where they are.

```ts
const app = testApp(); // fresh in-memory database
const page = await app.as(vik).visit("/customers/c_102"); // status, data, keys, redirect
const save = await app.as(vik).submit(path, updateCustomer, values);
await app.jobs.drain();
```

Tests go through the real request path as a chosen user, without rendering. Policies are plain functions.

## boring check

```text
✓ route tree is valid: 4 routes, no duplicates or conflicts
✓ features only meet through their public APIs
✓ no feature dependency cycles
✓ app/shared depends on no feature
✓ UI, business rules and server code point the right way
✓ actions declare input schemas and policies
✓ no parallel state or mutation systems
✓ features with actions have tests
```

Also: B120 business code importing UI, B121 a component importing a view, B217 UI importing server code, B104
URL-shaped state in a store, B301 hand-rolled mutations, B401 a feature with actions and no tests, B130 route tree
problems. Suppress with a reason and an expiry: `// boring-ignore B110 until 2026-12-01: why`.

## Packages

| Package         |                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `@boring/core`  | Routing tree and compiler, `resource`, `action`, `policy`, `job`, signals. Platform-free.                    |
| `@boring/vite`  | The Vite plugin: serves the app, `@/` alias, keeps server code out of the browser, brings the React adapter. |
| `@boring/node`  | Request handler, SQLite on `node:sqlite`, durable jobs.                                                      |
| `@boring/react` | The rendering adapter: server render, hydration, client router, `Outlet`, the form-aware JSX runtime.        |
| `@boring/test`  | `testApp()`.                                                                                                 |
| `@boring/check` | `boring check`, `boring explain [file]`.                                                                     |

## Not built yet

`create-boring-app`, a production build, a Postgres adapter, and `boring check` autofixes. Requires Node 22.5+.
