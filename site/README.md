# Site

The BoringJS marketing site and docs, built with BoringJS. Two features: `marketing` owns `/`, `docs` owns
`/docs/:slug` and reads markdown from `content/docs/`. No database, no users, every route open.

```bash
pnpm site           # from the repo root: http://localhost:5173
pnpm --filter site test
pnpm --filter site explain
```

Add a page by adding `content/docs/<slug>.md` with `title:` and `order:` lines between `---` fences.

## Static export

Every route here is open and reads no user, so the site can be rendered once and hosted anywhere static.
`pnpm build` renders each URL through the real handler into `dist/`, with no client script: the site works with
JavaScript off, and the theme toggle is a plain head script. `.github/workflows/site.yml` deploys `dist/` to
GitHub Pages on every push to `main`; `BASE_PATH` rewrites links when the site lives under a sub-path.
