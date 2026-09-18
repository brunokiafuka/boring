---
title: Routing
order: 3
---

# Routing

Routing is explicit. No file-based routing, so moving a file never changes a URL. The vocabulary is five functions
and the tree is plain data.

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

`app/routes.ts` is the only entry point; its default export is the tree. A feature exports its routes from
`index.ts` like any other capability, and the app imports and mounts them. Plain modules, plain imports: nothing
registers itself and nothing is scanned.

A leaf is a view, or `{ view, policy, load, action, title }` when it needs more. Any branch may declare `policy` and
`load`; everything under it inherits them. Here `/customers/:id` loads and guards the customer once, and the layout
and both views read it.

- Every policy from root to leaf must allow the request. A route with no policy anywhere above it denies everyone,
  and the tree reports it.
- A policy that never reads `record` is settled before anything loads. Otherwise it runs against the nearest loaded
  data.
- `Resource.current()` returns the nearest data loaded at or above whoever is asking.

## Layouts and Outlet

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

## The compiled tree

`compile(tree)` flattens the tree into `{ routes, redirects, problems }`. Each route is its full path, its leaf, and
its levels from root to leaf (layout, policy, load). The server, the client router, `boring check` and
`boring explain` all read this one structure. Problems it reports: duplicate routes, conflicting routes
(`/b/:id` vs `/b/:slug`), routes with no policy, empty branches, shadowed redirects, redirects that lead nowhere.

## How a request moves

- GET: match the tree (redirects first), walk the branch root-first running policy then load at each level, then
  render, or send JSON when the client router asks.
- POST: the same walk, then the action bound to the leaf: its policy, its schema, `run` inside a transaction, jobs
  enqueue only after commit, then reload the branch and send fresh data. `invalid()` rolls back.
