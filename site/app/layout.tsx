import { Outlet } from "@boring-dev/react";

export function SiteShell() {
  return (
    <>
      <header className="site-header">
        <a className="site-brand" href="/">
          <span aria-hidden="true">🥱</span> BoringJS
        </a>
        <nav>
          <a href="/docs">Docs</a>
          <a href="https://github.com/brunokiafuka/boring">GitHub</a>
          <a href="https://www.npmjs.com/org/boring-dev">npm</a>
        </nav>
      </header>
      <div className="progress" />
      <Outlet />
      <footer className="site-footer">
        <p>
          This site is a Boring app: rendered on the server, works with JavaScript off, and{" "}
          <a href="https://github.com/brunokiafuka/boring/tree/main/site">its source</a> is in the same
          repository.
        </p>
      </footer>
    </>
  );
}
