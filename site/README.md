# Site

The BoringJS marketing site and docs, built with BoringJS. Two features: `marketing` owns `/`, `docs` owns
`/docs/:slug` and reads markdown from `content/docs/`. No database, no users, every route open.

```bash
pnpm site           # from the repo root: http://localhost:5173
pnpm --filter site test
pnpm --filter site explain
```

Add a page by adding `content/docs/<slug>.md` with `title:` and `order:` lines between `---` fences.
