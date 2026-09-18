import { Doc, type DocRecord, type DocSummary } from "../resource";

type Loaded = { page: DocRecord; pages: DocSummary[] };

export function DocPage() {
  const { page, pages } = Doc.current<Loaded>();
  const at = pages.findIndex((p) => p.slug === page.slug);
  const previous = pages[at - 1];
  const next = pages[at + 1];

  return (
    <div className="docs">
      <nav className="docs-nav" aria-label="Documentation">
        <ol>
          {pages.map((p) => (
            <li key={p.slug}>
              <a href={`/docs/${p.slug}`} aria-current={p.slug === page.slug ? "page" : undefined}>
                {p.title}
              </a>
            </li>
          ))}
        </ol>
        {page.sections.length > 0 && (
          <ol className="docs-outline" aria-label="On this page">
            {page.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.text}</a>
              </li>
            ))}
          </ol>
        )}
      </nav>

      <article className="doc">
        <header className="doc-header">
          <h1>{page.title}</h1>
          {page.description && <p className="lede">{page.description}</p>}
        </header>
        <div dangerouslySetInnerHTML={{ __html: page.html }} />
        <footer className="doc-footer">
          {previous ? (
            <a href={`/docs/${previous.slug}`} rel="prev">
              <small>Previous</small>
              {previous.title}
            </a>
          ) : (
            <span />
          )}
          {next && (
            <a href={`/docs/${next.slug}`} rel="next" className="doc-next">
              <small>Next</small>
              {next.title}
            </a>
          )}
        </footer>
      </article>
    </div>
  );
}
