/**
 * Static export. Every route on this site is open and reads no user, so each one is the same
 * HTML for everyone: render them once through the real handler and write files for a static host.
 * No client script is included; the site is built to work without one.
 *
 *   node scripts/prerender.js            → dist/
 *   BASE_PATH=/boring node scripts/…     → links rewritten for hosting under a sub-path
 */
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createServer } from "vite";
import { headHtml } from "../head.js";

const root = process.cwd();
const out = join(root, "dist");
const base = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

const server = await createServer({
  root,
  logLevel: "silent",
  server: { middlewareMode: true, ws: false },
  optimizeDeps: { noDiscovery: true },
});

try {
  const { manifest } = await server.ssrLoadModule("virtual:boring/server");
  const { handle } = await server.ssrLoadModule("@boring-dev/node/handler");

  // Every URL: the tree's static routes, plus one page per document for /docs/:slug.
  const slugs = readdirSync(join(root, "content/docs"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.slice(0, -3));
  const urls = ["/", "/docs", ...slugs.map((slug) => `/docs/${slug}`)];

  const render = async (url) => {
    const response = await handle(new Request(new URL(url, "http://site.local")), {
      root,
      manifest,
      styles: ["/app/styles.css"],
      clientEntry: "",
      transformHtml: async (_url, html) => html.replace("</head>", `    ${headHtml}\n  </head>`),
    });
    return {
      status: response.status,
      location: response.headers.get("location"),
      html: await response.text(),
    };
  };

  // Root-relative URLs become base-relative when the site lives under a sub-path.
  const rebase = (html) => (base ? html.replace(/(href|src)="\//g, `$1="${base}/`) : html);

  const write = (file, html) => {
    mkdirSync(dirname(join(out, file)), { recursive: true });
    writeFileSync(join(out, file), rebase(html));
    console.log(`  ${file}`);
  };

  rmSync(out, { recursive: true, force: true });
  cpSync(join(root, "public"), out, { recursive: true });
  cpSync(join(root, "app/styles.css"), join(out, "app/styles.css"));

  for (const url of urls) {
    const page = await render(url);
    const file = url === "/" ? "index.html" : `${url.slice(1)}/index.html`;
    if (page.location) {
      // A static host cannot answer 302, so the page sends the browser on itself.
      const to = page.location;
      write(
        file,
        `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${base}${to}"><link rel="canonical" href="${to}">`,
      );
    } else if (page.status === 200) {
      write(file, page.html);
    } else {
      throw new Error(`${url} rendered with status ${page.status}`);
    }
  }
  write("404.html", (await render("/this-page-does-not-exist")).html);
} finally {
  await server.close();
}
