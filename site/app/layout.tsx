import { Outlet } from "@boring-dev/react";

/** The <html data-theme> attribute is the state; the button flips it and remembers the choice. */
function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try {
    localStorage.setItem("theme", root.dataset.theme);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

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
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label="Switch theme">
            <span className="theme-toggle-dark">Dark</span>
            <span className="theme-toggle-light">Light</span>
          </button>
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
