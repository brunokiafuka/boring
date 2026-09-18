import { resource } from "@boring-dev/core";
import { marked } from "marked";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface DocSummary {
  slug: string;
  title: string;
  order: number;
}

export interface DocRecord extends DocSummary {
  html: string;
}

const dir = join(process.cwd(), "content/docs");

/** `title:` and `order:` lines at the top of the file, then the markdown body. */
function parse(slug: string, source: string): DocRecord {
  const [, head = "", body = source] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const meta = Object.fromEntries(head.split("\n").map((line) => line.split(/:\s*/, 2)));
  return {
    slug,
    title: meta.title ?? slug,
    order: Number(meta.order ?? 99),
    html: marked.parse(body, { async: false }),
  };
}

const read = (slug: string) => parse(slug, readFileSync(join(dir, `${slug}.md`), "utf8"));

export const Doc = resource("Doc", {
  reads: {
    list: (): DocSummary[] =>
      readdirSync(dir)
        .filter((name) => name.endsWith(".md"))
        .map((name): DocSummary => {
          const { html: _, ...summary } = read(name.slice(0, -3));
          return summary;
        })
        .toSorted((a: DocSummary, b: DocSummary) => a.order - b.order),

    find: (slug: string): DocRecord | null => {
      if (!/^[a-z0-9-]+$/.test(slug)) return null;
      try {
        return read(slug);
      } catch {
        return null;
      }
    },
  },
});
