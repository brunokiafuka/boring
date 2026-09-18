import { resource } from "@boring-dev/core";
import { marked, Renderer } from "marked";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface DocSummary {
  slug: string;
  title: string;
  description: string;
  order: number;
}

export interface DocRecord extends DocSummary {
  html: string;
  /** h2 headings, for the page outline. */
  sections: { id: string; text: string }[];
}

const dir = join(process.cwd(), "content/docs");

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** `title:`, `description:` and `order:` lines between --- fences, then the markdown body. */
function parse(slug: string, source: string): DocRecord {
  const [, head = "", body = source] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const meta = Object.fromEntries(head.split("\n").map((line) => line.split(/:\s(.*)/, 2)));

  const sections: DocRecord["sections"] = [];
  const renderer = new Renderer();
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const id = slugify(text);
    if (depth === 2) sections.push({ id, text });
    return `<h${depth} id="${id}"><a href="#${id}">${text}</a></h${depth}>\n`;
  };

  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    order: Number(meta.order ?? 99),
    html: marked.parse(body, { async: false, renderer }),
    sections,
  };
}

const read = (slug: string) => parse(slug, readFileSync(join(dir, `${slug}.md`), "utf8"));

export const Doc = resource("Doc", {
  reads: {
    list: (): DocSummary[] =>
      readdirSync(dir)
        .filter((name) => name.endsWith(".md"))
        .map((name): DocSummary => {
          const { html: _, sections: __, ...summary } = read(name.slice(0, -3));
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
