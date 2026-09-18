# Acme

The reference app. A billing back-office with customers, one background job and a demo user switcher.

```bash
pnpm dev            # http://localhost:5173
pnpm test           # feature tests through the real request path
pnpm check          # boring check
pnpm explain        # features, what they expose, every URL, how layouts compose
pnpm typecheck
```

## What to look at

- `app/routes.ts`: every URL. `/` redirects to `/customers`; the customer and session features are mounted.
- `app/features/customer`: the full shape of a feature. `routes.ts` loads and guards one customer for a whole
  branch; `layouts/customer-layout.tsx` renders the tabs and an `<Outlet />`; `views/` are the pages;
  `components/` are reused inside the feature; `internal/` is private; `index.ts` is the public API.
- `app/features/customer/views/customer-settings.tsx`: a plain `<form action={updateCustomer}>` with server-side
  validation and one business rule. Save queues `jobs/sync-customer.ts` after the transaction commits.
- `app/features/customer/views/customer-list.tsx`: filters that live in the URL, and a signal-based selection.
- `/session`: switch between Ada (admin), Vik (viewer, refused on save) and Oz (another organisation).
- `app/features/*/tests`: the testing convention, driven by `@boring/test`.

Try it with JavaScript disabled: forms still post, errors still render, redirects still work.

The database is SQLite at `.boring/dev.db`, created and seeded on first request. Delete it to reset.
