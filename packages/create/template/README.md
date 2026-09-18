# My Boring App

A [BoringJS](https://github.com/brunokiafuka/boring) application. Requires Node 22.5+.

```bash
pnpm dev            # http://localhost:5173
pnpm test           # feature tests through the real request path
pnpm check          # boring check: the shape rules
pnpm explain        # features, what they expose, every URL, how layouts compose
pnpm typecheck
```

## Where things are

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
```

`boring.config.ts` is the application contract: runtime, view, state, and later `database` and `auth`.

## Adding a feature

1. Create `app/features/<name>/` with an `index.ts` and a `routes.ts`. Add `resource.ts` for server reads,
   `actions/` for mutations, `policies/` for who may do what, and `tests/`.
2. Mount its routes in `app/routes.ts`: `mount("/<path>", <name>Routes)`.
3. Run `pnpm explain` to see it in the tree, and `pnpm check` to keep the shape honest.

## Adding a database and users

SQLite ships with Node 22.5+, so there is nothing to install.

```ts
// boring.config.ts
import { auth, sqlite } from "@boring-dev/node";

database: sqlite({ file: ".boring/dev.db", migrate }),   // migrate(db) creates your tables
auth: auth({ getUser }),                                  // getUser(request, cookies) → user | null
```

Then read and write with `db()` from `@boring-dev/node` inside a feature's `resource.ts`. Actions run inside a
transaction, and tests get a fresh in-memory database each.
