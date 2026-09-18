import { Doc, type DocRecord } from "../resource";

export function DocPage() {
  const doc = Doc.current<DocRecord>();
  return <article className="doc" dangerouslySetInnerHTML={{ __html: doc.html }} />;
}
