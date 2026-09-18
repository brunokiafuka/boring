import { Outlet } from "@boring-dev/react";
import { Doc, type DocSummary } from "../resource";

export function DocsLayout() {
  const pages = Doc.current<DocSummary[]>();

  return (
    <div className="docs">
      <nav className="docs-nav" aria-label="Documentation">
        <ol>
          {pages.map((page) => (
            <li key={page.slug}>
              <a href={`/docs/${page.slug}`}>{page.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      <Outlet />
    </div>
  );
}
