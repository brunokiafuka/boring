---
title: Features
order: 2
description: The folder is the unit: what goes where, and the import rules that keep it that way.
---

The feature is the unit of understanding. Organize around capabilities, not framework concepts. Everything needed
to understand a feature sits in its folder.

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

## Views and components

Views participate in application flow. Components participate in UI composition. A view is a route target: it
knows what the route loaded (`Customer.current()`), submits actions, and is not reused elsewhere. A component takes
props, owns no navigation or data concerns, and is reused inside the feature. Views compose components, never the
reverse.

## internal/, not shared/

Code reused inside a feature but not part of its API goes in `internal/`. A feature-local `shared/` becomes a
dumping ground; `internal/` says what it means and is enforced.

## The public API

Features expose capabilities. Implementation stays private.

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

## Dependency rules

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
